import React, { useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";


// Utilidad para convertir lat/lng a coordenadas cartesianas
function latLngToCartesian(lat, lng, radius = 5) { // Radio 5 para coincidir con la esfera
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
  const { gl } = useThree();
  const meshRef = useRef();
  // Cargar textura de la Tierra usando useLoader para asegurar actualización
  // Textura daylight 8K local (sin CORS)
  const earthTexture = useLoader(THREE.TextureLoader, '/earth_8k.jpg');
  // Mejorar calidad de textura: anisotropía máxima y filtros
  React.useEffect(() => {
    if (earthTexture && gl) {
      earthTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
      earthTexture.minFilter = THREE.LinearMipMapLinearFilter;
      earthTexture.magFilter = THREE.LinearFilter;
      earthTexture.needsUpdate = true;
    }
  }, [earthTexture, gl]);
  // Geometría simple sin deformación
  const geometry = useMemo(() => {
    // Aumentar la segmentación para mayor detalle y hacer la esfera más grande
    return new THREE.SphereGeometry(5, 128, 128); // Radio 5
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
      const [centerX, centerY, centerZ] = latLngToCartesian(centerLat, centerLng, 5);
      const px = centerX + localX * eastX + localY * northX;
      const py = centerY + localX * eastY + localY * northY;
      const pz = centerZ + localX * eastZ + localY * northZ;
      const len = Math.sqrt(px * px + py * py + pz * pz);
      points.push(new THREE.Vector3(px / len, py / len, pz / len));
    }
    return points;
  };


  // Parámetros de zonas de impacto (radio relativo, color, opacidad, delay inicio, duración)
  const impactZones = [
    { relRadius: 0.1, color: '#ffff00', opacity: 1.0, delay: 0.0, duration: 0.3 }, // Vaporización (inmediato)
    { relRadius: 0.3, color: '#ff8800', opacity: 0.95, delay: 0.1, duration: 0.4 }, // Fusión
    { relRadius: 1.0, color: '#ff0000', opacity: 0.9, delay: 0.2, duration: 0.5 }, // Cráter
    { relRadius: 2.0, color: '#cc0000', opacity: 0.7, delay: 0.3, duration: 0.6 }, // Eyección
    { relRadius: 4.0, color: '#aa00ff', opacity: 0.6, delay: 0.4, duration: 0.7 }, // Terremotos severos
    { relRadius: 8.0, color: '#4488ff', opacity: 0.5, delay: 0.5, duration: 0.8 }, // Ondas sísmicas
    { relRadius: 12.0, color: '#88ccff', opacity: 0.4, delay: 0.6, duration: 0.9 }, // Onda de choque
  ];

  // Estado de animación (progreso de expansión)
  const [impactAnim, setImpactAnim] = useState(0);
  useFrame((_, delta) => {
    if (showCrater && impactAnim < 1) {
      setImpactAnim(a => Math.min(1, a + delta * 0.25)); // velocidad global
    } else if (!showCrater && impactAnim !== 0) {
      setImpactAnim(0); // reset si se resetea el impacto
    }
  });

  // Renderizar gradientes animados (versión anterior, anillos y discos sobre la esfera, animación radial)
  // Utilidad para crear un disco (patch) sobre la esfera
  const createSphericalDisk = useMemo(() => {
    return (lat, lng, radius, segments) => {
      const center = latLngToCartesian(lat, lng, 5.005); // Ajustado para esfera de radio 5
      const normal = new THREE.Vector3(...center).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const axis = new THREE.Vector3().crossVectors(up, normal).normalize();
      const angle = Math.acos(up.dot(normal));
      const vertices = [];
      // Centro
      vertices.push(...center);
      for (let i = 0; i <= segments; i++) {
        const theta = (2 * Math.PI * i) / segments;
        // Coordenadas locales en plano tangente
        let v = new THREE.Vector3(
          Math.sin(theta) * radius,
          0,
          Math.cos(theta) * radius
        );
        // Rotar al plano tangente
        if (axis.length() > 0.001) v.applyAxisAngle(axis, angle);
        // Trasladar al centro
        v.add(new THREE.Vector3(...center));
        vertices.push(v.x, v.y, v.z);
      }
      // Índices
      const indices = [];
      for (let i = 1; i <= segments; i++) {
        indices.push(0, i, i + 1);
      }
      return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
    };
  }, []);

  const gradMeshes = useMemo(() => {
    if (!showCrater || impactLat == null || impactLng == null || craterRadius == null) return null;
    const segments = 64;
    return impactZones.map((zone, idx) => {
      // Animación: cada zona comienza después de un delay y se expande durante una duración
      const localTime = Math.max(0, (impactAnim - zone.delay) / zone.duration);
      const t = Math.min(1, localTime); // normalizar a 0-1
      
      // No renderizar si aún no ha comenzado esta zona
      if (impactAnim < zone.delay) return null;
      
      // Los círculos empiezan con un tamaño del 5% y crecen hasta el 100%
      const radiusStart = 0.05; // 5% del tamaño final
      const radiusFinal = 1.0;   // 100% del tamaño final
      const radiusFactor = radiusStart + (radiusFinal - radiusStart) * t;
      const radius = craterRadius * zone.relRadius * radiusFactor;
      
      const patch = createSphericalDisk(impactLat, impactLng, radius, segments);
      return (
        <mesh key={zone.color+idx}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={patch.vertices} count={patch.vertices.length/3} itemSize={3} />
            <bufferAttribute attach="index" array={patch.indices} count={patch.indices.length} itemSize={1} />
          </bufferGeometry>
          <meshBasicMaterial color={zone.color} transparent opacity={zone.opacity * (1-t*0.5)} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      );
    });
  }, [showCrater, impactLat, impactLng, craterRadius, impactAnim, createSphericalDisk]);

  // Marcador del punto seleccionado (si existe y NO se ha impactado aún)
  const selectedMarker = useMemo(() => {
    if (selectedLat == null || selectedLng == null || showCrater) return null;
    const [x, y, z] = latLngToCartesian(selectedLat, selectedLng, 5.05); // Ajustado para esfera de radio 5
    return <mesh position={[x, y, z]} key={`marker-${selectedLat}-${selectedLng}`}>
      <sphereGeometry args={[0.06, 16, 16]} /> {/* Tamaño ajustado 5x */}
      <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={0.8} />
    </mesh>;
  }, [selectedLat, selectedLng, showCrater]);


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
  {/* Gradientes animados del impacto */}
  {gradMeshes}
    </group>
  );
}


const GlobeDeform = ({ selectedLat, selectedLng, impactLat, impactLng, craterRadiusKm, showCrater, onSphereClick }) => {
  // Ajustar radio del cráter a escala real y multiplicar por 5 para la esfera más grande
  const craterRadius = craterRadiusKm ? (craterRadiusKm / 6371) * 5 : 0.5; // 6371 km = radio Tierra, x5 por escala de esfera
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
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 12.5] }} style={{ background: '#0d133d', width: '100%', height: '100%' }} dpr={[1, 2]}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        <ambientLight intensity={0.5} color={0xffffff} />
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
          minDistance={5.1}  // Zoom hasta la superficie de la esfera (radio 5)
          maxDistance={25}   // Zoom alejado proporcionalmente
          target={[0, 0, 0]}
        />
      </Canvas>
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
