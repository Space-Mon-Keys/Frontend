import React, { useState } from 'react';
import MapImpact from './MapImpact';
import ImpactParametersForm from './ImpactParametersForm';

/**
 * Componente principal que combina el formulario de parámetros con el mapa de impacto
 */
const ImpactSimulator = () => {
  const [impactParams, setImpactParams] = useState({
    vInfinity: 15,
    diameter: 50,
    material: 'stony',
    entryAngle: 45
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ImpactParametersForm
        initialParams={impactParams}
        onParamsChange={setImpactParams}
      />
      <MapImpact
        vInfinity={impactParams.vInfinity}
        diameter={impactParams.diameter}
        material={impactParams.material}
        entryAngle={impactParams.entryAngle}
      />
    </div>
  );
};

export default ImpactSimulator;
