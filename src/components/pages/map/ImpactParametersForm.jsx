import React, { useState } from 'react';
import { MATERIAL_PRESETS } from '../../../services/neoEntryImpact';

/**
 * Formulario de parámetros de impacto NEO
 * @param {Object} props
 * @param {Function} props.onParamsChange - Callback cuando cambian los parámetros
 * @param {Object} props.initialParams - Parámetros iniciales
 */
const ImpactParametersForm = ({ onParamsChange, initialParams = {} }) => {
  const [params, setParams] = useState({
    vInfinity: initialParams.vInfinity || 15,
    diameter: initialParams.diameter || 50,
    material: initialParams.material || 'stony',
    entryAngle: initialParams.entryAngle || 45,
    ...initialParams
  });

  const [isExpanded, setIsExpanded] = useState(true);

  const handleChange = (field, value) => {
    const newParams = { ...params, [field]: value };
    setParams(newParams);
    if (onParamsChange) {
      onParamsChange(newParams);
    }
  };

  // Ejemplos predefinidos
  const presets = {
    tunguska: {
      name: 'Tunguska (1908)',
      vInfinity: 15,
      diameter: 50,
      material: 'stony',
      entryAngle: 45
    },
    chelyabinsk: {
      name: 'Chelyabinsk (2013)',
      vInfinity: 18,
      diameter: 20,
      material: 'stony',
      entryAngle: 18
    },
    smallIron: {
      name: 'Meteorito pequeño',
      vInfinity: 12,
      diameter: 2,
      material: 'iron',
      entryAngle: 60
    },
    largeComet: {
      name: 'Cometa grande',
      vInfinity: 25,
      diameter: 100,
      material: 'comet',
      entryAngle: 30
    },
    chicxulub: {
      name: 'Chicxulub (dinosaurios)',
      vInfinity: 20,
      diameter: 10000,
      material: 'stony',
      entryAngle: 45
    }
  };

  const applyPreset = (presetKey) => {
    const preset = presets[presetKey];
    const newParams = {
      vInfinity: preset.vInfinity,
      diameter: preset.diameter,
      material: preset.material,
      entryAngle: preset.entryAngle
    };
    setParams(newParams);
    if (onParamsChange) {
      onParamsChange(newParams);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      left: 20,
      zIndex: 2000,
      background: 'rgba(20,20,40,0.95)',
      borderRadius: 8,
      border: '2px solid #7c4dff',
      boxShadow: '0 4px 16px rgba(124,77,255,0.3)',
      padding: '12px',
      minWidth: isExpanded ? 300 : 'auto',
      maxWidth: 350,
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
        marginBottom: isExpanded ? 12 : 0,
        borderBottom: isExpanded ? '1px solid rgba(124,77,255,0.3)' : 'none',
        paddingBottom: isExpanded ? 8 : 0,
        transition: 'all 0.3s ease'
      }}>
        <span>⚙️ Parámetros NEO</span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
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
          title={isExpanded ? 'Minimizar' : 'Expandir'}
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Presets rápidos */}
          <div>
            <label style={{ fontSize: 12, color: '#b2f7ef', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              Ejemplos predefinidos:
            </label>
            <select
              onChange={(e) => e.target.value && applyPreset(e.target.value)}
              value=""
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'rgba(124,77,255,0.1)',
                border: '1px solid rgba(124,77,255,0.3)',
                borderRadius: 4,
                color: '#e0e7ff',
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <option value="">-- Seleccionar ejemplo --</option>
              {Object.entries(presets).map(([key, preset]) => (
                <option key={key} value={key}>{preset.name}</option>
              ))}
            </select>
          </div>

          <div style={{ borderTop: '1px solid rgba(124,77,255,0.2)', paddingTop: 12 }} />

          {/* Velocidad de exceso hiperbólico */}
          <div>
            <label style={{ fontSize: 12, color: '#b2f7ef', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              Velocidad v∞ (km/s):
            </label>
            <input
              type="number"
              min="5"
              max="75"
              step="0.5"
              value={params.vInfinity}
              onChange={(e) => handleChange('vInfinity', parseFloat(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'rgba(124,77,255,0.1)',
                border: '1px solid rgba(124,77,255,0.3)',
                borderRadius: 4,
                color: '#fff',
                fontSize: 14
              }}
            />
            <span style={{ fontSize: 11, color: '#b2f7ef', opacity: 0.7 }}>
              Típico: 12-25 km/s
            </span>
          </div>

          {/* Diámetro */}
          <div>
            <label style={{ fontSize: 12, color: '#b2f7ef', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              Diámetro (m):
            </label>
            <input
              type="number"
              min="1"
              max="20000"
              step="1"
              value={params.diameter}
              onChange={(e) => handleChange('diameter', parseFloat(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'rgba(124,77,255,0.1)',
                border: '1px solid rgba(124,77,255,0.3)',
                borderRadius: 4,
                color: '#fff',
                fontSize: 14
              }}
            />
            <span style={{ fontSize: 11, color: '#b2f7ef', opacity: 0.7 }}>
              Tunguska: ~50m, Chicxulub: ~10km
            </span>
          </div>

          {/* Material */}
          <div>
            <label style={{ fontSize: 12, color: '#b2f7ef', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              Material:
            </label>
            <select
              value={params.material}
              onChange={(e) => handleChange('material', e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'rgba(124,77,255,0.1)',
                border: '1px solid rgba(124,77,255,0.3)',
                borderRadius: 4,
                color: '#e0e7ff',
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              {Object.entries(MATERIAL_PRESETS).map(([key, mat]) => (
                <option key={key} value={key}>
                  {mat.name} ({mat.density} kg/m³)
                </option>
              ))}
            </select>
          </div>

          {/* Ángulo de entrada */}
          <div>
            <label style={{ fontSize: 12, color: '#b2f7ef', fontWeight: 600, marginBottom: 4, display: 'block' }}>
              Ángulo entrada (°): {params.entryAngle}°
            </label>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={params.entryAngle}
              onChange={(e) => handleChange('entryAngle', parseInt(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#b2f7ef', opacity: 0.6 }}>
              <span>Rasante (10°)</span>
              <span>Vertical (90°)</span>
            </div>
          </div>

          {/* Resumen rápido */}
          <div style={{
            marginTop: 8,
            padding: '8px',
            background: 'rgba(124,77,255,0.1)',
            borderRadius: 4,
            borderLeft: '3px solid #7c4dff',
            fontSize: 12
          }}>
            <div style={{ color: '#fff200', fontWeight: 600 }}>Configuración actual:</div>
            <div style={{ color: '#b2f7ef', marginTop: 4, lineHeight: 1.5 }}>
              {params.diameter}m {MATERIAL_PRESETS[params.material]?.name.split('(')[0]} @ {params.vInfinity} km/s ({params.entryAngle}°)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpactParametersForm;
