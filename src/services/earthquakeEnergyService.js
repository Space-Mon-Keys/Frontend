// Servicio para comparar energía de impacto con terremotos reales (USGS)
// Fórmulas USGS:
//   log10(E) = 1.5*M + 4.8   (E en julios, M magnitud)
//   M = (log10(E) - 4.8) / 1.5

/**
 * Convierte energía de impacto (julios) a magnitud sísmica Mw
 * Solo una fracción de la energía de impacto se convierte en energía sísmica radiada.
 * 
 * @param {number} impactEnergyJoules - Energía total del impacto en julios
 * @param {number} eta - Factor de acoplamiento sísmico η (adimensional, rango 1e-4 a 1e-3)
 *                       - Roca/continente: 1e-3 (por defecto)
 *                       - Sedimentos blandos: 3e-4
 *                       - Océano/profundidad: 1e-4
 * @returns {number} Magnitud sísmica Mw equivalente
 */
export function energyToMagnitude(impactEnergyJoules, eta = 1e-3) {
  if (!impactEnergyJoules || impactEnergyJoules <= 0) return null;
  
  // Calcular energía sísmica radiada: E_sismo = E_impacto × η
  const seismicEnergyJoules = impactEnergyJoules * eta;
  
  // Aplicar fórmula USGS: Mw = (log10(E_sismo) - 4.8) / 1.5
  const magnitude = (Math.log10(seismicEnergyJoules) - 4.8) / 1.5;
  
  return magnitude;
}

/**
 * Consulta la API del USGS para terremotos con magnitud similar
 * @param {number} magnitude - Magnitud Richter
 * @param {number} delta - Rango de magnitud (default 0.2)
 * @param {number} limit - Máximo de resultados (default 5)
 * @returns {Promise<Array>} Lista de terremotos reales
 */
export async function findSimilarEarthquakes(magnitude, delta = 0.2, limit = 5) {
  if (!magnitude) return [];
  const minMag = Math.max(0, magnitude - delta);
  const maxMag = magnitude + delta;
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${minMag}&maxmagnitude=${maxMag}&orderby=magnitude&limit=${limit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('USGS API error');
    const data = await res.json();
    if (!data.features) return [];
    // Mapear a formato simple
    return data.features.map(f => ({
      id: f.id,
      place: f.properties.place,
      time: f.properties.time,
      magnitude: f.properties.mag,
      url: f.properties.url,
      energyJoules: f.properties.mag ? Math.pow(10, 1.5 * f.properties.mag + 4.8) : null
    }));
  } catch (e) {
    return [];
  }
}

// Ejemplo de uso:
// const mag = energyToMagnitude(1e15);
// findSimilarEarthquakes(mag).then(console.log);