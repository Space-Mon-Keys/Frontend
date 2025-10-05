// Service to compare impact energy with real earthquakes (USGS)
// USGS formulas:
//   log10(E) = 1.5*M + 4.8   (E in joules, M magnitude)
//   M = (log10(E) - 4.8) / 1.5

/**
 * Converts impact energy (joules) to seismic magnitude Mw
 * Only a fraction of impact energy converts to radiated seismic energy.
 * 
 * @param {number} impactEnergyJoules - Total impact energy in joules
 * @param {number} eta - Seismic coupling factor η (dimensionless, range 1e-4 to 1e-3)
 *                       - Rock/continent: 1e-3 (default)
 *                       - Soft sediments: 3e-4
 *                       - Ocean/depth: 1e-4
 * @returns {number} Equivalent seismic magnitude Mw
 */
export function energyToMagnitude(impactEnergyJoules, eta = 1e-3) {
  if (!impactEnergyJoules || impactEnergyJoules <= 0) return null;
  
  // Calculate radiated seismic energy: E_seismic = E_impact × η
  const seismicEnergyJoules = impactEnergyJoules * eta;
  
  // Apply USGS formula: Mw = (log10(E_seismic) - 4.8) / 1.5
  const magnitude = (Math.log10(seismicEnergyJoules) - 4.8) / 1.5;
  
  return magnitude;
}

/**
 * Query USGS API for earthquakes with similar magnitude
 * @param {number} magnitude - Richter magnitude
 * @param {number} delta - Magnitude range (default 0.2)
 * @param {number} limit - Maximum results (default 5)
 * @returns {Promise<Array>} List of real earthquakes
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
    // Map to simple format
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

// Usage example:
// const mag = energyToMagnitude(1e15);
// findSimilarEarthquakes(mag).then(console.log);