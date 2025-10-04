

import React, { useState } from 'react';
import IrisTransition from '../../IrisTransition';
// import Scenarios from '../scenarios/Scenarios';
import GlobeDeform from '../map/GlobeDeform';
import MapImpact from '../map/MapImpact';
import { useState as useLocalState, useEffect } from 'react';
import './home.css';

const IMPACTS = {
  city: {
    title: 'City Impact',
    effect: 'Severe infrastructure damage, multiple injuries, possible collapse of services.'
  },
  countryside: {
    title: 'Countryside Impact',
    effect: 'Damage to crops, wildfires, low impact on population.'
  },
  ocean: {
    title: 'Ocean Impact',
    effect: 'Tsunami generation, risk for coastal areas.'
  }
};

const MATERIALS = {
  ice: {
    label: "Cometa (Hielo)",
    factor: 0.5,
    info: `Composición aproximada:
- H2O: 70%
- CO2: 15%
- CH4 + NH3: 5%
- Polvo y minerales: 10%

Características:
- Densidad: 500–1000 kg/m³
- Poroso y frágil, se desintegra con facilidad
- Origen: Nube de Oort / Cinturón de Kuiper
- Visual al entrar: brillo azul verdoso, fragmentación temprana, estelas cortas
- Fenómenos asociados: lluvias de meteoros, sublimación cerca del Sol`
    ,
    image: "https://content.nationalgeographic.com.es/medio/2023/03/09/cometa-c2023-a3_5224887f_1280_230309094606_1200x630.jpg"
  },
  rock: {
    label: "Asteroide Rocoso",
    factor: 1,
    info: `Composición aproximada:
- Silicatos (olivino, piroxeno): 80%
- Metales menores: 5–10%
- Sulfuros: 5%
- Otros minerales: 5–10%

Características:
- Densidad: 2500–3500 kg/m³
- Resistente, fragmenta parcialmente al entrar en la atmósfera
- Origen: cinturón principal de asteroides
- Visual al entrar: brillo anaranjado/rojizo, estelas fragmentadas
- Fenómeno asociado: bólidos brillantes, meteoritos condritas frecuentes`
    ,
    image: "https://media.istockphoto.com/id/1222035078/es/vector/cometa-realista-meteorito-un-asteroide-en-movimiento-arde-contra-el-fondo-del-espacio.jpg?s=612x612&w=0&k=20&c=xEaOmevyMosgmX3ka5iWzjFdXTodgfzxu541DS_8peU="
  },
  metal: {
    label: "Asteroide Metálico",
    factor: 2,
    info: `Composición aproximada:
- Hierro (Fe): 85–90%
- Níquel (Ni): 5–10%
- Otros metales: 5%

Características:
- Densidad: 7000–8000 kg/m³
- Muy resistente, sobrevive mayormente intacto
- Origen: núcleos de planetesimales destruidos
- Visual al entrar: blanco-azulado intenso, incandescencia roja en fragmentación
- Fenómeno asociado: meteoritos metálicos, alta energía de impacto`
    ,
    image: "https://www.elfinanciero.com.mx/resizer/v2/HNGAZOACPZGYTHTTOAUQTM3FHU.jpg?smart=true&auth=663b69256d2286554be98d1862f53f9e304de4fa4c56ee636456f3093f1cc0b8&width=400&height=225&quality=85"
  }
};

const BASE_DENSITY = 3000;

export default function Home() {
  // const [scenario, setScenario] = useState(null);

  // Asteroid parameters (default values)
  const [diameter, setDiameter] = useLocalState(100); // meters
  const [velocity, setVelocity] = useLocalState(20000); // m/s
  const [density, setDensity] = useLocalState(3000); // kg/m^3

  // NASA asteroid data
  const [asteroids, setAsteroids] = useLocalState([]);
  const [loadingAsteroids, setLoadingAsteroids] = useLocalState(false);
  const [asteroidError, setAsteroidError] = useLocalState(null);


  const [material, setMaterial] = useLocalState("rock");
  const [materialFactor, setMaterialFactor] = useLocalState(1);

  const [showModal, setShowModal] = useLocalState(false);
  const [modalMaterial, setModalMaterial] = useLocalState(null);
  useEffect(() => {
    setLoadingAsteroids(true);
    setAsteroidError(null);
    // Get today's date
    const today = new Date().toISOString().slice(0, 10);
    const apiKey = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY';
    fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&end_date=${today}&api_key=${apiKey}`)
      .then(res => res.json())
      .then(data => {
        // Flatten the NEOs into a single array
        let neos = [];
        if (data && data.near_earth_objects) {
          Object.values(data.near_earth_objects).forEach(arr => {
            if (Array.isArray(arr)) neos = neos.concat(arr);
          });
        }
        setAsteroids(neos);
        setLoadingAsteroids(false);
      })
      .catch(err => {
        setAsteroidError('Failed to load asteroids');
        setLoadingAsteroids(false);
      });
  }, []);

  function handleAsteroidSelect(e) {
    const idx = e.target.value;
    if (!asteroids[idx]) return;
    const a = asteroids[idx];
    // Diameter: use estimated_diameter.meters.estimated_diameter_max (or avg)
    const d = a.estimated_diameter.meters;
    setDiameter(Math.round((d.estimated_diameter_min + d.estimated_diameter_max) / 2));
    // Velocity: use close_approach_data[0].relative_velocity.kilometers_per_hour (convert to m/s)
    const v = a.close_approach_data[0]?.relative_velocity?.kilometers_per_hour;
    if (v) setVelocity(Math.round(Number(v) * 1000 / 3600));
    // Density: default 3000 kg/m³ (unless we want to estimate by type)
    setDensity(3000);
  }

  // Calculate impact energy (Joules)
  // E = 0.5 * m * v^2, m = (4/3) * pi * (d/2)^3 * density
  const radius = diameter / 2;
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  const mass = volume * density;
  const energyJ = 0.5 * mass * Math.pow(velocity, 2);
  const energyMt = energyJ / 4.184e15; // Convert to megatons TNT


  // Estado para selección previa y confirmación de impacto
  const [selectedLat, setSelectedLat] = useLocalState(null);
  const [selectedLng, setSelectedLng] = useLocalState(null);
  const [impactLat, setImpactLat] = useLocalState(null);
  const [impactLng, setImpactLng] = useLocalState(null);
  const [impacted, setImpacted] = useLocalState(false);
  const [view, setView] = useState('3d'); // '3d' o '2d'
  // Estado para animación de iris
  const [irisOpen, setIrisOpen] = useState(true); // true = círculo abierto (contenido visible)
  const [irisTargetView, setIrisTargetView] = useState('3d'); // vista a la que se cambiará tras cerrar iris

  // Calcular radio del cráter en km
  const craterRadiusKm = Math.max(0.5, Math.cbrt(energyMt) * 1.8); // mismo factor que antes, pero en km

  // Para react-three-fiber, el click se puede manejar con un input externo o con controles personalizados
  function handleGlobeClick(e) {
    // e = {lat, lng} esperado, pero para el mockup usaremos un input manual
    // Aquí podrías implementar un input para seleccionar el punto de impacto
  }

  return (
    <div className="impact-container" style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Panel flotante de parámetros SIEMPRE visible */}
      <div style={{
        position: 'absolute',
        top: 30,
        left: 50,
        zIndex: 2000, // más alto que el iris
        background: 'rgba(20, 20, 40, 0.95)',
        borderRadius: 12,
        padding: 16,
        maxWidth: 350,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(124, 77, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <h3 style={{ color: '#7c4dff', marginTop: 0, fontSize: 18 }}>Asteroid Parameters</h3>
        <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={e => e.preventDefault()}>
          <label style={{ fontSize: 13 }}>
            Select real asteroid:
            <select onChange={handleAsteroidSelect} style={{ marginLeft: 8, fontSize: 12, width: '100%', marginTop: 4 }} defaultValue="">
              <option value="">-- Choose from NASA NEOs --</option>
              {loadingAsteroids && <option>Loading...</option>}
              {asteroidError && <option disabled>{asteroidError}</option>}
              {asteroids.map((a, i) => (
                <option key={a.id} value={i}>
                  {a.name} (D: {Math.round((a.estimated_diameter.meters.estimated_diameter_min + a.estimated_diameter.meters.estimated_diameter_max) / 2)} m)
                </option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 13 }}>
            Diameter (m):
            <input type="number" min="1" value={diameter} onChange={e => setDiameter(Number(e.target.value))} style={{ marginLeft: 8, width: 100, fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 13 }}>
            Velocity (m/s):
            <input type="number" min="1" value={velocity} onChange={e => setVelocity(Number(e.target.value))} style={{ marginLeft: 8, width: 100, fontSize: 12 }} />
          </label>
          <label style={{ fontSize: 13 }}>
            Density (kg/m³):
            <input type="number" min="1" value={density} onChange={e => setDensity(Number(e.target.value))} style={{ marginLeft: 8, width: 100, fontSize: 12 }} />
          </label>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
              Tipo de material:
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Select estilizado */}
              <select
                value={material}
                onChange={e => {
                  const val = e.target.value;
                  setMaterial(val);
                  const factor = MATERIALS[val].factor;
                  setMaterialFactor(factor);
                  setDensity(BASE_DENSITY * factor);
                }}
                style={{
                  flex: 1,
                  fontSize: 12,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(124,77,255,0.5)",
                  background: "#1e1e2f",
                  color: "#fff",
                  appearance: "none", // quita flecha por defecto
                  cursor: "pointer"
                }}
              >
                {Object.entries(MATERIALS).map(([key, mat]) => (
                  <option key={key} value={key}>
                    {mat.label}
                  </option>
                ))}
              </select>

              {/* Botón info separado */}
              <button
                type="button"
                onClick={() => {
                  setModalMaterial(material);
                  setShowModal(true);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#7c4dff",
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0
                }}
                title="Más información"
              >
                ℹ️
              </button>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
              Ajuste densidad (Hielo → Rocoso → Metal):
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={materialFactor}
              onChange={e => {
                const factor = Number(e.target.value);
                setMaterialFactor(factor);
                setDensity(BASE_DENSITY * factor); // actualiza density también
              }}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 12, marginTop: 4, textAlign: "center", color: "#7c4dff" }}>
              {Math.round(density)} kg/m³
            </div>
          </div>
          <div style={{ marginTop: 8, padding: '8px', background: 'rgba(124, 77, 255, 0.2)', borderRadius: 6 }}>
            <strong style={{ fontSize: 13 }}>Impact energy:</strong>
            <div style={{ fontSize: 16, color: '#7c4dff', fontWeight: 'bold' }}>{energyMt.toLocaleString(undefined, { maximumFractionDigits: 2 })} Mt TNT</div>
          </div>
        </form>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(124, 77, 255, 0.3)' }}>
          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <label style={{ color: '#e0e7ff', display: 'block', marginBottom: 4 }}>Impact coordinates:</label>
            <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
              <div>
                <span style={{ opacity: 0.7 }}>Lat:</span>
                <input type="number" min={-90} max={90} value={selectedLat ?? ''} onChange={e => setSelectedLat(Number(e.target.value))} style={{ width: 60, marginLeft: 4, fontSize: 11 }} />
              </div>
              <div>
                <span style={{ opacity: 0.7 }}>Lng:</span>
                <input type="number" min={-180} max={180} value={selectedLng ?? ''} onChange={e => setSelectedLng(Number(e.target.value))} style={{ width: 60, marginLeft: 4, fontSize: 11 }} />
              </div>
            </div>
          </div>
          {selectedLat !== null && selectedLng !== null && !impacted && (
            <button onClick={() => {
              // Animación: cerrar iris, luego cambiar vista y abrir
              setIrisOpen(false);
              setIrisTargetView('2d');
              setTimeout(() => {
                setImpactLat(selectedLat);
                setImpactLng(selectedLng);
                setImpacted(true);
                setView('2d');
                setIrisOpen(true);
              }, 700); // Debe coincidir con duración de IrisTransition
            }} style={{
              width: '100%',
              padding: '10px 24px',
              fontSize: 16,
              background: 'linear-gradient(90deg, #7c4dff 0%, #00bcd4 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 'bold',
              marginTop: 8
            }}>IMPACTAR</button>
          )}
          {impacted && (
            <button onClick={() => {
              setIrisOpen(false);
              setIrisTargetView('3d');
              setTimeout(() => {
                setImpacted(false);
                setView('3d');
                setIrisOpen(true);
              }, 700);
            }} style={{
              width: '100%',
              padding: '8px 16px',
              fontSize: 13,
              background: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              marginTop: 8
            }}>Resetear</button>
          )}
        </div>
      </div>
      {/* Área visual principal: globo/mapa con transición iris */}
      <div style={{ width: '100%', height: '100vh', position: 'relative', overflow: 'hidden' }}>
        <IrisTransition
          in={irisOpen}
          duration={700}
          color="#181c24"
          style={{ position: 'absolute', inset: 0, zIndex: 1000 }}
        >
          {view === '3d' && (
            <GlobeDeform
              selectedLat={selectedLat}
              selectedLng={selectedLng}
              impactLat={impacted ? impactLat : null}
              impactLng={impacted ? impactLng : null}
              craterRadiusKm={craterRadiusKm}
              showCrater={impacted}
              onSphereClick={({ lat, lng }) => {
                setSelectedLat(lat);
                setSelectedLng(lng);
              }}
            />
          )}
          {view === '2d' && impacted && (
            <MapImpact
              energyMt={energyMt}
              // El centro y el marcador se pasan como props
              initialLat={impactLat}
              initialLng={impactLng != null ? -impactLng : null}
            />
          )}
        </IrisTransition>


        {/* Modal info meteoritos*/}
        {showModal && modalMaterial && (
          <div
            onClick={() => setShowModal(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1000
            }}
          >
            <div
              onClick={e => e.stopPropagation()} // evita cerrar al clicar dentro
              style={{
                background: "#1e1e2f",
                borderRadius: 12,
                padding: 20,
                maxWidth: 450,
                width: "90%",
                color: "#fff",
                boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
                position: "relative"
              }}
            >
              {/* Botón X */}
              <button
                onClick={() => setShowModal(false)}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontSize: 18,
                  cursor: "pointer",
                }}
                title="Cerrar"
              >
                ✖
              </button>

              <h3 style={{ color: "#7c4dff", marginBottom: 12 }}>{MATERIALS[modalMaterial].label}</h3>
              <img
                src={MATERIALS[modalMaterial].image}
                alt={MATERIALS[modalMaterial].label}
                style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 12 }}
              />
              <pre style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {MATERIALS[modalMaterial].info}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
