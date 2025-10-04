import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";


// Utilidad para convertir lat/lng a coordenadas cartesianas
function latLngToCartesian(lat, lng, radius = 1) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = lng * (Math.PI / 180);
  return [
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  ];
}


// Componente para la esfera con textura de la Tierra
function DeformedGlobe({ selectedLat, selectedLng, impactLat, impactLng, craterRadius, craterDepth, showCrater, onSphereClick }) {
  const meshRef = useRef();
  // Cargar textura de la Tierra usando useLoader para asegurar actualización
  const earthTexture = useLoader(THREE.TextureLoader, 'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg');
  // Geometría simple sin deformación
  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(1, 64, 64);
  }, []);

  // Función auxiliar para crear un anillo
  const createRing = (centerLat, centerLng, radius) => {
    const points = [];
    const steps = 64;
    const phi0 = (90 - centerLat) * Math.PI / 180;
    const theta0 = centerLng * Math.PI / 180;
    for (let i = 0; i <= steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const localX = Math.cos(angle) * radius;
      const localY = Math.sin(angle) * radius;
      const eastX = -Math.sin(theta0);
      const eastY = 0;
      const eastZ = Math.cos(theta0);
      const northX = -Math.cos(phi0) * Math.cos(theta0);
      const northY = Math.sin(phi0);
      const northZ = -Math.cos(phi0) * Math.sin(theta0);
      const [centerX, centerY, centerZ] = latLngToCartesian(centerLat, centerLng, 1);
      const px = centerX + localX * eastX + localY * northX;
      const py = centerY + localX * eastY + localY * northY;
      const pz = centerZ + localX * eastZ + localY * northZ;
      const len = Math.sqrt(px * px + py * py + pz * pz);
      points.push(new THREE.Vector3(px / len, py / len, pz / len));
    }
    return points;
  };

  // Anillos concéntricos del cráter con diferentes zonas de daño (solo si showCrater)
  const craterRings = useMemo(() => {
    if (!showCrater || impactLat == null || impactLng == null || craterRadius == null) return null;
    // Diferentes zonas de impacto basadas en física de impactos
    return [
      // Zona de vaporización (0.1x) - todo se vaporiza instantáneamente
      { 
        points: createRing(impactLat, impactLng, craterRadius * 0.1), 
        color: '#ffff00', 
        opacity: 1.0,
        label: 'Vaporización'
      },
      // Zona de fusión (0.3x) - rocas fundidas
      { 
        points: createRing(impactLat, impactLng, craterRadius * 0.3), 
        color: '#ff8800', 
        opacity: 0.95,
        label: 'Fusión'
      },
      // Zona del cráter principal (1x) - excavación directa
      { 
        points: createRing(impactLat, impactLng, craterRadius), 
        color: '#ff0000', 
        opacity: 0.9,
        label: 'Cráter'
      },
      // Zona de eyección de material (2x) - escombros y material expulsado
      { 
        points: createRing(impactLat, impactLng, craterRadius * 2), 
        color: '#cc0000', 
        opacity: 0.7,
        label: 'Eyección'
      },
      // Zona de terremotos severos (4x) - daño estructural masivo
      { 
        points: createRing(impactLat, impactLng, craterRadius * 4), 
        color: '#aa00ff', 
        opacity: 0.6,
        label: 'Terremotos severos'
      },
      // Zona de ondas sísmicas (8x) - terremotos moderados
      { 
        points: createRing(impactLat, impactLng, craterRadius * 8), 
        color: '#4488ff', 
        opacity: 0.5,
        label: 'Ondas sísmicas'
      },
      // Zona de efectos atmosféricos (12x) - onda de choque atmosférica
      { 
        points: createRing(impactLat, impactLng, craterRadius * 12), 
        color: '#88ccff', 
        opacity: 0.4,
        label: 'Onda de choque'
      }
    ];
  }, [impactLat, impactLng, craterRadius, showCrater]);

  // Marcador del punto seleccionado (si existe y NO se ha impactado aún)
  const selectedMarker = useMemo(() => {
    if (selectedLat == null || selectedLng == null || showCrater) return null;
    const [x, y, z] = latLngToCartesian(selectedLat, selectedLng, 1.01);
    return <mesh position={[x, y, z]} key={`marker-${selectedLat}-${selectedLng}`}>
      <sphereGeometry args={[0.012, 16, 16]} />
      <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={0.8} />
    </mesh>;
  }, [selectedLat, selectedLng, showCrater]);

  // Epicentro del impacto (si showCrater)
  const impactEpicenter = useMemo(() => {
    if (!showCrater || impactLat == null || impactLng == null) return null;
    const [x, y, z] = latLngToCartesian(impactLat, impactLng, 1.012);
    return <mesh position={[x, y, z]} key={`epicenter-${impactLat}-${impactLng}`}>
      <sphereGeometry args={[0.004, 12, 12]} />
      <meshStandardMaterial color="#ffffff" emissive="#ff0000" emissiveIntensity={2.0} />
    </mesh>;
  }, [impactLat, impactLng, showCrater]);

  // Rotación automática desactivada

  // Click handler para la esfera
  const handlePointerDown = (e) => {
    if (!onSphereClick || showCrater) return; // No permitir clics después de impactar
    // Convertir coordenadas del punto clicado a lat/lng
    const { x, y, z } = e.point;
    const r = Math.sqrt(x * x + y * y + z * z);
    const lat = 90 - (Math.acos(y / r) * 180) / Math.PI;
    const lng = (Math.atan2(z, x) * 180) / Math.PI;
    onSphereClick({ lat, lng });
  };

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} onPointerDown={handlePointerDown}>
        <meshStandardMaterial map={earthTexture} />
      </mesh>
      {/* Marcador del punto seleccionado */}
      {selectedMarker}
      {/* Epicentro del impacto */}
      {impactEpicenter}
      {/* Anillos concéntricos del cráter */}
      {craterRings && craterRings.map((ring, idx) => (
        <line key={`ring-${idx}-${ring.points.map(p => p.x).join(',')}`}>
          <bufferGeometry attach="geometry">
            <bufferAttribute
              attach="attributes-position"
              count={ring.points.length}
              array={new Float32Array(ring.points.flatMap(v => [v.x, v.y, v.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial attach="material" color={ring.color} transparent opacity={ring.opacity} linewidth={2} />
        </line>
      ))}
    </group>
  );
}

const GlobeDeform = ({ selectedLat, selectedLng, impactLat, impactLng, craterRadiusKm, showCrater, onSphereClick }) => {
  // Ajustar radio y profundidad del cráter visual
  const craterRadius = craterRadiusKm ? craterRadiusKm / 6371 : 0.1; // 6371 km = radio Tierra
  const craterDepth = craterRadius * 0.5;

  // Leyenda de zonas de impacto
  const impactZones = [
    { color: '#ffff00', label: 'Vaporización', description: 'Todo se vaporiza instantáneamente' },
    { color: '#ff8800', label: 'Fusión', description: 'Rocas fundidas, temperaturas extremas' },
    { color: '#ff0000', label: 'Cráter', description: 'Excavación directa del impacto' },
    { color: '#cc0000', label: 'Eyección', description: 'Material expulsado y escombros' },
    { color: '#aa00ff', label: 'Terremotos severos', description: 'Daño estructural masivo' },
    { color: '#4488ff', label: 'Ondas sísmicas', description: 'Terremotos moderados' },
    { color: '#88ccff', label: 'Onda de choque', description: 'Efectos atmosféricos' }
  ];

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ width: "100%", height: "100%", position: 'relative' }}>
        <Canvas camera={{ position: [0, 0, 2.5] }} style={{ background: '#0d133d' }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 5, 5]} intensity={0.7} />
          <Stars radius={10} depth={50} count={5000} factor={4} saturation={0.5} fade speed={1} />
          <DeformedGlobe 
            selectedLat={selectedLat} 
            selectedLng={selectedLng} 
            impactLat={impactLat} 
            impactLng={impactLng} 
            craterRadius={craterRadius} 
            craterDepth={craterDepth} 
            showCrater={showCrater} 
            onSphereClick={onSphereClick} 
          />
          <OrbitControls 
            enablePan={false} 
            enableZoom={true} 
            minDistance={1.2} 
            maxDistance={5} 
            target={[0, 0, 0]}
          />
        </Canvas>
      </div>
      {/* Leyenda de zonas de impacto - posicionada a la derecha */}
      {showCrater && (
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
      )}
    </div>
  );
};

export default GlobeDeform;
