// --- Cálculos físicos de consecuencias ---
// Magnitud de terremoto (Richter) a partir de energía en megatones
function calculateEarthquakeMagnitude(energyMt) {
  // E (J) = Mt * 4.184e15
  const E = energyMt * 4.184e15;
  return (2/3) * Math.log10(E) - 3.2;
}

// Presión máxima de onda de choque en el epicentro (kPa)
// Aproximación: Pmax ≈ 0.28 * (Ekt / R^3)^0.72, R en km, Ekt en kilotones
function calculateAirBlastPressureKPa(energyMt, distanceKm) {
  const Ekt = energyMt * 1000; // Mt a kt
  const R = Math.max(distanceKm, 0.01); // evitar división por cero
  return 0.28 * Math.pow(Ekt / (R*R*R), 0.72);
}

import React, { useState, useEffect } from "react";
import { energyToMagnitude, findSimilarEarthquakes } from '../../../earthquakeEnergyService';
import { MapContainer, TileLayer, Marker, Circle, LayersControl, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

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

// Parámetros de zonas de impacto (radio relativo, color, opacidad, label, descripción)
const impactZones = [
  { relRadius: 0.1, color: '#fff200', opacity: 1.0, label: 'Vaporización', description: 'Todo se vaporiza instantáneamente' },
  { relRadius: 0.3, color: '#ff9800', opacity: 0.95, label: 'Fusión', description: 'Rocas fundidas, temperaturas extremas' },
  { relRadius: 1.0, color: '#ff3d00', opacity: 0.9, label: 'Cráter', description: 'Excavación directa del impacto' },
  { relRadius: 2.0, color: '#d500f9', opacity: 0.7, label: 'Eyección', description: 'Material expulsado y escombros' },
  { relRadius: 4.0, color: '#00e676', opacity: 0.6, label: 'Terremotos severos', description: 'Daño estructural masivo' },
  { relRadius: 8.0, color: '#2979ff', opacity: 0.5, label: 'Ondas sísmicas', description: 'Terremotos moderados' },
  { relRadius: 12.0, color: '#00bcd4', opacity: 0.4, label: 'Onda de choque', description: 'Efectos atmosféricos' }
];

// Fórmula para radio del cráter base (en km) según energía (megatones)
function calculateCraterRadiusKm(energyMt) {
  // Relación empírica: radio (km) ≈ 1.8 * (E)^(1/3)
  return 1.8 * Math.cbrt(energyMt);
}

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
const DEFAULT_ENERGY_MT = 10; // 10 megatones (ejemplo)

const MapImpact = ({ energyMt = DEFAULT_ENERGY_MT, initialLat, initialLng }) => {
  const [impactPos, setImpactPos] = useState(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null
  );

  const craterRadiusKm = calculateCraterRadiusKm(energyMt);
  // Usar la fórmula oficial para magnitud equivalente
  const earthquakeMag = energyToMagnitude(energyMt * 4.184e15); // Mt a julios
  console.log('Calculated earthquake magnitude:', earthquakeMag);
  // Presión máxima en el borde del cráter (zona de vaporización)
  const airPressureEpicenter = calculateAirBlastPressureKPa(energyMt, craterRadiusKm * impactZones[0].relRadius);

  // Estado para terremotos reales equivalentes
  const [similarQuakes, setSimilarQuakes] = useState([]);
  useEffect(() => {
    let cancelled = false;
    async function fetchQuakes() {
      if (!earthquakeMag || isNaN(earthquakeMag)) return setSimilarQuakes([]);
      const quakes = await findSimilarEarthquakes(earthquakeMag, 0.15, 3);
      if (!cancelled) setSimilarQuakes(quakes);
    }
    fetchQuakes();
    return () => { cancelled = true; };
  }, [earthquakeMag]);

  // Radio del círculo más grande (última zona)
  const maxZone = impactZones[impactZones.length - 1];
  const maxRadiusMeters = craterRadiusKm * maxZone.relRadius * 1000;

  // Estado para mostrar/ocultar todas las zonas
  const [showAllZones, setShowAllZones] = useState(true);
  // Estado para overlays individuales (siempre en el mismo orden)
  const [zoneVisibility, setZoneVisibility] = useState(
    impactZones.map(() => true)
  );

  // Cuando se activa "Todas las zonas", todos los overlays individuales se activan
  useEffect(() => {
    if (showAllZones) {
      setZoneVisibility(impactZones.map(() => true));
    }
  }, [showAllZones]);

  // Si se desactiva "Todas las zonas", oculta todos los círculos
  const visibleZones = showAllZones ? zoneVisibility : impactZones.map(() => false);

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
        {/* Ajusta el zoom al círculo más grande */}
        {impactPos && <FitCircleBounds center={impactPos} radiusMeters={maxRadiusMeters} />}
        {/* Renderizar círculos de mayor a menor radio para que los pequeños queden encima */}
        {impactPos && impactZones
          .map((zone, idx) => ({ zone, idx, r: craterRadiusKm * zone.relRadius * 1000 }))
          .filter(({ idx }) => visibleZones[idx])
          .sort((a, b) => b.r - a.r) // mayor a menor radio (grandes primero, atrás)
          .map(({ zone, idx, r }) => (
            <Circle
              key={`circle-${idx}`}
              center={impactPos}
              radius={r}
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
      {/* Panel de control de capas personalizado */}
      {impactPos && (
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
                {impactZones.map((zone, idx) => (
                  <label 
                    key={idx}
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
                      checked={visibleZones[idx]}
                      disabled={!showAllZones}
                      onChange={(e) => {
                        const newVis = [...zoneVisibility];
                        newVis[idx] = e.target.checked;
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
      {/* Cuadro de datos físicos abajo a la derecha */}
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
          padding: '8px 12px',
          minWidth: 260,
          maxWidth: '90vw',
          color: '#e0e7ff',
          fontSize: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'flex-start',
          pointerEvents: 'auto',
          transition: 'all 0.2s'
        }}>
          <div style={{ fontWeight: 700, color: '#7c4dff', fontSize: 15, marginBottom: 2, letterSpacing: 0.2 }}>Datos del Impacto</div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>
            <span style={{ color: '#fff200', fontWeight: 700 }}>Energía:</span> {energyMt.toLocaleString()} Mt
          </div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>
            <span style={{ color: '#ff3d00', fontWeight: 700 }}>Magnitud terremoto:</span> {earthquakeMag?.toFixed(1)}
          </div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>
            <span style={{ color: '#00e7ff', fontWeight: 700 }}>Presión máx.:</span> {airPressureEpicenter.toFixed(1)} kPa <span style={{ color: '#b2f7ef', fontWeight: 500 }}>({(airPressureEpicenter/101.3).toFixed(2)} atm)</span>
          </div>
          {similarQuakes.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 13, color: '#b2f7ef' }}>
              <div style={{ fontWeight: 600, color: '#7c4dff', marginBottom: 2 }}>Ejemplos reales:</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {similarQuakes.map(q => (
                  <li key={q.id} style={{ marginBottom: 2 }}>
                    <a href={q.url} target="_blank" rel="noopener noreferrer" style={{ color: '#fff200', textDecoration: 'underline', fontWeight: 500 }}>
                      {q.place || 'Terremoto'}
                    </a>{' '}
                    <span style={{ color: '#ff3d00', fontWeight: 600 }}>M{q.magnitude}</span>{' '}
                    <span style={{ color: '#b2f7ef' }}>({new Date(q.time).getFullYear()})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {/* Leyenda de zonas de impacto arrastrable */}
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
          ⠿ Zonas de Impacto
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {impactZones.map((zone, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
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
      </div>
      <div style={{ marginTop: 16, color: "#e0e7ff", textAlign: "center" }}>
        <p>Haz click en el mapa para seleccionar el epicentro del impacto.</p>
        {impactPos && (
          <p>
            Radio estimado del cráter: <strong>{craterRadiusKm.toFixed(2)} km</strong> (Energía: {energyMt} Mt)
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
            <span><strong>Ondas de choque y vientos extremos:</strong> El aire es desplazado violentamente, causando destrucción a gran distancia. <br />
              <span style={{ fontSize: 13, color: '#b2f7ef' }}>Presión máxima en el epicentro: <strong>{airPressureEpicenter.toFixed(1)} kPa</strong> ({(airPressureEpicenter/101.3).toFixed(2)} atm)</span>
            </span>
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
      </div>
    </div>
  );
};

export default MapImpact;
