import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fórmula simple para el radio del cráter (en metros) según energía (megatones)
function calculateCraterRadius(energyMt) {
  // Relación empírica: radio (km) ≈ 1.8 * (E)^(1/3)
  return 1800 * Math.cbrt(energyMt); // en metros
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

const MapImpact = ({ energyMt = DEFAULT_ENERGY_MT }) => {
  const [impactPos, setImpactPos] = useState(null);
  const craterRadius = calculateCraterRadius(energyMt);

  return (
    <div style={{ width: "100%", maxWidth: 600, height: 400, margin: "0 auto" }}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: "100%", width: "100%", borderRadius: 16 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <LocationMarker onSelect={setImpactPos} position={impactPos} />
        {impactPos && (
          <Circle
            center={impactPos}
            radius={craterRadius}
            pathOptions={{ color: "#7c4dff", fillColor: "#7c4dff", fillOpacity: 0.3 }}
          />
        )}
      </MapContainer>
      <div style={{ marginTop: 16, color: "#e0e7ff", textAlign: "center" }}>
        <p>Click on the map to select the impact location.</p>
        {impactPos && (
          <p>
            Estimated crater radius: <strong>{(craterRadius / 1000).toFixed(2)} km</strong> (Energy: {energyMt} Mt)
          </p>
        )}
      </div>
    </div>
  );
};

export default MapImpact;