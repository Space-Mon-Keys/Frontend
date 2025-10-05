import React, { useState, useEffect, useMemo } from "react";
import { energyToMagnitude, findSimilarEarthquakes } from '../../../services/earthquakeEnergyService';
import { assessNEOImpact } from '../../../services/neoEntryImpact';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix Leaflet's default icon path so markers show up in React/Vite
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Format energy with appropriate units based on magnitude
function formatEnergy(energyMt) {
  if (energyMt >= 0.001) {
    // >= 1 kiloton: show in megatons
    return `${energyMt.toFixed(3)} Mt TNT`;
  } else if (energyMt >= 0.000001) {
    // >= 1 ton: show in kilotons
    const energyKt = energyMt * 1000;
    return `${energyKt.toFixed(3)} kt TNT`;
  } else {
    // < 1 kiloton: show in tons
    const energyTon = energyMt * 1000000;
    return `${energyTon.toFixed(2)} ton TNT`;
  }
}

// Format distance with appropriate units based on magnitude
function formatDistance(distanceKm) {
  if (distanceKm >= 1) {
    // >= 1 km: show in kilometers
    return `${distanceKm.toFixed(2)} km`;
  } else if (distanceKm >= 0.001) {
    // >= 1 meter: show in meters
    const distanceM = distanceKm * 1000;
    return `${distanceM.toFixed(1)} m`;
  } else {
    // < 1 meter: show in centimeters
    const distanceCm = distanceKm * 100000;
    return `${distanceCm.toFixed(0)} cm`;
  }
}

// Format velocity with appropriate units
function formatVelocity(velocityMs) {
  const velocityKms = velocityMs / 1000;
  if (velocityKms >= 1) {
    // >= 1 km/s: show in km/s
    return `${velocityKms.toFixed(2)} km/s`;
  } else {
    // < 1 km/s: show in m/s
    return `${velocityMs.toFixed(1)} m/s`;
  }
}

// Formula for base crater radius (in km) based on energy (megatons)
function calculateCraterRadiusKm(energyMt) {
  // Empirical relationship: radius (km) ≈ 1.8 * (E)^(1/3)
  return 1.8 * Math.cbrt(energyMt);
}

// Helper component to adjust zoom to largest circle
function FitCircleBounds({ center, radiusMeters }) {
  const map = useMap();
  React.useEffect(() => {
    if (!center || !radiusMeters) return;
    // Calculate bounds using Leaflet's method
    const lat = center[0], lng = center[1];
    // Calculate two opposite points of the circle
    const earthRadius = 6378137; // mean radius in meters
    const dLat = (radiusMeters / earthRadius) * (180 / Math.PI);
    const dLng = (radiusMeters / (earthRadius * Math.cos(Math.PI * lat / 180))) * (180 / Math.PI);
    const bounds = [
      [lat - dLat, lng - dLng],
      [lat + dLat, lng + dLng]
    ];
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8 });
  }, [center, radiusMeters, map]);
  return null;
}

// Ground impact zone parameters (crater-relative radius, color, opacity, label, description)
// Based on impact models from Collins et al. and the Earth Impact Effects Program
const impactZones = [
  { relRadius: 0.3, color: '#fff200', opacity: 1.0, label: 'Transient crater', description: 'Rock vaporization and melting, temperatures >10,000°C' },
  { relRadius: 1.0, color: '#ff3d00', opacity: 0.9, label: 'Final crater', description: 'Complete excavation, wall collapse' },
  { relRadius: 2.5, color: '#ff9800', opacity: 0.8, label: 'Primary ejecta', description: 'Molten material and rock ejected at high velocity' },
  { relRadius: 4.0, color: '#d500f9', opacity: 0.7, label: 'Secondary ejecta', description: 'Debris and dust, secondary craters' },
  { relRadius: 6.0, color: '#00e676', opacity: 0.6, label: 'Thermal radiation zone', description: 'Massive fires, ignition of combustible materials' },
  { relRadius: 10.0, color: '#2979ff', opacity: 0.5, label: 'Atmospheric shock wave', description: 'Severe structural damage, winds >200 km/h' },
  { relRadius: 15.0, color: '#00bcd4', opacity: 0.4, label: 'Seismic waves', description: 'Earthquakes, collapse of weak structures' }
];

function LocationMarker({ onSelect, position }) {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} icon={DefaultIcon} /> : null;
}

const DEFAULT_CENTER = [20, 0];
const DEFAULT_ZOOM = 2;

/**
 * MapImpact Component - Asteroid/Comet Impact Visualization
 * Accepts parameters from HOME:
 * @param {number} props.diameter - Object diameter (m)
 * @param {number} props.velocity - Impact velocity (m/s)
 * @param {number} props.density - Material density (kg/m³)
 * @param {number} props.entryAngle - Entry angle from horizontal (degrees), default 45
// energyMt, initialLat, initialLng removed as not used
 */
const MapImpact = ({ 
  diameter = 50,
  velocity = 20000,
  density = 3000,
  entryAngle = 45,
  initialLat = null,
  initialLng = null
}) => {
  const [impactPos, setImpactPos] = useState(null);

  // Initialize impactPos with initialLat/initialLng if defined and impactPos is null
  useEffect(() => {
    if (
      impactPos === null &&
      initialLat !== null &&
      initialLng !== null &&
      !isNaN(initialLat) &&
      !isNaN(initialLng)
    ) {
      setImpactPos([initialLat, initialLng]);
    }
    // Only runs when initials or impactPos change
  }, [initialLat, initialLng, impactPos]);

  // Convert HOME parameters to NEO format
  const neoParams = useMemo(() => {
    // velocity (m/s) → vInfinity (km/s)
    const vImpact = velocity / 1000; // convert to km/s
    
    let vInf;
    if (vImpact < 3) {
      // Low velocity: use directly (satellites, slow reentries)
      vInf = vImpact;
    } else {
      // High velocity: calculate v_infinity for NEO
      // Approximation: v_infinity ≈ sqrt(v_impact^2 - v_escape^2)
      const vEscape = 11.2; // km/s
      vInf = Math.max(5, Math.sqrt(Math.max(0, vImpact * vImpact - vEscape * vEscape)));
    }
    
    // Build material object based on density
    let materialObj;
    if (density < 1500) {
      materialObj = { density, strength: 1e5, name: 'Cometary (ice)' };
    } else if (density > 5000) {
      materialObj = { density, strength: 2e6, name: 'Metallic' };
    } else {
      materialObj = { density, strength: 2e5, name: 'Rocky' };
    }
    return {
      vInfinity: vInf,
      diameter: diameter,
      material: materialObj,
      entryAngle: entryAngle,
      densityOriginal: density
    };
  }, [velocity, diameter, density, entryAngle]);

  // Calculate impact scenario using NEO module
  const impactScenario = useMemo(() => {
    return assessNEOImpact({
      vInfinity: neoParams.vInfinity,
      diameter: neoParams.diameter,
      material: neoParams.material,
      entryAngle: neoParams.entryAngle,
      options: {
        recordTrajectory: false
      }
    });
  }, [neoParams]);

  // Determine if there was actual ground impact (extra robustness)
  const impactData = impactScenario.trajectory.impact;
  // Normalize outcome to lowercase for comparison
  const outcomeStr = (impactScenario.outcome || '').toLowerCase();
  // Robustness: never ground impact if outcome indicates ablation/disintegration, or mass <= 0, or groundImpact not true
  const hasGroundImpact = (
    impactData &&
    impactData.groundImpact === true &&
    typeof impactData.mass === 'number' &&
    impactData.mass > 0 &&
    !outcomeStr.includes('ablation') &&
    !outcomeStr.includes('disintegr') &&
    !outcomeStr.includes('burn')
  );
  // Temporary log for debugging edge cases
  if (impactData && (impactData.groundImpact || impactData.mass === 0 || outcomeStr.includes('ablation'))) {
    // eslint-disable-next-line no-console
    console.debug('[MapImpact] groundImpact:', impactData.groundImpact, 'mass:', impactData.mass, 'outcome:', impactScenario.outcome, 'hasGroundImpact:', hasGroundImpact);
  }
  
  // Airburst data if exists
  const airburstData = impactScenario.blast || null;

  // Use appropriate energy based on event type
  const finalEnergyMt = hasGroundImpact 
    ? (impactScenario.trajectory.impact.impactEnergy || 0.001)
    : (airburstData?.energy || impactScenario.trajectory.impact.airburstEnergy || 0.001);
  
  const craterRadiusKm = hasGroundImpact ? calculateCraterRadiusKm(finalEnergyMt) : 0;
  
  // Calculate seismic magnitude if ground impact
  // Only a fraction of impact energy converts to radiated seismic energy.
  // Seismic coupling factor η (dimensionless):
  //   - Rock/continent: 1e-3 (default)
  //   - Soft sediments: 3e-4
  //   - Ocean/depth: 1e-4
  // Conversion: 1 Mt TNT = 4.184e15 J
  // E_seismic = E_impact × η
  const SEISMIC_COUPLING = 1e-3; // η for rock/continent (default)
  const impactEnergyJoules = finalEnergyMt * 4.184e15; // Convert Mt TNT to joules
  const earthquakeMag = hasGroundImpact ? energyToMagnitude(impactEnergyJoules, SEISMIC_COUPLING) : null;
  
  // Don't show seismic block if Mw < 2.0 (imperceptible)
  const showSeismicBlock = earthquakeMag !== null && earthquakeMag >= 2.0;

  // State for equivalent real earthquakes (only if ground impact and Mw >= 2.0)
  const [similarQuakes, setSimilarQuakes] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function fetchQuakes() {
      if (!showSeismicBlock || isNaN(earthquakeMag)) return setSimilarQuakes([]);
      const quakes = await findSimilarEarthquakes(earthquakeMag, 0.15, 3);
      if (!cancelled) setSimilarQuakes(quakes);
    }
    fetchQuakes();
    return () => { cancelled = true; };
  }, [earthquakeMag, showSeismicBlock]);

  // Determine if there's an airburst (without ground impact)
  const hasAirburst = !hasGroundImpact && airburstData && airburstData.altitude;

  // Define damage zones based on event type
  let damageZones = [];
  let maxRadiusMeters = 0;

  if (hasGroundImpact) {
    // For ground impacts: use crater-relative radii
    damageZones = impactZones.map((zone, idx) => ({
      ...zone,
      radiusKm: craterRadiusKm * zone.relRadius,
      radiusMeters: craterRadiusKm * zone.relRadius * 1000,
      idx
    }));
    maxRadiusMeters = craterRadiusKm * impactZones[impactZones.length - 1].relRadius * 1000;
  } else if (hasAirburst) {
    // For airbursts: use scientific overpressure-based radii
    damageZones = [
      {
        radiusKm: airburstData.radiusSevereDestruction,
        radiusMeters: airburstData.radiusSevereDestruction * 1000,
        color: '#ff3d00',
        opacity: 0.9,
        label: 'Significant structural damage',
        description: 'Major damage to buildings (35 kPa)',
        idx: 0
      },
      {
        radiusKm: airburstData.radiusStructuralDamage,
        radiusMeters: airburstData.radiusStructuralDamage * 1000,
        color: '#ff9800',
        opacity: 0.7,
        label: 'Light structural damage',
        description: 'Moderate structural damage (20 kPa)',
        idx: 1
      },
      {
        radiusKm: airburstData.radiusWindowBreak,
        radiusMeters: airburstData.radiusWindowBreak * 1000,
        color: '#fff200',
        opacity: 0.5,
        label: 'Window breakage',
        description: 'Possible window breakage (2 kPa)',
        idx: 2
      }
    ].filter(zone => zone.radiusKm > 0); // Only show zones with radius > 0
    maxRadiusMeters = Math.max(...damageZones.map(z => z.radiusMeters));
  }

  // Show circles if ground impact OR airburst
  const showDamageZones = hasGroundImpact || hasAirburst;

  // State to show/hide all zones
  const [showAllZones, setShowAllZones] = useState(true);
  // State for individual overlays (always in same order)
  const [zoneVisibility, setZoneVisibility] = useState(
    damageZones.map(() => true)
  );

  // When "All zones" is activated, all individual overlays are activated
  useEffect(() => {
    if (showAllZones) {
      setZoneVisibility(damageZones.map(() => true));
    }
  }, [showAllZones, damageZones.length]);

  // If "All zones" is deactivated, hide all circles
  const visibleZones = showAllZones ? zoneVisibility : damageZones.map(() => false);

  // States for draggable legend
  const [legendPos, setLegendPos] = useState({ x: null, y: null });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const legendRef = React.useRef(null);
  
  // State to minimize/expand layer control
  const [layersExpanded, setLayersExpanded] = useState(true);
  
  // States to minimize/expand other panels
  const [impactInfoExpanded, setImpactInfoExpanded] = useState(true);
  const [legendExpanded, setLegendExpanded] = useState(true);
  const [consequencesExpanded, setConsequencesExpanded] = useState(true);

  // Effect for global mouse listeners (draggable legend)
  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging) return;
      setLegendPos(pos => ({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y
      }));
    }
    function onMouseUp() { setDragging(false); }
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, offset]);

  // Initial legend position (left side to avoid overlap with layer control on right)
  useEffect(() => {
    if (legendPos.x === null && legendPos.y === null && legendRef.current) {
      const rect = legendRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth <= 768;
      
      if (isMobile) {
        // On mobile: position at bottom left
        setLegendPos({
          x: 20,
          y: window.innerHeight - rect.height - 100 // Extra space for other panels
        });
      } else {
        // On desktop: position at top left
        setLegendPos({
          x: 20,
          y: 20
        });
      }
    }
  }, [legendPos.x, legendPos.y]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      margin: 0,
      padding: 0,
      background: '#181c2a',
      zIndex: 0
    }}>
      <MapContainer center={impactPos || DEFAULT_CENTER} zoom={DEFAULT_ZOOM} maxZoom={19} style={{ height: "100%", width: "100%", borderRadius: 0, zIndex: 1 }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors & CartoDB"
        />
        <LocationMarker onSelect={setImpactPos} position={impactPos} />
        {/* Adjust zoom to largest circle only if there's damage and radius is greater than zero */}
        {impactPos && showDamageZones && maxRadiusMeters > 0 && (
          <FitCircleBounds center={impactPos} radiusMeters={maxRadiusMeters} />
        )}
        {/* Render circles from largest to smallest radius so smaller ones are on top */}
        {impactPos && showDamageZones && damageZones
          .map((zone) => ({ ...zone }))
          .filter(({ idx }) => visibleZones[idx])
          .sort((a, b) => b.radiusMeters - a.radiusMeters) // largest to smallest radius (large first, behind)
          .map((zone) => (
            <Circle
              key={`circle-${zone.idx}`}
              center={impactPos}
              radius={zone.radiusMeters}
              pathOptions={{ 
                color: zone.color, 
                fillColor: zone.color, 
                fillOpacity: zone.opacity, 
                weight: 2 
              }}
            />
          ))
        }
      </MapContainer>
      {/* Custom layer control panel - for ground impacts or airbursts */}
      {impactPos && showDamageZones && (
        <div 
          className="layer-control-panel"
          style={{
          position: 'fixed',
          top: window.innerWidth <= 768 ? 80 : 20, // Lower on mobile to avoid drawer button
          right: 20,
          zIndex: 2000,
          background: 'rgba(20,20,40,0.95)',
          borderRadius: 8,
          border: '2px solid #7c4dff',
          boxShadow: '0 4px 16px rgba(124,77,255,0.3)',
          padding: '12px',
          minWidth: layersExpanded ? 200 : 'auto',
          maxWidth: window.innerWidth <= 768 ? '80vw' : 250,
          color: '#e0e7ff',
          fontSize: 14,
          transition: 'all 0.3s ease'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontWeight: 700, 
            color: '#7c4dff', 
            fontSize: 15, 
            marginBottom: layersExpanded ? 12 : 0,
            borderBottom: layersExpanded ? '1px solid rgba(124,77,255,0.3)' : 'none',
            paddingBottom: layersExpanded ? 8 : 0,
            transition: 'all 0.3s ease'
          }}>
            <span>Layer Control</span>
            <button
              onClick={() => setLayersExpanded(!layersExpanded)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#7c4dff',
                cursor: 'pointer',
                fontSize: 18,
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 0.3s ease'
              }}
              title={layersExpanded ? 'Minimize' : 'Expand'}
            >
              {layersExpanded ? '▼' : '▶'}
            </button>
          </div>
          {layersExpanded && (
            <>
              {/* Master "All zones" control */}
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                cursor: 'pointer',
                marginBottom: 12,
                padding: '6px 4px',
                background: showAllZones ? 'rgba(124,77,255,0.2)' : 'transparent',
                borderRadius: 4,
                fontWeight: 600
              }}>
                <input 
                  type="checkbox" 
                  checked={showAllZones}
                  onChange={(e) => setShowAllZones(e.target.checked)}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
                <span>All zones</span>
              </label>
              {/* Individual controls */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 8,
                paddingLeft: 8,
                borderLeft: '2px solid rgba(124,77,255,0.2)'
              }}>
                {damageZones.map((zone) => (
                  <label 
                    key={zone.idx}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      cursor: showAllZones ? 'pointer' : 'not-allowed',
                      opacity: showAllZones ? 1 : 0.4,
                      fontSize: 13
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={visibleZones[zone.idx]}
                      disabled={!showAllZones}
                      onChange={(e) => {
                        const newVis = [...zoneVisibility];
                        newVis[zone.idx] = e.target.checked;
                        setZoneVisibility(newVis);
                      }}
                      style={{ cursor: showAllZones ? 'pointer' : 'not-allowed', width: 14, height: 14 }}
                    />
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: zone.color,
                      border: '1px solid rgba(255,255,255,0.3)',
                      flexShrink: 0
                    }} />
                    <span>{zone.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {/* Unified impact block */}
      {impactPos && (
        <div style={{
          position: 'fixed',
          bottom: window.innerWidth <= 768 ? 'max(2vw, 10px)' : 'max(2vw, 18px)',
          right: window.innerWidth <= 768 ? 'max(2vw, 10px)' : 'max(2vw, 18px)',
          left: window.innerWidth <= 768 ? 'max(2vw, 10px)' : 'auto',
          zIndex: 3000,
          background: 'rgba(20,20,40,0.97)',
          borderRadius: 12,
          border: '2px solid #7c4dff',
          boxShadow: '0 4px 24px 0 rgba(44,0,80,0.18)',
          padding: '18px 18px 24px 18px',
          minWidth: impactInfoExpanded ? (window.innerWidth <= 768 ? 'auto' : 320) : 'auto',
          maxWidth: window.innerWidth <= 768 ? 'none' : '95vw',
          color: '#e0e7ff',
          fontSize: window.innerWidth <= 768 ? 13 : 15,
          display: 'flex',
          flexDirection: 'column',
          gap: impactInfoExpanded ? 14 : 0,
          alignItems: 'flex-start',
          pointerEvents: 'auto',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            fontWeight: 700, 
            color: '#7c4dff', 
            fontSize: 18, 
            marginBottom: impactInfoExpanded ? 2 : 0, 
            letterSpacing: 0.2,
            borderBottom: impactInfoExpanded ? '1px solid rgba(124,77,255,0.2)' : 'none',
            paddingBottom: impactInfoExpanded ? 8 : 0,
            transition: 'all 0.3s ease'
          }}>
            <span>Asteroid Impact</span>
            <button
              onClick={() => setImpactInfoExpanded(!impactInfoExpanded)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#7c4dff',
                cursor: 'pointer',
                fontSize: 18,
                padding: '0 4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 0.3s ease'
              }}
              title={impactInfoExpanded ? 'Minimize' : 'Expand'}
            >
              {impactInfoExpanded ? '▼' : '▶'}
            </button>
          </div>
          {impactInfoExpanded && (
            <>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, borderBottom: '1px solid rgba(124,77,255,0.2)', paddingBottom: 8, width: '100%' }}>
            <span style={{ color: '#b2f7ef', fontWeight: 700 }}>Object:</span> ⌀{diameter}m, {(neoParams.densityOriginal || density).toLocaleString()} kg/m³
            <span style={{ marginLeft: 16, color: '#fff200', fontWeight: 700 }}>Velocity:</span> {formatVelocity(velocity)}
            <span style={{ marginLeft: 16, color: '#ff9800', fontWeight: 700 }}>Mass:</span> {(impactScenario.body.mass / 1000).toLocaleString(undefined, {maximumFractionDigits: 0})} ton
            <span style={{ marginLeft: 16, color: '#d500f9', fontWeight: 700 }}>Angle:</span> {entryAngle}°
          </div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>
            <span style={{ color: '#fff200', fontWeight: 700 }}>Total energy:</span> {formatEnergy(finalEnergyMt)}
          </div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginTop: 2 }}>
            <span style={{ color: impactScenario.trajectory.impact.airburst ? '#00e676' : '#ff3d00', fontWeight: 700 }}>Outcome:</span>{' '}
            {impactScenario.outcome}
          </div>
          {/* Always show airburst block if outcome is ablation, even if no detailed data */}
          {(airburstData || outcomeStr.includes('ablation') || outcomeStr.includes('disintegr') || outcomeStr.includes('burn')) && (
            <div style={{ fontWeight: 600, color: '#00e676', fontSize: 14 }}>
              <span>
                Airburst
                {airburstData && airburstData.altitude ? ` at ${(airburstData.altitude / 1000).toFixed(1)} km` : ''}
              </span>
              {airburstData && airburstData.radiusWindowBreak ? (
                <span style={{ marginLeft: 12, color: '#d500f9' }}>
                  Damage radius: {formatDistance(airburstData.radiusWindowBreak)} (windows)
                </span>
              ) : null}
              {(!airburstData || !airburstData.altitude) && (
                <span style={{ marginLeft: 12, color: '#b2f7ef', fontSize: 13 }}>
                  (Object disintegrated in atmosphere; no detailed airburst data available)
                </span>
              )}
            </div>
          )}
          {showSeismicBlock && (
            <div style={{ fontWeight: 600, color: '#ff3d00', fontSize: 15 }}>
              <span>Estimated seismic magnitude: <strong>{earthquakeMag.toFixed(1)}</strong></span>
              <span style={{ display: 'block', marginTop: 4, color: '#b2f7ef', fontSize: 12, fontStyle: 'italic' }}>
                (Assuming seismic coupling η = {SEISMIC_COUPLING.toExponential(0)} for rock/continent)
              </span>
              {similarQuakes.length > 0 && (
                <span style={{ display: 'block', marginTop: 6, color: '#b2f7ef', fontSize: 13 }}>
                  Similar earthquakes: {similarQuakes.map(q => `${q.place || 'Earthquake'} (M${q.magnitude}, ${new Date(q.time).getFullYear()})`).join(' | ')}
                </span>
              )}
            </div>
          )}
          <div style={{ marginTop: 10, width: '100%' }}>
            <h4 style={{ color: '#ff3d00', margin: 0, fontSize: 16, marginBottom: 10, letterSpacing: 0.5 }}>
              {hasGroundImpact ? 'Damage Zones (Ground Impact)' : hasAirburst ? 'Damage Zones (Airburst)' : 'Consequences'}
            </h4>
            {showDamageZones ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {damageZones.map((zone) => (
                  <li key={zone.idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: zone.color,
                      border: '2px solid rgba(255,255,255,0.4)',
                      flexShrink: 0,
                      marginTop: 4
                    }} />
                    <span>
                      <strong style={{ color: zone.color }}>{zone.label}:</strong> {zone.description}
                      {zone.radiusKm && <span style={{ color: '#b2f7ef', marginLeft: 8 }}>(~{formatDistance(zone.radiusKm)})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li><span style={{ color: '#ff3d00', fontSize: 18 }}>💥</span> <strong>Local destruction:</strong> Everything in the area near the impact is instantly destroyed.</li>
                <li><span style={{ color: '#ff9800', fontSize: 18 }}>🔥</span> <strong>Massive fires:</strong> Extreme heat generates forest and urban fires over large areas.</li>
                <li><span style={{ color: '#00e676', fontSize: 18 }}>🌪️</span> <strong>Shock waves and extreme winds:</strong> Air is violently displaced, causing destruction over great distances.</li>
              </ul>
            )}
          </div>
            </>
          )}
        </div>
      )}
      <div
        ref={legendRef}
        style={{
          position: 'fixed',
          left: legendPos.x ?? 20,
          top: legendPos.y ?? 20,
          right: 'auto',
          zIndex: 2000,
          maxWidth: legendExpanded ? 280 : 'auto',
          margin: '16px auto',
          padding: '12px',
          background: 'rgba(20,20,40,0.9)',
          borderRadius: 8,
          border: '1px solid rgba(124,77,255,0.3)',
          cursor: dragging ? 'grabbing' : 'default',
          userSelect: 'none',
          boxShadow: dragging ? '0 0 16px #7c4dff' : undefined,
          transition: 'all 0.3s ease'
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: '100%',
            height: 18,
            marginBottom: legendExpanded ? 6 : 0,
            cursor: 'grab',
            background: 'linear-gradient(90deg,#7c4dff33,#181c2a 80%)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: '#7c4dff',
            fontWeight: 700,
            letterSpacing: 0.5,
            paddingLeft: 8,
            paddingRight: 4,
            transition: 'all 0.3s ease'
          }}
          onMouseDown={e => {
            setDragging(true);
            const rect = legendRef.current.getBoundingClientRect();
            setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          <span>⠿ {showDamageZones ? (hasGroundImpact ? 'Impact Zones' : 'Airburst Zones') : 'No Impact'}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setLegendExpanded(!legendExpanded);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#7c4dff',
              cursor: 'pointer',
              fontSize: 16,
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              transition: 'transform 0.3s ease'
            }}
            title={legendExpanded ? 'Minimize' : 'Expand'}
          >
            {legendExpanded ? '▼' : '▶'}
          </button>
        </div>
        {legendExpanded && (
          <>
        {showDamageZones ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {damageZones.map((zone) => (
              <div key={zone.idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: zone.color,
                  border: '2px solid rgba(255,255,255,0.3)',
                  flexShrink: 0,
                  marginTop: 2
                }} />
                <div style={{ fontSize: 11, color: '#e0e7ff', flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{zone.label}</div>
                  <div style={{ opacity: 0.7, fontSize: 10, lineHeight: 1.3 }}>{zone.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            padding: '12px', 
            background: 'rgba(255,152,0,0.1)', 
            borderRadius: 6, 
            border: '1px solid rgba(255,152,0,0.3)',
            fontSize: 12,
            lineHeight: 1.5,
            color: '#ff9800'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>🔥 Object completely disintegrated</div>
            <div style={{ opacity: 0.9 }}>
              The object burned up completely in the atmosphere. No ground impact occurred.
              {airburstData && (
                <>
                  <br /><br />
                  <strong>Airburst:</strong> {(airburstData.altitude / 1000).toFixed(1)} km altitude
                  <br />
                  <strong>Energy:</strong> {airburstData.energy.toFixed(3)} Mt
                </>
              )}
            </div>
          </div>
        )}
          </>
        )}
      </div>
      <div style={{ marginTop: 16, color: "#e0e7ff", textAlign: "center" }}>
        <p>Click on the map to select the impact epicenter.</p>
        {impactPos && hasGroundImpact && (
          <p>
            Estimated crater radius: <strong>{craterRadiusKm.toFixed(2)} km</strong> (Energy: {finalEnergyMt.toFixed(2)} Mt)
          </p>
        )}
        {impactPos && hasAirburst && (
          <p style={{ color: '#ff9800', fontWeight: 'bold' }}>
            Airburst at {(airburstData.altitude / 1000).toFixed(1)} km altitude - {airburstData.energy.toFixed(2)} Mt
          </p>
        )}
        {impactPos && !showDamageZones && (
          <p style={{ color: '#ff9800', fontWeight: 'bold' }}>
            ⚠️ Object disintegrated in the atmosphere
          </p>
        )}
      </div>
      {/* Impact consequences list */}
      <div style={{
        margin: '32px auto 0 auto',
        maxWidth: 600,
        background: 'rgba(20,20,40,0.92)',
        borderRadius: 10,
        border: '1px solid rgba(124,77,255,0.18)',
        padding: '20px 28px',
        color: '#e0e7ff',
        boxShadow: '0 2px 16px 0 rgba(44,0,80,0.10)',
        fontSize: 15,
        transition: 'all 0.3s ease'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: consequencesExpanded ? 18 : 0,
          transition: 'all 0.3s ease'
        }}>
          <h3 style={{ color: '#ff3d00', margin: 0, fontSize: 18, letterSpacing: 0.5 }}>Impact Consequences</h3>
          <button
            onClick={() => setConsequencesExpanded(!consequencesExpanded)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ff3d00',
              cursor: 'pointer',
              fontSize: 18,
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              transition: 'transform 0.3s ease'
            }}
            title={consequencesExpanded ? 'Minimize' : 'Expand'}
          >
            {consequencesExpanded ? '▼' : '▶'}
          </button>
        </div>
        {consequencesExpanded && (
          <>
        {hasAirburst && airburstData ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#ff3d00', marginTop: 2 }}>💥</span>
              <span><strong>Significant structural damage (35 kPa):</strong> up to <strong>{airburstData.radiusSevereDestruction?.toFixed(1) ?? '-'} km</strong> from the epicenter.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#ff9800', marginTop: 2 }}>🏚️</span>
              <span><strong>Light structural damage (20 kPa):</strong> up to <strong>{airburstData.radiusStructuralDamage?.toFixed(1) ?? '-'} km</strong> from the epicenter.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#fff200', marginTop: 2 }}>🪟</span>
              <span><strong>Window breakage (2 kPa):</strong> up to <strong>{airburstData.radiusWindowBreak?.toFixed(1) ?? '-'} km</strong> from the epicenter.</span>
            </li>
          </ul>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#ff3d00', marginTop: 2 }}>💥</span>
              <span><strong>Local destruction:</strong> Everything in the area near the impact is instantly destroyed.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#ff9800', marginTop: 2 }}>🔥</span>
              <span><strong>Massive fires:</strong> Extreme heat generates forest and urban fires over large areas.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#2979ff', marginTop: 2 }}>🌊</span>
              <span><strong>Tsunamis:</strong> If the impact is in the ocean, giant waves are generated affecting distant coasts.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#00e676', marginTop: 2 }}>🌪️</span>
              <span><strong>Shock waves and extreme winds:</strong> Air is violently displaced, causing destruction over great distances.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#d500f9', marginTop: 2 }}>🌫️</span>
              <span><strong>Global darkening:</strong> Dust and debris in the atmosphere block sunlight, affecting climate.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#fff200', marginTop: 2 }}>🌡️</span>
              <span><strong>Climate changes:</strong> Temperature drop and alterations in rainfall patterns for months or years.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#00bcd4', marginTop: 2 }}>🦖</span>
              <span><strong>Mass extinctions:</strong> Animal and plant life can be severely affected, as happened with the dinosaurs.</span>
            </li>
            {showSeismicBlock && (
              <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, color: '#7c4dff', marginTop: 2 }}>🌎</span>
                <span><strong>Generated earthquake:</strong> Estimated magnitude <strong>{earthquakeMag.toFixed(1)}</strong> (Mw, assuming seismic coupling η = {SEISMIC_COUPLING.toExponential(0)}).</span>
              </li>
            )}
          </ul>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default MapImpact;
