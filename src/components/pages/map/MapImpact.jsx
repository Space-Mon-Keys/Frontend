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
import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
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
import "leaflet/dist/leaflet.css";

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
  const earthquakeMag = calculateEarthquakeMagnitude(energyMt);
  // Presión máxima en el borde del cráter (zona de vaporización)
  const airPressureEpicenter = calculateAirBlastPressureKPa(energyMt, craterRadiusKm * impactZones[0].relRadius);

  // Radio del círculo más grande (última zona)
  const maxZone = impactZones[impactZones.length - 1];
  const maxRadiusMeters = craterRadiusKm * maxZone.relRadius * 1000;

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
        {/* Dibuja los círculos de mayor a menor para que los pequeños queden encima */}
        {impactPos && [...impactZones].reverse().map((zone, idx) => (
          <Circle
            key={zone.color+idx}
            center={impactPos}
            radius={craterRadiusKm * zone.relRadius * 1000} // km a metros
            pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: zone.opacity, weight: 2 }}
          />
        ))}
      </MapContainer>
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
            <span style={{ color: '#ff3d00', fontWeight: 700 }}>Magnitud terremoto:</span> {earthquakeMag.toFixed(1)}
          </div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>
            <span style={{ color: '#00e7ff', fontWeight: 700 }}>Presión máx.:</span> {airPressureEpicenter.toFixed(1)} kPa <span style={{ color: '#b2f7ef', fontWeight: 500 }}>({(airPressureEpicenter/101.3).toFixed(2)} atm)</span>
          </div>
        </div>
      )}
      {/* Leyenda de zonas de impacto */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 2000,
        maxWidth: 280,
        margin: '16px auto',
        padding: '12px',
        background: 'rgba(20,20,40,0.9)',
        borderRadius: 8,
        border: '1px solid rgba(124,77,255,0.3)'
      }}>
        <h4 style={{ color: '#7c4dff', marginTop: 0, marginBottom: 12, fontSize: 14 }}>Zonas de Impacto</h4>
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
            <span><strong>Terremoto generado:</strong> Magnitud estimada <strong>{earthquakeMag.toFixed(1)}</strong> en la escala Richter (por la energía liberada).</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default MapImpact;