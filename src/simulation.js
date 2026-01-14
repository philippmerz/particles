/**
 * Particle Simulation Engine
 * 
 * Core physics simulation using Structure-of-Arrays (SoA) layout for
 * cache-efficient iteration. Uses TypedArrays for memory efficiency
 * and predictable performance.
 * 
 * Physics model:
 * - Particles interact based on type-to-type interaction matrix
 * - Positive values = attraction, negative = repulsion
 * - Close-range repulsion prevents overlap regardless of matrix
 * - Velocity damping (friction) for stability
 * - Toroidal boundary wrapping
 */

import { SpatialHash } from './spatial-hash.js';
import {
  PARTICLE_RADIUS,
  INTERACTION_RADIUS,
  REPULSION_RADIUS,
  REPULSION_STRENGTH,
  FRICTION,
  MAX_VELOCITY,
  FORCE_SCALE,
  CELL_SIZE,
} from './constants.js';

export class ParticleSimulation {
  /**
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    // Particle state arrays (SoA layout)
    this.x = null;           // Float32Array - x positions
    this.y = null;           // Float32Array - y positions
    this.vx = null;          // Float32Array - x velocities
    this.vy = null;          // Float32Array - y velocities
    this.types = null;       // Uint8Array - particle type indices
    
    this.count = 0;
    this.typeCount = 0;
    this.interactionMatrix = null;
    
    // Spatial partitioning for O(n) neighbor queries
    this.spatialHash = new SpatialHash(CELL_SIZE, width, height);
    
    // Pre-allocated force accumulator arrays
    this.fx = null;
    this.fy = null;
  }
  
  /**
   * Initializes or reinitializes the simulation with new parameters.
   * Places particles randomly with no overlaps using rejection sampling
   * with spatial hashing for efficiency.
   * 
   * @param {number} particleCount
   * @param {number} typeCount
   * @param {number[][]} interactionMatrix
   */
  initialize(particleCount, typeCount, interactionMatrix) {
    this.count = particleCount;
    this.typeCount = typeCount;
    this.interactionMatrix = interactionMatrix;
    
    // Allocate typed arrays
    this.x = new Float32Array(particleCount);
    this.y = new Float32Array(particleCount);
    this.vx = new Float32Array(particleCount);
    this.vy = new Float32Array(particleCount);
    this.types = new Uint8Array(particleCount);
    this.fx = new Float32Array(particleCount);
    this.fy = new Float32Array(particleCount);
    
    // Place particles with no overlaps
    this.placeParticlesNoOverlap();
    
    // Initialize velocities to zero
    this.vx.fill(0);
    this.vy.fill(0);
  }
  
  /**
   * Places particles randomly, ensuring no overlaps.
   * Uses spatial hashing for efficient collision checking during placement.
   */
  placeParticlesNoOverlap() {
    const minDist = PARTICLE_RADIUS * 2.5; // Minimum distance between particle centers
    const minDistSq = minDist * minDist;
    const padding = PARTICLE_RADIUS * 2;
    
    // Calculate maximum particles that can fit
    const maxDensity = (this.width - 2 * padding) * (this.height - 2 * padding) / (Math.PI * minDist * minDist / 4);
    
    // Temporary spatial hash for placement
    const placementHash = new SpatialHash(minDist, this.width, this.height);
    
    let placed = 0;
    let attempts = 0;
    const maxAttempts = this.count * 100;
    
    while (placed < this.count && attempts < maxAttempts) {
      attempts++;
      
      // Random position with padding from edges
      const x = padding + Math.random() * (this.width - 2 * padding);
      const y = padding + Math.random() * (this.height - 2 * padding);
      
      // Check for collisions with already placed particles
      const nearby = placementHash.getNearby(x, y);
      let collision = false;
      
      for (let i = 0; i < nearby.length; i++) {
        const idx = nearby[i];
        const dx = x - this.x[idx];
        const dy = y - this.y[idx];
        const distSq = dx * dx + dy * dy;
        
        if (distSq < minDistSq) {
          collision = true;
          break;
        }
      }
      
      if (!collision) {
        this.x[placed] = x;
        this.y[placed] = y;
        this.types[placed] = placed % this.typeCount;
        placementHash.insert(placed, x, y);
        placed++;
      }
    }
    
    // If we couldn't place all particles without overlap, place remaining randomly
    // (this can happen if too many particles for the space)
    if (placed < this.count) {
      console.warn(`Could only place ${placed}/${this.count} particles without overlap. Placing rest randomly.`);
      for (let i = placed; i < this.count; i++) {
        this.x[i] = padding + Math.random() * (this.width - 2 * padding);
        this.y[i] = padding + Math.random() * (this.height - 2 * padding);
        this.types[i] = i % this.typeCount;
      }
    }
  }
  
  /**
   * Updates the interaction matrix without reinitializing particles.
   * @param {number[][]} matrix
   */
  setInteractionMatrix(matrix) {
    this.interactionMatrix = matrix;
  }
  
  /**
   * Removes a particle type and remaps existing particles.
   * Particles of the removed type are reassigned to remaining types.
   * @param {number} removedIndex - Index of the type being removed
   * @param {number} newTypeCount - New total number of types
   * @param {number[][]} newMatrix - New interaction matrix
   */
  removeParticleType(removedIndex, newTypeCount, newMatrix) {
    this.typeCount = newTypeCount;
    this.interactionMatrix = newMatrix;
    
    // Remap all particle types
    for (let i = 0; i < this.count; i++) {
      const currentType = this.types[i];
      
      if (currentType === removedIndex) {
        // Particle was of the removed type - assign to a random remaining type
        this.types[i] = Math.floor(Math.random() * newTypeCount);
      } else if (currentType > removedIndex) {
        // Shift down indices that were above the removed type
        this.types[i] = currentType - 1;
      }
      // Types below removedIndex stay the same
    }
  }
  
  /**
   * Handles canvas resize.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    const scaleX = width / this.width;
    const scaleY = height / this.height;
    
    this.width = width;
    this.height = height;
    this.spatialHash.resize(width, height);
    
    // Scale particle positions to new dimensions
    for (let i = 0; i < this.count; i++) {
      this.x[i] *= scaleX;
      this.y[i] *= scaleY;
      
      // Clamp to new bounds
      this.x[i] = Math.max(PARTICLE_RADIUS, Math.min(width - PARTICLE_RADIUS, this.x[i]));
      this.y[i] = Math.max(PARTICLE_RADIUS, Math.min(height - PARTICLE_RADIUS, this.y[i]));
    }
  }
  
  /**
   * Main physics update step. Computes forces and integrates motion.
   * @param {number} dt - Delta time in seconds (typically 1/60)
   */
  update(dt) {
    if (this.count === 0) return;
    
    // Normalize dt to prevent instability with frame drops
    const normalizedDt = Math.min(dt, 1 / 30);
    
    // Reset force accumulators
    this.fx.fill(0);
    this.fy.fill(0);
    
    // Rebuild spatial hash with current positions
    this.spatialHash.clear();
    for (let i = 0; i < this.count; i++) {
      this.spatialHash.insert(i, this.x[i], this.y[i]);
    }
    
    // Calculate forces
    this.calculateForces();
    
    // Integrate motion (semi-implicit Euler)
    this.integrate(normalizedDt);
    
    // Handle boundaries
    this.handleBoundaries();
  }
  
  /**
   * Calculates inter-particle forces using spatial hashing.
   * Force model:
   * - Beyond INTERACTION_RADIUS: no force
   * - Between REPULSION_RADIUS and INTERACTION_RADIUS: attraction/repulsion based on matrix
   * - Below REPULSION_RADIUS: strong repulsion (prevents overlap)
   */
  calculateForces() {
    const interactionRadiusSq = INTERACTION_RADIUS * INTERACTION_RADIUS;
    const repulsionRadiusSq = REPULSION_RADIUS * REPULSION_RADIUS;
    
    for (let i = 0; i < this.count; i++) {
      const xi = this.x[i];
      const yi = this.y[i];
      const typeI = this.types[i];
      
      // Get nearby particles from spatial hash
      const nearby = this.spatialHash.getNearby(xi, yi);
      
      for (let n = 0; n < nearby.length; n++) {
        const j = nearby[n];
        if (j <= i) continue; // Avoid duplicate pairs and self-interaction
        
        const dx = this.x[j] - xi;
        const dy = this.y[j] - yi;
        const distSq = dx * dx + dy * dy;
        
        if (distSq > interactionRadiusSq || distSq < 0.0001) continue;
        
        const dist = Math.sqrt(distSq);
        const typeJ = this.types[j];
        
        // Normalized direction from i to j
        const nx = dx / dist;
        const ny = dy / dist;
        
        let forceMagnitude = 0;
        
        if (distSq < repulsionRadiusSq) {
          // Strong close-range repulsion (always active regardless of matrix)
          const overlap = 1 - dist / REPULSION_RADIUS;
          forceMagnitude = -REPULSION_STRENGTH * overlap * overlap;
        } else {
          // Matrix-based attraction/repulsion in the intermediate zone
          // Force scales with distance (stronger when closer within interaction zone)
          const t = (dist - REPULSION_RADIUS) / (INTERACTION_RADIUS - REPULSION_RADIUS);
          const falloff = 1 - t; // Linear falloff
          
          // Bidirectional interaction: average of (i→j) and (j→i) attractions
          const attraction = (this.interactionMatrix[typeI][typeJ] + this.interactionMatrix[typeJ][typeI]) / 2;
          forceMagnitude = attraction * FORCE_SCALE * falloff;
        }
        
        // Apply force (Newton's third law)
        const fx = forceMagnitude * nx;
        const fy = forceMagnitude * ny;
        
        this.fx[i] += fx;
        this.fy[i] += fy;
        this.fx[j] -= fx;
        this.fy[j] -= fy;
      }
    }
  }
  
  /**
   * Integrates velocities and positions using semi-implicit Euler.
   * @param {number} dt
   */
  integrate(dt) {
    const dtScale = dt * 60; // Normalize to 60fps base
    
    for (let i = 0; i < this.count; i++) {
      // Update velocity
      this.vx[i] += this.fx[i] * dtScale;
      this.vy[i] += this.fy[i] * dtScale;
      
      // Apply friction
      this.vx[i] *= FRICTION;
      this.vy[i] *= FRICTION;
      
      // Clamp velocity
      const speed = Math.sqrt(this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
      if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed;
        this.vx[i] *= scale;
        this.vy[i] *= scale;
      }
      
      // Update position
      this.x[i] += this.vx[i] * dtScale;
      this.y[i] += this.vy[i] * dtScale;
    }
  }
  
  /**
   * Handles boundary conditions - bounces off walls with damping.
   */
  handleBoundaries() {
    const damping = 0.8;
    
    for (let i = 0; i < this.count; i++) {
      // Left/right boundaries
      if (this.x[i] < PARTICLE_RADIUS) {
        this.x[i] = PARTICLE_RADIUS;
        this.vx[i] = Math.abs(this.vx[i]) * damping;
      } else if (this.x[i] > this.width - PARTICLE_RADIUS) {
        this.x[i] = this.width - PARTICLE_RADIUS;
        this.vx[i] = -Math.abs(this.vx[i]) * damping;
      }
      
      // Top/bottom boundaries
      if (this.y[i] < PARTICLE_RADIUS) {
        this.y[i] = PARTICLE_RADIUS;
        this.vy[i] = Math.abs(this.vy[i]) * damping;
      } else if (this.y[i] > this.height - PARTICLE_RADIUS) {
        this.y[i] = this.height - PARTICLE_RADIUS;
        this.vy[i] = -Math.abs(this.vy[i]) * damping;
      }
    }
  }
  
  /**
   * Gets particle data for rendering.
   * @returns {{ x: Float32Array, y: Float32Array, types: Uint8Array, count: number }}
   */
  getParticleData() {
    return {
      x: this.x,
      y: this.y,
      types: this.types,
      count: this.count,
    };
  }
}
