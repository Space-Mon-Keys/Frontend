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

/** Minimum velocity threshold to stop integration (m/s) */
const MIN_VELOCITY = 300;

// ============================================================================
// MATERIAL PRESETS
// ============================================================================

/**
 * @typedef {Object} MaterialProperties
 * @property {number} density - Bulk density (kg/m³)
 * @property {number} strength - Material strength / fragmentation threshold (Pa)
 * @property {string} name - Material name
 */

/**
 * Predefined material properties for common NEO compositions
 * @type {Object.<string, MaterialProperties>}
 */
const MATERIAL_PRESETS = {
  stony: {
    name: 'Stony (S-type asteroid)',
    density: 3000,
    strength: 2e5 // 200 kPa
  },
  iron: {
    name: 'Iron (M-type asteroid)',
    density: 7800,
    strength: 2e6 // 2 MPa
  },
  comet: {
    name: 'Cometary (icy)',
    density: 800,
    strength: 1e5 // 100 kPa
  }
};

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
  // v_entry = sqrt(v_inf^2 + v_escape^2)
  const vEntry = Math.sqrt(vInfinity * vInfinity + V_ESCAPE_EARTH * V_ESCAPE_EARTH);
  
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
 * Calculate body properties from diameter and material
 * @param {number} diameter - Body diameter (m)
 * @param {string|MaterialProperties} material - Material preset name or custom properties
 * @returns {BodyProperties} Body properties
 */
function calculateBodyProperties(diameter, material = 'stony') {
  // Get material properties
  let matProps;
  if (typeof material === 'string') {
    matProps = MATERIAL_PRESETS[material] || MATERIAL_PRESETS.stony;
  } else {
    matProps = material;
  }
  
  const radius = diameter / 2;
  const area = Math.PI * radius * radius;
  const volume = (4/3) * Math.PI * radius * radius * radius;
  const mass = matProps.density * volume;
  
  return {
    diameter: diameter,
    mass: mass,
    area: area,
    density: matProps.density,
    strength: matProps.strength,
    material: matProps.name || 'custom'
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
  while (h > 0 && v > MIN_VELOCITY) {
    // Current atmospheric density
    const rho = atmosphericDensity(h);
    
    // Dynamic pressure
    const q = dynamicPressure(rho, v);
    
    // Check for fragmentation/breakup
    if (!fragmented && q >= bodyProperties.strength) {
      fragmented = true;
      airburstAltitude = h;
      // Energy at breakup (kinetic energy in megatons TNT)
      // 1 megaton TNT = 4.184e15 J
      airburstEnergy = (0.5 * m * v * v) / 4.184e15;
      
      // Increase effective area/mass ratio (fragmentation)
      A = A * fragMult;
    }
    
    // Accelerations
    const dragAccel = -(Cd * A / (2 * m)) * rho * v * v;
    const gravAccel = -GRAVITY * Math.sin(gamma);
    const totalAccel = dragAccel + gravAccel;
    
    // Ablation (mass loss rate)
    const dmdt = -(lambda * A / (2 * Q)) * rho * v * v * v;
    
    // Update state (simple Euler integration)
    v = v + totalAccel * dt;
    h = h - v * Math.sin(gamma) * dt;
    m = Math.max(0, m + dmdt * dt);
    t = t + dt;
    
    // Prevent negative values
    if (v < 0) v = 0;
    if (m <= 0) {
      m = 0;
      break; // Completely ablated
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
    if (t > 300) break; // Max 5 minutes of flight time
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
      airburst: fragmented && h > 0,
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
 * Based on simplified scaling laws for nuclear airbursts
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
  
  // Convert altitude to km
  const h_km = altitude / 1000;
  
  // Scaling: effective yield reduces with altitude
  // Simple approximation: eff_energy = energy * exp(-h/h_opt)
  // Optimal burst height scales as h_opt ≈ 0.5 * energy^(1/3) km
  const h_opt = 0.5 * Math.pow(energy, 1/3);
  const efficiency = Math.exp(-h_km / (h_opt + 1));
  const effectiveEnergy = energy * efficiency;
  
  // Scaling laws (very approximate):
  // Overpressure radius R ∝ E^(1/3) / P^(1/3)
  // Window breakage: ~3 kPa overpressure
  // Structural damage: ~20 kPa overpressure
  // Severe destruction: ~100 kPa overpressure
  
  const R_base = Math.pow(effectiveEnergy, 1/3); // km
  
  const radiusWindowBreak = R_base * 5.0; // ~3 kPa
  const radiusStructuralDamage = R_base * 2.0; // ~20 kPa
  const radiusSevereDestruction = R_base * 0.8; // ~100 kPa
  
  // Severity classification
  let severity = 'minor';
  if (radiusSevereDestruction > 1) severity = 'catastrophic';
  else if (radiusStructuralDamage > 2) severity = 'major';
  else if (radiusWindowBreak > 5) severity = 'moderate';
  
  return {
    energy: energy,
    altitude: altitude,
    radiusWindowBreak: radiusWindowBreak,
    radiusStructuralDamage: radiusStructuralDamage,
    radiusSevereDestruction: radiusSevereDestruction,
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
  MATERIAL_PRESETS,
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
