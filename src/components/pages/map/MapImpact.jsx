import React, { useState, useEffect, useMemo } from "react";
import { energyToMagnitude, findSimilarEarthquakes } from '../../../services/earthquakeEnergyService';
import { assessNEOImpact } from '../../../services/neoEntryImpact';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fórmula para radio del cráter base (en km) según energía (megatones)
function calculateCraterRadiusKm(energyMt) {
  // Relación empírica: radio (km) ≈ 1.8 * (E)^(1/3)
  return 1.8 * Math.cbrt(energyMt);
}

// Componente auxiliar para ajustar el zoom al círculo más grande
function FitCircleBounds({ center, radiusMeters }) {
  const map = useMap();
  React.useEffect(() => {
    if (!center || !radiusMeters) return;
    // Calcula bounds usando el método de Leaflet
    const lat = center[0], lng = center[1];
    // Calcula dos puntos opuestos del círculo
    const earthRadius = 6378137; // radio medio en metros
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

// Parámetros de zonas de impacto terrestre (radio relativo al cráter, color, opacidad, label, descripción)
// Basado en modelos de impacto de Collins et al. y el Earth Impact Effects Program
const impactZones = [
  { relRadius: 0.3, color: '#fff200', opacity: 1.0, label: 'Cráter transiente', description: 'Vaporización y fusión de rocas, temperaturas >10,000°C' },
  { relRadius: 1.0, color: '#ff3d00', opacity: 0.9, label: 'Cráter final', description: 'Excavación completa, colapso de paredes' },
  { relRadius: 2.5, color: '#ff9800', opacity: 0.8, label: 'Eyecta primaria', description: 'Material fundido y roca expulsada a alta velocidad' },
  { relRadius: 4.0, color: '#d500f9', opacity: 0.7, label: 'Eyecta secundaria', description: 'Escombros y polvo, cráteres secundarios' },
  { relRadius: 6.0, color: '#00e676', opacity: 0.6, label: 'Zona de radiación térmica', description: 'Incendios masivos, ignición de material combustible' },
  { relRadius: 10.0, color: '#2979ff', opacity: 0.5, label: 'Onda de choque atmosférica', description: 'Daño estructural severo, vientos >200 km/h' },
  { relRadius: 15.0, color: '#00bcd4', opacity: 0.4, label: 'Ondas sísmicas', description: 'Terremotos, colapso de estructuras débiles' }
];

function LocationMarker({ onSelect, position }) {
  useMapEvents({
    click(e) {
      onSelect([e.latlng.lat, e.latlng.lng]);
    },
  });
  return position ? <Marker position={position} /> : null;
}

const DEFAULT_CENTER = [20, 0];
const DEFAULT_ZOOM = 2;

/**
 * Componente MapImpact - Visualización de impacto de asteroide/cometa
 * Acepta parámetros desde HOME:
 * @param {number} props.diameter - Diámetro del objeto (m)
 * @param {number} props.velocity - Velocidad de impacto (m/s)
 * @param {number} props.density - Densidad del material (kg/m³)
 * @param {number} props.entryAngle - Ángulo de entrada desde horizontal (grados), default 45
// energyMt, initialLat, initialLng eliminados por no usarse
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

  // Inicializar impactPos con initialLat/initialLng si están definidos y impactPos es null
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
    // Solo se ejecuta cuando cambian los iniciales o impactPos
  }, [initialLat, initialLng, impactPos]);

  // Convertir parámetros de HOME a formato NEO
  const neoParams = useMemo(() => {
    // velocity (m/s) → vInfinity (km/s)
    // Aproximación: v_infinity ≈ sqrt(v_impact^2 - v_escape^2)
    const vEscape = 11.2; // km/s
    const vImpact = velocity / 1000; // convertir a km/s
    const vInf = Math.max(5, Math.sqrt(Math.max(0, vImpact * vImpact - vEscape * vEscape)));
    
    // Construir objeto material según densidad
    let materialObj;
    if (density < 1500) {
      materialObj = { density, strength: 1e5, name: 'Cometario (hielo)' };
    } else if (density > 5000) {
      materialObj = { density, strength: 2e6, name: 'Metálico' };
    } else {
      materialObj = { density, strength: 2e5, name: 'Rocoso' };
    }
    return {
      vInfinity: vInf,
      diameter: diameter,
      material: materialObj,
      entryAngle: entryAngle,
      densityOriginal: density
    };
  }, [velocity, diameter, density, entryAngle]);

  // Calcular escenario de impacto usando el módulo NEO
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

  // Determinar si hubo impacto terrestre real (robustez extra)
  const impactData = impactScenario.trajectory.impact;
  // Normalizar outcome a minúsculas para comparar
  const outcomeStr = (impactScenario.outcome || '').toLowerCase();
  // Robustez: nunca hay impacto si outcome indica ablation/desintegración, o masa <= 0, o groundImpact no es true
  const hasGroundImpact = (
    impactData &&
    impactData.groundImpact === true &&
    typeof impactData.mass === 'number' &&
    impactData.mass > 0 &&
    !outcomeStr.includes('ablation') &&
    !outcomeStr.includes('desintegr') &&
    !outcomeStr.includes('burn')
  );
  // Log temporal para depuración de edge cases
  if (impactData && (impactData.groundImpact || impactData.mass === 0 || outcomeStr.includes('ablation'))) {
    // eslint-disable-next-line no-console
    console.debug('[MapImpact] groundImpact:', impactData.groundImpact, 'mass:', impactData.mass, 'outcome:', impactScenario.outcome, 'hasGroundImpact:', hasGroundImpact);
  }
  
  // Datos del airburst si existe
  const airburstData = impactScenario.blast || null;

  // Usar energía apropiada según el tipo de evento
  const finalEnergyMt = hasGroundImpact 
    ? (impactScenario.trajectory.impact.impactEnergy || 0.001)
    : (airburstData?.energy || impactScenario.trajectory.impact.airburstEnergy || 0.001);
  
  const craterRadiusKm = hasGroundImpact ? calculateCraterRadiusKm(finalEnergyMt) : 0;
  // Solo calcular magnitud de terremoto si hay impacto terrestre
  const earthquakeMag = hasGroundImpact ? energyToMagnitude(finalEnergyMt * 4.184e15) : null;

  // Estado para terremotos reales equivalentes (solo si hay impacto terrestre)
  const [similarQuakes, setSimilarQuakes] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function fetchQuakes() {
      if (!hasGroundImpact || !earthquakeMag || isNaN(earthquakeMag)) return setSimilarQuakes([]);
      const quakes = await findSimilarEarthquakes(earthquakeMag, 0.15, 3);
      if (!cancelled) setSimilarQuakes(quakes);
    }
    fetchQuakes();
    return () => { cancelled = true; };
  }, [earthquakeMag, hasGroundImpact]);

  // Determinar si hay airburst (sin impacto terrestre)
  const hasAirburst = !hasGroundImpact && airburstData && airburstData.altitude;

  // Definir zonas de daño según el tipo de evento
  let damageZones = [];
  let maxRadiusMeters = 0;

  if (hasGroundImpact) {
    // Para impactos terrestres: usar radios relativos al cráter
    damageZones = impactZones.map((zone, idx) => ({
      ...zone,
      radiusKm: craterRadiusKm * zone.relRadius,
      radiusMeters: craterRadiusKm * zone.relRadius * 1000,
      idx
    }));
    maxRadiusMeters = craterRadiusKm * impactZones[impactZones.length - 1].relRadius * 1000;
  } else if (hasAirburst) {
    // Para airbursts: usar radios científicos basados en sobrepresión
    damageZones = [
      {
        radiusKm: airburstData.radiusSevereDestruction,
        radiusMeters: airburstData.radiusSevereDestruction * 1000,
        color: '#ff3d00',
        opacity: 0.9,
        label: 'Daño estructural significativo',
        description: 'Daños importantes en edificios (35 kPa)',
        idx: 0
      },
      {
        radiusKm: airburstData.radiusStructuralDamage,
        radiusMeters: airburstData.radiusStructuralDamage * 1000,
        color: '#ff9800',
        opacity: 0.7,
        label: 'Daño estructural leve',
        description: 'Daños moderados en estructuras (20 kPa)',
        idx: 1
      },
      {
        // Usar radiusWindowBreak2 si existe (2 kPa), si no, estimar a partir de radiusWindowBreak (1 kPa)
        radiusKm: (() => {
          if (typeof airburstData.radiusWindowBreak2 === 'number') {
            return airburstData.radiusWindowBreak2;
          } else if (typeof airburstData.radiusWindowBreak === 'number') {
            // Estimar radio para 2 kPa usando ley de atenuación: r2 = r1 * (P1/P2)^(1/3.4)
            const r1 = airburstData.radiusWindowBreak;
            const P1 = 1, P2 = 2;
            const r2 = r1 * Math.pow(P1 / P2, 1 / 3.4);
            return r2;
          } else {
            return 0;
          }
        })(),
        radiusMeters: (() => {
          if (typeof airburstData.radiusWindowBreak2 === 'number') {
            return airburstData.radiusWindowBreak2 * 1000;
          } else if (typeof airburstData.radiusWindowBreak === 'number') {
            const r1 = airburstData.radiusWindowBreak;
            const P1 = 1, P2 = 2;
            const r2 = r1 * Math.pow(P1 / P2, 1 / 3.4);
            return r2 * 1000;
          } else {
            return 0;
          }
        })(),
        color: '#fff200',
        opacity: 0.5,
        label: 'Rotura de cristales',
        description: 'Posible rotura de cristales (2 kPa)',
        idx: 2
      }
    ].filter(zone => zone.radiusKm > 0); // Solo mostrar zonas con radio > 0
    maxRadiusMeters = Math.max(...damageZones.map(z => z.radiusMeters));
  }

  // Mostrar círculos si hay impacto terrestre O airburst
  const showDamageZones = hasGroundImpact || hasAirburst;

  // Estado para mostrar/ocultar todas las zonas
  const [showAllZones, setShowAllZones] = useState(true);
  // Estado para overlays individuales (siempre en el mismo orden)
  const [zoneVisibility, setZoneVisibility] = useState(
    damageZones.map(() => true)
  );

  // Cuando se activa "Todas las zonas", todos los overlays individuales se activan
  useEffect(() => {
    if (showAllZones) {
      setZoneVisibility(damageZones.map(() => true));
    }
  }, [showAllZones, damageZones.length]);

  // Si se desactiva "Todas las zonas", oculta todos los círculos
  const visibleZones = showAllZones ? zoneVisibility : damageZones.map(() => false);

  // Estados para la leyenda arrastrable
  const [legendPos, setLegendPos] = useState({ x: null, y: null });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const legendRef = React.useRef(null);
  
  // Estado para minimizar/expandir el control de capas
  const [layersExpanded, setLayersExpanded] = useState(true);

  // Efecto para listeners globales de mouse (leyenda arrastrable)
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

  // Posición inicial de la leyenda (top right)
  useEffect(() => {
    if (legendPos.x === null && legendPos.y === null && legendRef.current) {
      const rect = legendRef.current.getBoundingClientRect();
      setLegendPos({
        x: window.innerWidth - rect.width - 20,
        y: 20
      });
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
        {/* Ajusta el zoom al círculo más grande solo si hay daños y el radio es mayor a cero */}
        {impactPos && showDamageZones && maxRadiusMeters > 0 && (
          <FitCircleBounds center={impactPos} radiusMeters={maxRadiusMeters} />
        )}
        {/* Renderizar círculos de mayor a menor radio para que los pequeños queden encima */}
        {impactPos && showDamageZones && damageZones
          .map((zone) => ({ ...zone }))
          .filter(({ idx }) => visibleZones[idx])
          .sort((a, b) => b.radiusMeters - a.radiusMeters) // mayor a menor radio (grandes primero, atrás)
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
      {/* Panel de control de capas personalizado - para impactos terrestres o airbursts */}
      {impactPos && showDamageZones && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 2000,
          background: 'rgba(20,20,40,0.95)',
          borderRadius: 8,
          border: '2px solid #7c4dff',
          boxShadow: '0 4px 16px rgba(124,77,255,0.3)',
          padding: '12px',
          minWidth: layersExpanded ? 200 : 'auto',
          maxWidth: 250,
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
            <span>Control de Capas</span>
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
              title={layersExpanded ? 'Minimizar' : 'Expandir'}
            >
              {layersExpanded ? '▼' : '▶'}
            </button>
          </div>
          {layersExpanded && (
            <>
              {/* Control maestro "Todas las zonas" */}
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
                <span>Todas las zonas</span>
              </label>
              {/* Controles individuales */}
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
      {/* Bloque unificado de impacto */}
      {impactPos && (
        <div style={{
          position: 'fixed',
          bottom: 'max(2vw, 18px)',
          right: 'max(2vw, 18px)',
          zIndex: 3000,
          background: 'rgba(20,20,40,0.97)',
          borderRadius: 12,
          border: '2px solid #7c4dff',
          boxShadow: '0 4px 24px 0 rgba(44,0,80,0.18)',
          padding: '18px 18px 24px 18px',
          minWidth: 320,
          maxWidth: '95vw',
          color: '#e0e7ff',
          fontSize: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'flex-start',
          pointerEvents: 'auto',
          transition: 'all 0.2s'
        }}>
          <div style={{ fontWeight: 700, color: '#7c4dff', fontSize: 18, marginBottom: 2, letterSpacing: 0.2 }}>Impacto del Asteroide</div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, borderBottom: '1px solid rgba(124,77,255,0.2)', paddingBottom: 8, width: '100%' }}>
            <span style={{ color: '#b2f7ef', fontWeight: 700 }}>Objeto:</span> ⌀{diameter}m, {(neoParams.densityOriginal || density).toLocaleString()} kg/m³
            <span style={{ marginLeft: 16, color: '#fff200', fontWeight: 700 }}>Velocidad:</span> {(velocity / 1000).toFixed(1)} km/s
            <span style={{ marginLeft: 16, color: '#ff9800', fontWeight: 700 }}>Masa:</span> {(impactScenario.body.mass / 1000).toLocaleString(undefined, {maximumFractionDigits: 0})} ton
            <span style={{ marginLeft: 16, color: '#d500f9', fontWeight: 700 }}>Ángulo:</span> {entryAngle}°
          </div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>
            <span style={{ color: '#fff200', fontWeight: 700 }}>Energía total:</span> {finalEnergyMt.toFixed(3)} Mt TNT
          </div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 14, marginTop: 2 }}>
            <span style={{ color: impactScenario.trajectory.impact.airburst ? '#00e676' : '#ff3d00', fontWeight: 700 }}>Resultado:</span>{' '}
            {impactScenario.outcome}
          </div>
          {/* Mostrar siempre bloque de airburst si outcome es ablation, aunque no haya datos detallados */}
          {(airburstData || outcomeStr.includes('ablation') || outcomeStr.includes('desintegr') || outcomeStr.includes('burn')) && (
            <div style={{ fontWeight: 600, color: '#00e676', fontSize: 14 }}>
              <span>
                Airburst
                {airburstData && airburstData.altitude ? ` a ${(airburstData.altitude / 1000).toFixed(1)} km` : ''}
              </span>
              {airburstData && airburstData.radiusWindowBreak ? (
                <span style={{ marginLeft: 12, color: '#d500f9' }}>
                  Radio daños: {airburstData.radiusWindowBreak.toFixed(1)} km (ventanas)
                </span>
              ) : null}
              {(!airburstData || !airburstData.altitude) && (
                <span style={{ marginLeft: 12, color: '#b2f7ef', fontSize: 13 }}>
                  (El objeto se desintegró en la atmósfera; no hay datos detallados de la explosión aérea)
                </span>
              )}
            </div>
          )}
          {hasGroundImpact && (
            <div style={{ fontWeight: 600, color: '#ff3d00', fontSize: 15 }}>
              <span>Magnitud sísmica estimada: <strong>{earthquakeMag?.toFixed(1)}</strong></span>
              {similarQuakes.length > 0 && (
                <span style={{ display: 'block', marginTop: 6, color: '#b2f7ef', fontSize: 13 }}>
                  Terremotos similares: {similarQuakes.map(q => `${q.place || 'Terremoto'} (M${q.magnitude}, ${new Date(q.time).getFullYear()})`).join(' | ')}
                </span>
              )}
            </div>
          )}
          <div style={{ marginTop: 10, width: '100%' }}>
            <h4 style={{ color: '#ff3d00', margin: 0, fontSize: 16, marginBottom: 10, letterSpacing: 0.5 }}>
              {hasGroundImpact ? 'Zonas de Daño (Impacto Terrestre)' : hasAirburst ? 'Zonas de Daño (Airburst)' : 'Consecuencias'}
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
                      {zone.radiusKm && <span style={{ color: '#b2f7ef', marginLeft: 8 }}>(~{zone.radiusKm.toFixed(1)} km)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <li><span style={{ color: '#ff3d00', fontSize: 18 }}>💥</span> <strong>Destrucción local:</strong> Todo en el área cercana al impacto es destruido instantáneamente.</li>
                <li><span style={{ color: '#ff9800', fontSize: 18 }}>🔥</span> <strong>Incendios masivos:</strong> El calor extremo genera incendios forestales y urbanos en grandes extensiones.</li>
                <li><span style={{ color: '#00e676', fontSize: 18 }}>�️</span> <strong>Ondas de choque y vientos extremos:</strong> El aire es desplazado violentamente, causando destrucción a gran distancia.</li>
              </ul>
            )}
          </div>
        </div>
      )}
      <div
        ref={legendRef}
        style={{
          position: 'fixed',
          left: legendPos.x ?? 'auto',
          top: legendPos.y ?? 20,
          right: legendPos.x == null ? 20 : 'auto',
          zIndex: 2000,
          maxWidth: 280,
          margin: '16px auto',
          padding: '12px',
          background: 'rgba(20,20,40,0.9)',
          borderRadius: 8,
          border: '1px solid rgba(124,77,255,0.3)',
          cursor: dragging ? 'grabbing' : 'default',
          userSelect: 'none',
          boxShadow: dragging ? '0 0 16px #7c4dff' : undefined
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: '100%',
            height: 18,
            marginBottom: 6,
            cursor: 'grab',
            background: 'linear-gradient(90deg,#7c4dff33,#181c2a 80%)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            fontSize: 13,
            color: '#7c4dff',
            fontWeight: 700,
            letterSpacing: 0.5,
            paddingLeft: 8
          }}
          onMouseDown={e => {
            setDragging(true);
            const rect = legendRef.current.getBoundingClientRect();
            setOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          ⠿ {showDamageZones ? (hasGroundImpact ? 'Zonas de Impacto' : 'Zonas de Airburst') : 'Sin Impacto'}
        </div>
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
            <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>🔥 Objeto completamente desintegrado</div>
            <div style={{ opacity: 0.9 }}>
              El objeto se quemó completamente en la atmósfera. No hubo impacto terrestre.
              {airburstData && (
                <>
                  <br /><br />
                  <strong>Airburst:</strong> {(airburstData.altitude / 1000).toFixed(1)} km de altitud
                  <br />
                  <strong>Energía:</strong> {airburstData.energy.toFixed(3)} Mt
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 16, color: "#e0e7ff", textAlign: "center" }}>
        <p>Haz click en el mapa para seleccionar el epicentro del impacto.</p>
        {impactPos && hasGroundImpact && (
          <p>
            Radio estimado del cráter: <strong>{craterRadiusKm.toFixed(2)} km</strong> (Energía: {finalEnergyMt.toFixed(2)} Mt)
          </p>
        )}
        {impactPos && hasAirburst && (
          <p style={{ color: '#ff9800', fontWeight: 'bold' }}>
            Airburst a {(airburstData.altitude / 1000).toFixed(1)} km de altitud - {airburstData.energy.toFixed(2)} Mt
          </p>
        )}
        {impactPos && !showDamageZones && (
          <p style={{ color: '#ff9800', fontWeight: 'bold' }}>
            ⚠️ El objeto se desintegró en la atmósfera
          </p>
        )}
      </div>
      {/* Lista de consecuencias del impacto */}
      <div style={{
        margin: '32px auto 0 auto',
        maxWidth: 600,
        background: 'rgba(20,20,40,0.92)',
        borderRadius: 10,
        border: '1px solid rgba(124,77,255,0.18)',
        padding: '20px 28px',
        color: '#e0e7ff',
        boxShadow: '0 2px 16px 0 rgba(44,0,80,0.10)',
        fontSize: 15
      }}>
        <h3 style={{ color: '#ff3d00', marginTop: 0, fontSize: 18, marginBottom: 18, letterSpacing: 0.5 }}>Consecuencias del Impacto</h3>
        {hasAirburst && airburstData ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#ff3d00', marginTop: 2 }}>💥</span>
              <span><strong>Daño estructural significativo (35 kPa):</strong> hasta <strong>{airburstData.radiusSevereDestruction?.toFixed(1) ?? '-'} km</strong> del epicentro.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#ff9800', marginTop: 2 }}>🏚️</span>
              <span><strong>Daño estructural leve (20 kPa):</strong> hasta <strong>{airburstData.radiusStructuralDamage?.toFixed(1) ?? '-'} km</strong> del epicentro.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#fff200', marginTop: 2 }}>🪟</span>
              <span><strong>Rotura de cristales (2 kPa):</strong> hasta <strong>{(() => {
                if (typeof airburstData.radiusWindowBreak === 'number') {
                  return airburstData.radiusWindowBreak.toFixed(1);
                } else if (typeof airburstData.radiusWindowBreak === 'number') {
                  const r1 = airburstData.radiusWindowBreak;
                  const P1 = 1, P2 = 2;
                  const r2 = r1 * Math.pow(P1 / P2, 1 / 3.4);
                  return r2.toFixed(1);
                } else {
                  return '-';
                }
              })()} km</strong> del epicentro.</span>
            </li>
          </ul>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#ff3d00', marginTop: 2 }}>💥</span>
              <span><strong>Destrucción local:</strong> Todo en el área cercana al impacto es destruido instantáneamente.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#ff9800', marginTop: 2 }}>🔥</span>
              <span><strong>Incendios masivos:</strong> El calor extremo genera incendios forestales y urbanos en grandes extensiones.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#2979ff', marginTop: 2 }}>🌊</span>
              <span><strong>Tsunamis:</strong> Si el impacto es en el mar, se generan olas gigantes que afectan costas lejanas.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#00e676', marginTop: 2 }}>🌪️</span>
              <span><strong>Ondas de choque y vientos extremos:</strong> El aire es desplazado violentamente, causando destrucción a gran distancia.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#d500f9', marginTop: 2 }}>🌫️</span>
              <span><strong>Oscurecimiento global:</strong> El polvo y los escombros en la atmósfera bloquean la luz solar, afectando el clima.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#fff200', marginTop: 2 }}>🌡️</span>
              <span><strong>Cambios climáticos:</strong> Descenso de temperaturas y alteraciones en los patrones de lluvia durante meses o años.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#00bcd4', marginTop: 2 }}>🦖</span>
              <span><strong>Extinciones masivas:</strong> La vida animal y vegetal puede verse gravemente afectada, como ocurrió con los dinosaurios.</span>
            </li>
            <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, color: '#7c4dff', marginTop: 2 }}>🌎</span>
              <span><strong>Terremoto generado:</strong> Magnitud estimada <strong>{earthquakeMag?.toFixed(1)}</strong> en la escala Richter (por la energía liberada).</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
};

export default MapImpact;
