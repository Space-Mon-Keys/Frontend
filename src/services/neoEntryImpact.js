/**
 * @fileoverview NEO Entry and Impact Parameter Estimation Module
 * Self-contained module for computing atmospheric entry, trajectory integration,
 * ablation, breakup, and ground impact effects for near-Earth objects.
 * No external dependencies.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Earth's escape velocity at surface (km/s) */
const V_ESCAPE_EARTH = 11.2;

/** Standard gravity (m/s²) */
const GRAVITY = 9.81;

/** Sea-level atmospheric density (kg/m³) */
const RHO_0 = 1.225;

/** Atmospheric scale height (m) */
const SCALE_HEIGHT = 7200;

/** Drag coefficient (dimensionless) */
const C_D = 1.0;

/** Heat transfer coefficient (dimensionless) */
const LAMBDA = 0.7;

/** Effective heat of ablation (J/kg) */
const Q_ABLATION = 8e6;

/** Top of atmosphere altitude for entry calculations (m) */
const H_ENTRY = 100000;

/** Minimum velocity threshold for terminal velocity mode (m/s) */
const MIN_VELOCITY = 500;


// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} Angle in degrees
 */
function toDegrees(radians) {
  return radians * 180 / Math.PI;
}

/**
 * Compute atmospheric density at given altitude using exponential model
 * @param {number} altitude - Altitude above sea level (m)
 * @returns {number} Atmospheric density (kg/m³)
 */
function atmosphericDensity(altitude) {
  if (altitude < 0) return RHO_0;
  return RHO_0 * Math.exp(-altitude / SCALE_HEIGHT);
}

/**
 * Compute dynamic pressure
 * @param {number} rho - Atmospheric density (kg/m³)
 * @param {number} velocity - Object velocity (m/s)
 * @returns {number} Dynamic pressure (Pa)
 */
function dynamicPressure(rho, velocity) {
  return 0.5 * rho * velocity * velocity;
}

// ============================================================================
// ENTRY SPEED CALCULATION
// ============================================================================

/**
 * @typedef {Object} EntryConditions
 * @property {number} velocity - Entry velocity at 100 km altitude (m/s)
 * @property {number} vInfinity - Hyperbolic excess velocity (km/s)
 * @property {number} angle - Entry angle from horizontal (degrees)
 */

/**
 * Calculate entry velocity at top of atmosphere (~100 km)
 * @param {number} vInfinity - Hyperbolic excess velocity (km/s)
 * @param {number} entryAngleDeg - Entry angle from horizontal (degrees), default 45
 * @returns {EntryConditions} Entry conditions
 */
function calculateEntryConditions(vInfinity, entryAngleDeg = 45) {
  // For low velocities (< 3 km/s), treat as direct entry velocity (e.g., satellite reentry)
  // For high velocities (>= 3 km/s), use NEO physics: v_entry = sqrt(v_inf^2 + v_escape^2)
  let vEntry;
  if (vInfinity < 3) {
    // Low velocity: use directly as entry velocity (satellite reentry, controlled descent)
    vEntry = vInfinity;
  } else {
    // High velocity: NEO/asteroid entry physics
    vEntry = Math.sqrt(vInfinity * vInfinity + V_ESCAPE_EARTH * V_ESCAPE_EARTH);
  }
  
  return {
    velocity: vEntry * 1000, // Convert to m/s
    vInfinity: vInfinity,
    angle: entryAngleDeg
  };
}

// ============================================================================
// BODY PROPERTIES
// ============================================================================

/**
 * @typedef {Object} BodyProperties
 * @property {number} diameter - Diameter (m)
 * @property {number} mass - Mass (kg)
 * @property {number} area - Cross-sectional area (m²)
 * @property {number} density - Bulk density (kg/m³)
 * @property {number} strength - Material strength (Pa)
 * @property {string} material - Material type
 */

/**
 * Calculate body properties from diameter and material properties
 * @param {number} diameter - Body diameter (m)
 * @param {Object} material - Object with density (kg/m³), strength (Pa), and name (string)
 * @returns {BodyProperties} Body properties
 */
function calculateBodyProperties(diameter, material) {
  // material: { density, strength, name }
  const radius = diameter / 2;
  const area = Math.PI * radius * radius;
  const volume = (4/3) * Math.PI * radius * radius * radius;
  const mass = material.density * volume;
  return {
    diameter: diameter,
    mass: mass,
    area: area,
    density: material.density,
    strength: material.strength,
    material: material.name || 'custom'
  };
}

// ============================================================================
// TRAJECTORY INTEGRATION
// ============================================================================

/**
 * @typedef {Object} TrajectoryState
 * @property {number} time - Time since entry (s)
 * @property {number} altitude - Altitude (m)
 * @property {number} velocity - Velocity (m/s)
 * @property {number} mass - Current mass (kg)
 * @property {number} angle - Flight path angle from horizontal (rad)
 * @property {number} q - Dynamic pressure (Pa)
 * @property {number} rho - Atmospheric density (kg/m³)
 * @property {boolean} fragmented - Has the body fragmented?
 */

/**
 * @typedef {Object} TrajectoryResult
 * @property {TrajectoryState[]} trajectory - Array of trajectory states
 * @property {Object} impact - Impact information
 * @property {number} impact.altitude - Final altitude (m)
 * @property {number} impact.velocity - Final velocity (m/s)
 * @property {number} impact.mass - Final mass (kg)
 * @property {number} impact.massFraction - Fraction of initial mass remaining
 * @property {boolean} impact.airburst - True if airburst occurred
 * @property {number|null} impact.airburstAltitude - Altitude of airburst if applicable (m)
 * @property {number|null} impact.airburstEnergy - Energy at airburst (megatons TNT)
 * @property {number} impact.groundImpact - True if reached ground
 * @property {number} impact.impactEnergy - Kinetic energy at impact (megatons TNT)
 */

/**
 * @typedef {Object} IntegrationOptions
 * @property {number} dt - Time step (s), default 0.05
 * @property {number} lambda - Heat transfer coefficient, default 0.7
 * @property {number} Q - Heat of ablation (J/kg), default 8e6
 * @property {number} Cd - Drag coefficient, default 1.0
 * @property {number} fragmentationMultiplier - Area/mass ratio increase after breakup, default 3
 * @property {boolean} recordTrajectory - Record full trajectory (can be memory intensive), default false
 * @property {number} recordInterval - Record every Nth step (if recordTrajectory true), default 10
 */

/**
 * Integrate trajectory through atmosphere with ablation and fragmentation
 * @param {EntryConditions} entryConditions - Entry conditions at 100 km
 * @param {BodyProperties} bodyProperties - Body properties
 * @param {IntegrationOptions} options - Integration options
 * @returns {TrajectoryResult} Trajectory and impact results
 */
function integrateTrajectory(entryConditions, bodyProperties, options = {}) {
  // Default options
  const dt = options.dt || 0.05;
  const lambda = options.lambda || LAMBDA;
  const Q = options.Q || Q_ABLATION;
  const Cd = options.Cd || C_D;
  const fragMult = options.fragmentationMultiplier || 3;
  const recordTrajectory = options.recordTrajectory || false;
  const recordInterval = options.recordInterval || 10;
  
  // Initial state
  let t = 0;
  let h = H_ENTRY;
  let v = entryConditions.velocity;
  let m = bodyProperties.mass;
  let gamma = toRadians(entryConditions.angle);
  let A = bodyProperties.area;
  
  // Fragmentation state
  let fragmented = false;
  let airburstAltitude = null;
  let airburstEnergy = null;
  
  // Track initial velocity to prevent airburst for low-velocity entries
  const initialVelocity = v;
  
  // Trajectory recording
  const trajectory = [];
  let stepCount = 0;
  
  // Record initial state
  const rho0 = atmosphericDensity(h);
  const q0 = dynamicPressure(rho0, v);
  
  if (recordTrajectory) {
    trajectory.push({
      time: t,
      altitude: h,
      velocity: v,
      mass: m,
      angle: gamma,
      q: q0,
      rho: rho0,
      fragmented: false
    });
  }
  
  // Integration loop
  // Continue while above ground
  // Objects can reach terminal velocity and still fall to the ground
  while (h > 0) {
    // Current atmospheric density
    const rho = atmosphericDensity(h);
    
    // Dynamic pressure
    const q = dynamicPressure(rho, v);
    
    // Check for fragmentation/breakup (only if velocity > 1 km/s)
    // Below 1 km/s, no significant airburst/explosion effects
    // Also check that initial entry velocity was high enough (> 1 km/s)
    if (!fragmented && v > 1000 && initialVelocity > 1000 && q >= bodyProperties.strength) {
      fragmented = true;
      airburstAltitude = h;
      // Energy at breakup (kinetic energy in megatons TNT)
      // 1 megaton TNT = 4.184e15 J
      const energyAtBreakup = (0.5 * m * v * v) / 4.184e15;
      // Only record airburst if energy is significant (> 0.00001 Mt = 10 tons TNT)
      if (energyAtBreakup > 0.00001) {
        airburstEnergy = energyAtBreakup;
      }
      
      // Increase effective area/mass ratio (fragmentation)
      A = A * fragMult;
    }
    
    // Accelerations
    const dragAccel = -(Cd * A / (2 * m)) * rho * v * v;
    const gravAccel = -GRAVITY * Math.sin(gamma);
    const totalAccel = dragAccel + gravAccel;
    
    // Ablation (mass loss rate)
    // Only apply ablation if velocity > 3 km/s (high-speed reentry)
    // Below 3 km/s (e.g., satellite reentry), ablation is negligible
    let dmdt = 0;
    if (v > 3000) {
      dmdt = -(lambda * A / (2 * Q)) * rho * v * v * v;
      m = Math.max(0, m + dmdt * dt);
    }
    // If no ablation, mass stays constant (don't update)
    
    // Update state (simple Euler integration)
    const v_new = v + totalAccel * dt;
    
    // If velocity becomes very low, the object has reached terminal velocity
    // At terminal velocity, drag force equals gravitational force, so velocity is constant
    // Terminal velocity at current altitude: v_t = sqrt((2 * m * g) / (rho * Cd * A))
    if (v_new < MIN_VELOCITY && rho > 0 && m > 0) {
      const v_terminal = Math.sqrt((2 * m * GRAVITY) / (rho * Cd * A));
      // Cap at realistic terminal velocity for meteorites (~200-300 m/s)
      v = Math.min(v_terminal, 200);
      // Once at terminal velocity, continue descending at this constant speed
      // No further deceleration - object will fall until it hits ground
    } else {
      v = Math.max(0, v_new);
    }
    
    h = h - v * Math.sin(gamma) * dt;
    t = t + dt;
    
    // Prevent negative values
    // Only break if mass is 0 AND ablation was active (high velocity)
    if (m <= 0 && initialVelocity > 3000) {
      m = 0;
      break; // Completely ablated
    }
    // If mass somehow becomes negative at low velocity, reset to initial mass
    if (m <= 0 && initialVelocity <= 3000) {
      m = bodyProperties.mass;
    }
    
    // Record trajectory at intervals
    if (recordTrajectory && stepCount % recordInterval === 0) {
      trajectory.push({
        time: t,
        altitude: h,
        velocity: v,
        mass: m,
        angle: gamma,
        q: q,
        rho: rho,
        fragmented: fragmented
      });
    }
    
    stepCount++;
    
    // Safety check (prevent infinite loops)
    // Allow longer flight time for objects falling at terminal velocity
    if (t > 1800) break; // Max 30 minutes of flight time
  }
  
  // Final state
  const finalRho = atmosphericDensity(h);
  const finalQ = dynamicPressure(finalRho, v);
  
  // Record final state if recording trajectory
  if (recordTrajectory) {
    trajectory.push({
      time: t,
      altitude: h,
      velocity: v,
      mass: m,
      angle: gamma,
      q: finalQ,
      rho: finalRho,
      fragmented: fragmented
    });
  }
  
  // Impact energy (kinetic energy in megatons TNT)
  const impactEnergy = (0.5 * m * v * v) / 4.184e15;
  
  return {
    trajectory: trajectory,
    impact: {
      altitude: h,
      velocity: v,
      mass: m,
      massFraction: m / bodyProperties.mass,
      airburst: fragmented && h > 0 && airburstEnergy !== null && airburstEnergy > 0,
      airburstAltitude: airburstAltitude,
      airburstEnergy: airburstEnergy,
      groundImpact: h <= 0,
      impactEnergy: impactEnergy
    }
  };
}

// ============================================================================
// BLAST EFFECTS ESTIMATION
// ============================================================================

/**
 * @typedef {Object} BlastEffects
 * @property {number} energy - Blast energy (megatons TNT)
 * @property {number} altitude - Blast altitude (m)
 * @property {number} radiusWindowBreak - Radius of window breakage (km)
 * @property {number} radiusStructuralDamage - Radius of structural damage (km)
 * @property {number} radiusSevereDestruction - Radius of severe destruction (km)
 * @property {string} severity - Severity classification
 */

/**
 * Estimate ground overpressure effects for airburst
 * Based on Glasstone & Dolan (1977) nuclear test data and Collins et al. (2017) airburst models
 * Uses yield scaling from 1 kt reference explosions
 * 
 * Reference: Collins et al. (2017) "A numerical assessment of simple airblast models of impact airbursts"
 * Meteoritics & Planetary Science, 52(8), 1542-1560. doi:10.1111/maps.12873
 * 
 * @param {number} energy - Blast energy (megatons TNT)
 * @param {number} altitude - Burst altitude (m)
 * @returns {BlastEffects} Blast effect radii
 */
function estimateBlastEffects(energy, altitude) {
  if (energy <= 0 || altitude <= 0) {
    return {
      energy: energy,
      altitude: altitude,
      radiusWindowBreak: 0,
      radiusStructuralDamage: 0,
      radiusSevereDestruction: 0,
      severity: 'none'
    };
  }
  
  // Convert to consistent units
  const h_km = altitude / 1000; // Altitude in km
  const E_kt = energy * 1000; // Energy in kilotons
  
  /**
   * Overpressure as a function of range for 1 kt explosion at given altitude
   * Based on Collins et al. (2017) Equation 7, which provides a better fit to
   * Glasstone & Dolan (1977) nuclear test data over a greater altitude range.
   * 
   * Peak overpressure p(r) in Pa at range r (m) for 1 kt explosion at altitude zb (m):
   * p(r) = 3.14e11 / ((2.5e5 + r^2.5) * (1 + zb/6789)^2)
   * 
   * For yields other than 1 kt, use scaling:
   * - Scaled range: r_scaled = r / E^(1/3)
   * - Scaled overpressure: p_scaled = p * E^(2/3)
   */
  
  /**
   * Calculate range for a given overpressure threshold
   * Using the Collins et al. (2017) formula inverted and yield-scaled
   * 
   * @param {number} p_target - Target overpressure in Pa
   * @returns {number} Range in km where this overpressure occurs
   */
  function rangeForOverpressure(p_target) {
    if (p_target <= 0) return 0;
    
    // Yield scaling factor
    const yield_scale = Math.pow(E_kt, 1/3);
    
    // Altitude correction factor
    const alt_factor = Math.pow(1 + altitude / 6789, 2);
    
    // Scaled overpressure (for 1 kt equivalent)
    const p_1kt = p_target / Math.pow(E_kt, 2/3);
    
    // Solve for range using the Collins et al. (2017) formula
    // p = 3.14e11 / ((2.5e5 + r^2.5) * alt_factor)
    // Rearranging: r^2.5 = (3.14e11 / (p * alt_factor)) - 2.5e5
    
    const denominator = p_1kt * alt_factor;
    if (denominator <= 0) return 0;
    
    const r_term = (3.14e11 / denominator) - 2.5e5;
    if (r_term <= 0) return 0.01; // Minimum 10 m radius
    
    const r_1kt = Math.pow(r_term, 1/2.5); // Range in meters for 1 kt
    const r_scaled = r_1kt * yield_scale; // Scale by yield^(1/3)
    
    return r_scaled / 1000; // Convert to km
  }
  
  /**
   * Overpressure thresholds based on Glasstone & Dolan (1977) and other sources:
   * 
   * - 0.5-1 kPa (500-1000 Pa): Window glass breakage (loud indoor noise)
   * - 2 kPa (2000 Pa): Typical window breakage threshold (conservative)
   * - 3-5 kPa (3000-5000 Pa): Moderate damage to houses, some collapsed walls
   * - 10-20 kPa (10000-20000 Pa): Serious damage to buildings, heavy structural damage
   * - 35-50 kPa (35000-50000 Pa): Complete destruction of brick buildings
   * - 70-100 kPa (70000-100000 Pa): Total destruction, reinforced concrete heavily damaged
   * 
   * We use conservative (lower) values for public safety estimates
   */
  
  // Window breakage: 2 kPa (2000 Pa) - typical threshold for glass breakage
  let radiusWindowBreak = rangeForOverpressure(2000);
  // Structural damage: 20 kPa (20000 Pa) - serious building damage
  let radiusStructuralDamage = rangeForOverpressure(20000);
  // Severe destruction: 35 kPa (35000 Pa) - complete destruction of most buildings
  let radiusSevereDestruction = rangeForOverpressure(35000);
  // Extreme destruction: 100 kPa (100000 Pa) - heavy reinforced concrete
  let radiusExtreme = rangeForOverpressure(100000);

  // --- Empirical attenuation for high-altitude meteor airbursts ---
  // If burst altitude > 25 km, apply attenuation to all radii (empirical, for meteorites)
  // See: SpaceApps 2025, ajuste físico-empírico para disipación atmosférica
  const H_REF = 25; // km, reference height
  const H_SCALE = 8; // km, attenuation scale
  const EXP_P = 0.6; // exponent
  const CAP_2KPA = 300; // km, max for 2 kPa
  const h_burst_km = altitude / 1000;
  let attenuation = 1.0;
  if (h_burst_km > H_REF) {
    attenuation = Math.exp(-Math.pow((h_burst_km - H_REF) / H_SCALE, EXP_P));
    radiusWindowBreak *= attenuation;
    radiusStructuralDamage *= attenuation;
    radiusSevereDestruction *= attenuation;
    radiusExtreme *= attenuation;
  }
  // Cap 2 kPa radius after attenuation
  if (radiusWindowBreak > CAP_2KPA) radiusWindowBreak = CAP_2KPA;

  // Severity classification based on destruction radii
  let severity = 'minor';
  if (radiusSevereDestruction > 10) severity = 'catastrophic';
  else if (radiusSevereDestruction > 3) severity = 'major';
  else if (radiusStructuralDamage > 10) severity = 'significant';
  else if (radiusWindowBreak > 20) severity = 'moderate';

  /*
    Ajuste empírico para meteoritos con bursts altos:
    - Para bursts > 25 km, se aplica atenuación atmosférica adicional a todos los radios de daño.
    - El radio de 2 kPa (rotura de ventanas) se limita a 300 km tras la atenuación.
    - Basado en disipación atmosférica mayor que en explosiones nucleares.
    - Parámetros: H_REF=25 km, H_SCALE=8 km, EXP_P=0.6, CAP_2KPA=300 km.
  */

  return {
    energy: energy,
    altitude: altitude,
    radiusWindowBreak: radiusWindowBreak,
    radiusStructuralDamage: radiusStructuralDamage,
    radiusSevereDestruction: radiusSevereDestruction,
    radiusExtreme: radiusExtreme,
    severity: severity
  };
}

// ============================================================================
// HIGH-LEVEL API
// ============================================================================

/**
 * @typedef {Object} NEOImpactScenario
 * @property {Object} input - Input parameters
 * @property {EntryConditions} entry - Entry conditions
 * @property {BodyProperties} body - Body properties
 * @property {TrajectoryResult} trajectory - Trajectory results
 * @property {BlastEffects|null} blast - Blast effects (if airburst)
 * @property {string} outcome - Summary of outcome
 */

/**
 * Complete NEO impact assessment
 * @param {Object} params - Input parameters
 * @param {number} params.vInfinity - Hyperbolic excess velocity (km/s)
 * @param {number} params.diameter - Body diameter (m)
 * @param {string|MaterialProperties} params.material - Material type or custom properties
 * @param {number} [params.entryAngle=45] - Entry angle from horizontal (degrees)
 * @param {IntegrationOptions} [params.options={}] - Integration options
 * @returns {NEOImpactScenario} Complete impact scenario
 */
function assessNEOImpact(params) {
  const {
    vInfinity,
    diameter,
    material = 'stony',
    entryAngle = 45,
    options = {}
  } = params;
  
  // Calculate entry conditions
  const entry = calculateEntryConditions(vInfinity, entryAngle);
  
  // Calculate body properties
  const body = calculateBodyProperties(diameter, material);
  
  // Integrate trajectory
  const trajResult = integrateTrajectory(entry, body, options);
  
  // Estimate blast effects if airburst
  let blast = null;
  if (trajResult.impact.airburst && trajResult.impact.airburstEnergy) {
    blast = estimateBlastEffects(
      trajResult.impact.airburstEnergy,
      trajResult.impact.airburstAltitude
    );
  }
  
  // Determine outcome
  let outcome;
  if (trajResult.impact.mass === 0) {
    outcome = 'Complete ablation in atmosphere';
  } else if (trajResult.impact.airburst) {
    outcome = `Airburst at ${(trajResult.impact.airburstAltitude / 1000).toFixed(1)} km altitude`;
  } else if (trajResult.impact.groundImpact) {
    outcome = `Ground impact at ${trajResult.impact.velocity.toFixed(0)} m/s with ${(trajResult.impact.massFraction * 100).toFixed(1)}% of original mass`;
  } else {
    outcome = 'Decelerated to low velocity in atmosphere';
  }
  
  return {
    input: {
      vInfinity,
      diameter,
      material: typeof material === 'string' ? material : 'custom',
      entryAngle
    },
    entry,
    body,
    trajectory: trajResult,
    blast,
    outcome
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Constants
  V_ESCAPE_EARTH,
  GRAVITY,
  // Core functions
  calculateEntryConditions,
  calculateBodyProperties,
  integrateTrajectory,
  estimateBlastEffects,
  // High-level API
  assessNEOImpact,
  // Utilities
  atmosphericDensity,
  dynamicPressure,
  toRadians,
  toDegrees
};
