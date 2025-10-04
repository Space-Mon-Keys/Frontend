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

  // Radio del círculo más grande (última zona)
  const maxZone = impactZones[impactZones.length - 1];
  const maxRadiusMeters = craterRadiusKm * maxZone.relRadius * 1000;

  return (
    <div style={{ width: "100%", height: "100%", position: 'relative' }}>
      <MapContainer center={impactPos || DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: "100%", width: "100%", borderRadius: 16 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <LocationMarker onSelect={setImpactPos} position={impactPos} />
        {/* Ajusta el zoom al círculo más grande */}
        {impactPos && <FitCircleBounds center={impactPos} radiusMeters={maxRadiusMeters} />}
        {impactPos && impactZones.map((zone, idx) => (
          <Circle
            key={zone.color+idx}
            center={impactPos}
            radius={craterRadiusKm * zone.relRadius * 1000} // km a metros
            pathOptions={{ color: zone.color, fillColor: zone.color, fillOpacity: zone.opacity, weight: 2 }}
          />
        ))}
      </MapContainer>
      {/* Leyenda de zonas de impacto */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
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
    </div>
  );
};

export default MapImpact;