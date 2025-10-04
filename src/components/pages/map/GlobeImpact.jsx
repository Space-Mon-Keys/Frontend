import React, { useRef, useEffect } from "react";
import Globe from "react-globe.gl";
// import * as THREE from "three";

// Utilidad para calcular la "depresión" del cráter
function getCraterPoints(lat, lng, radiusKm, depthKm = 0.5) {
  // Genera puntos para un círculo de depresión en la superficie
  // Solo para visualización, no física real
  const points = [];
  const steps = 64;
  for (let i = 0; i < steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    const dLat = (radiusKm / 111) * Math.cos(angle); // 1 deg lat ~ 111km
    const dLng = (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    points.push({
      lat: lat + dLat,
      lng: lng + dLng,
      alt: -depthKm // Depresión
    });
  }
  return points;
}


const DEFAULT_CENTER = { lat: 20, lng: 0, altitude: 2 };


const GlobeImpact = ({ impactLat, impactLng, craterRadiusKm, onGlobeClick }) => {
  const globeEl = useRef();

  // Simula la depresión del cráter como un anillo de puntos
  const craterPoints =
    impactLat && impactLng && craterRadiusKm
      ? getCraterPoints(impactLat, impactLng, craterRadiusKm)
      : [];



  // Centrar el globo al inicio (solo una vez)
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.pointOfView(DEFAULT_CENTER, 0);
    }
  }, []);

  // Centrar el globo al seleccionar impacto
  useEffect(() => {
    if (globeEl.current) {
      if (impactLat && impactLng) {
        globeEl.current.pointOfView({ lat: impactLat, lng: impactLng, altitude: 2 }, 1000);
      }
    }
  }, [impactLat, impactLng]);

  // Handler para clic en el globo
  function handleGlobeClick(event) {
    if (onGlobeClick && event && event.lat && event.lng) {
      onGlobeClick({ lat: event.lat, lng: event.lng });
    }
  }



  return (
    <div style={{ width: "100%", maxWidth: 600, aspectRatio: '1.2', margin: "0 auto", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', height: 400, maxWidth: 600, minWidth: 320, position: 'relative' }}>
        <Globe
          ref={globeEl}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          backgroundColor="#0d133d"
          width={600}
          height={400}
          pointsData={craterPoints}
          pointLat={d => d.lat}
          pointLng={d => d.lng}
          pointAltitude={d => d.alt}
          pointColor={() => "#7c4dff"}
          pointRadius={0.15}
          onGlobeClick={handleGlobeClick}
        />
      </div>
      <div style={{ color: "#e0e7ff", textAlign: "center", marginTop: 12 }}>
        {impactLat && impactLng ? (
          <>
            <p>Impact location: {impactLat.toFixed(2)}, {impactLng.toFixed(2)}</p>
            <p>Crater radius: {craterRadiusKm.toFixed(2)} km</p>
          </>
        ) : (
          <p>Click on the globe to select the impact location.</p>
        )}
      </div>
    </div>
  );
};

export default GlobeImpact;
