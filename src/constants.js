/**
 * Constants and configuration for the particle simulation.
 * Centralized for easy tuning and consistency across modules.
 */

/** Particle physics constants */
export const PARTICLE_RADIUS = 4;
export const PARTICLE_MASS = 1;

/** Force calculation parameters */
export const INTERACTION_RADIUS = 300;      // Max distance for particle interactions
export const REPULSION_RADIUS = PARTICLE_RADIUS * 2;  // Distance at which edges touch (sum of radii)
export const REPULSION_STRENGTH = 0.5;     // Base repulsion force magnitude
export const FRICTION = 0.98;              // Velocity damping per frame
export const MAX_VELOCITY = 5;             // Velocity cap to prevent instability
export const FORCE_SCALE = 0.001;          // Scales interaction matrix values to forces

/** Spatial hashing for O(n) neighbor queries */
export const CELL_SIZE = INTERACTION_RADIUS;

/** Simulation defaults */
export const DEFAULT_PARTICLE_COUNT = 100;
export const DEFAULT_TYPE_COUNT = 3;
export const MIN_PARTICLES = 10;
export const MAX_PARTICLES = 2000;
export const MIN_TYPES = 2;
export const MAX_TYPES = 8;

/** Interaction radius settings */
export const DEFAULT_INTERACTION_RADIUS = 300;
export const MIN_INTERACTION_RADIUS = 20;
export const MAX_INTERACTION_RADIUS = 1000;

/** Default to brute force (spatial hash has minimal benefit at typical settings) */
export const DEFAULT_USE_BRUTE_FORCE = true;

/** Interaction matrix range */
export const MATRIX_MIN = -5;
export const MATRIX_MAX = 5;

/** Color schemes: maps scheme name to array of hex colors (index = particle type) */
export const COLOR_SCHEMES = {
  neon: ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b', '#fb5607', '#ff006e', '#3a86ff'],
  pastel: ['#ffadad', '#ffd6a5', '#caffbf', '#a0c4ff', '#ffc6ff', '#fdffb6', '#bdb2ff', '#9bf6ff'],
  warm: ['#ff4d4d', '#ff9933', '#ffcc00', '#ff6666', '#cc3300', '#ff8080', '#ffaa00', '#ff5500'],
  cool: ['#00b4d8', '#0077b6', '#90e0ef', '#48cae4', '#023e8a', '#caf0f8', '#0096c7', '#ade8f4'],
  monochrome: ['#f8f9fa', '#adb5bd', '#6c757d', '#495057', '#343a40', '#212529', '#dee2e6', '#868e96'],
};

/** Background color options */
export const BG_COLORS = {
  dark: '#000000',
  light: '#ffffff',
};

/** LocalStorage key for persisting settings */
export const STORAGE_KEY = 'particleSimulationSettings';
