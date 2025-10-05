

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
    label: "Comet (Ice)",
    factor: 0.5,
    info: `Approximate composition:
- H2O: 70%
- CO2: 15%
- CH4 + NH3: 5%
- Dust and minerals: 10%

Characteristics:
- Density: 500–1500 kg/m³
- Porous and fragile, disintegrates easily
- Origin: Oort Cloud / Kuiper Belt
- Visual on entry: greenish-blue brightness, early fragmentation, short trails
- Associated phenomena: meteor showers, sublimation near the Sun`
    ,
    image: "https://content.nationalgeographic.com.es/medio/2023/03/09/cometa-c2023-a3_5224887f_1280_230309094606_1200x630.jpg"
  },
  rock: {
    label: "Rocky Asteroid",
    factor: 1,
    info: `Approximate composition:
- Silicates (olivine, pyroxene): 80%
- Minor metals: 5–10%
- Sulfides: 5%
- Other minerals: 5–10%

Characteristics:
- Density: 2500–3500 kg/m³
- Resistant, partially fragments on atmospheric entry
- Origin: main asteroid belt
- Visual on entry: orange/reddish glow, fragmented trails
- Associated phenomenon: bright fireballs, chondrite meteorites common`
    ,
    image: "https://media.istockphoto.com/id/1222035078/es/vector/cometa-realista-meteorito-un-asteroide-en-movimiento-arde-contra-el-fondo-del-espacio.jpg?s=612x612&w=0&k=20&c=xEaOmevyMosgmX3ka5iWzjFdXTodgfzxu541DS_8peU="
  },
  metal: {
    label: "Metallic Asteroid",
    factor: 2,
    info: `Approximate composition:
- Iron (Fe): 85–90%
- Nickel (Ni): 5–10%
- Other metals: 5%

Characteristics:
- Density: 3500–6000 kg/m³
- Very resistant, survives mostly intact
- Origin: cores of destroyed planetesimals
- Visual on entry: intense white-blue, red incandescence on fragmentation
- Associated phenomenon: metallic meteorites, high impact energy`
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
  const [entryAngle, setEntryAngle] = useLocalState(45); // degrees from horizontal

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


  // State for pre-selection and impact confirmation
  const [selectedLat, setSelectedLat] = useLocalState(null);
  const [selectedLng, setSelectedLng] = useLocalState(null);
  const [impactLat, setImpactLat] = useLocalState(null);
  const [impactLng, setImpactLng] = useLocalState(null);
  const [impacted, setImpacted] = useLocalState(false);
  const [view, setView] = useState('3d'); // '3d' or '2d'
  // State for iris animation
  const [irisOpen, setIrisOpen] = useState(true); // true = circle open (content visible)
  const [irisTargetView, setIrisTargetView] = useState('3d'); // view to change to after closing iris

  // Calculate crater radius in km
  const craterRadiusKm = Math.max(0.5, Math.cbrt(energyMt) * 1.8); // same factor as before, but in km

  // For react-three-fiber, click can be handled with external input or custom controls
  function handleGlobeClick(e) {
    // e = {lat, lng} expected, but for mockup we'll use manual input
    // Here you could implement an input to select the impact point
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
              Material type:
            </label>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Styled select */}
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
                  appearance: "none", // removes default arrow
                  cursor: "pointer"
                }}
              >
                {Object.entries(MATERIALS).map(([key, mat]) => (
                  <option key={key} value={key}>
                    {mat.label}
                  </option>
                ))}
              </select>

              {/* Separate info button */}
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
                title="More information"
              >
                ℹ️
              </button>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
              Density adjustment (Ice → Rocky → Metal):
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
                setDensity(BASE_DENSITY * factor); // also updates density
              }}
              style={{ width: "100%" }}
            />
            <div style={{ fontSize: 12, marginTop: 4, textAlign: "center", color: "#7c4dff" }}>
              {Math.round(density)} kg/m³
            </div>
          </div>
          
          {/* Entry angle */}
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
              Entry angle: <strong style={{ color: '#7c4dff' }}>{entryAngle}°</strong>
            </label>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={entryAngle}
              onChange={e => setEntryAngle(Number(e.target.value))}
              style={{ width: "100%" }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.7, marginTop: 2 }}>
              <span>Grazing (10°)</span>
              <span>Vertical (90°)</span>
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
              // Animation: close iris, then change view and open
              setIrisOpen(false);
              setIrisTargetView('2d');
              setTimeout(() => {
                setImpactLat(selectedLat);
                setImpactLng(selectedLng);
                setImpacted(true);
                setView('2d');
                setIrisOpen(true);
              }, 700); // Must match IrisTransition duration
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
            }}>IMPACT</button>
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
            }}>Reset</button>
          )}
        </div>
      </div>
      {/* Main visual area: globe/map with iris transition */}
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
              diameter={diameter}
              velocity={velocity}
              density={density}
              entryAngle={entryAngle}
              energyMt={energyMt}
              initialLat={impactLat}
              initialLng={impactLng != null ? -impactLng : null}
            />
          )}
        </IrisTransition>


        {/* Meteorite info modal */}
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
              onClick={e => e.stopPropagation()} // prevents closing when clicking inside
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
              {/* X button */}
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
                title="Close"
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
