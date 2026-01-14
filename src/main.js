/**
 * Main Application Entry Point
 * 
 * Orchestrates the particle simulation, WebGL renderer, UI, and persistence.
 * Implements a fixed-timestep game loop for consistent physics.
 */

import { ParticleSimulation } from './simulation.js';
import { WebGLRenderer } from './renderer.js';
import { UIController } from './ui.js';
import { ZoomController } from './zoom-controller.js';
import { loadSettings, saveSettings, getDefaultSettings } from './settings.js';

class ParticleApp {
  constructor() {
    /** @type {HTMLCanvasElement} */
    this.canvas = document.getElementById('canvas');
    
    /** @type {WebGLRenderer} */
    this.renderer = null;
    
    /** @type {ParticleSimulation} */
    this.simulation = null;
    
    /** @type {UIController} */
    this.ui = null;
    
    /** @type {ZoomController} */
    this.zoomController = null;
    
    /** @type {Object} Current active settings */
    this.settings = null;
    
    // Frame timing
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fpsUpdateTime = 0;
    this.currentFps = 0;
    
    // Animation frame handle for cleanup
    this.animationFrameId = null;
    
    this.init();
  }
  
  /**
   * Initializes the application.
   */
  init() {
    // Load settings from localStorage
    this.settings = loadSettings();
    
    // Initialize renderer
    try {
      this.renderer = new WebGLRenderer(this.canvas);
    } catch (error) {
      console.error('Failed to initialize WebGL:', error);
      this.showError('WebGL2 is required but not available in your browser.');
      return;
    }
    
    // Get initial canvas dimensions
    const { width, height } = this.renderer.getLogicalDimensions();
    
    // Initialize simulation
    this.simulation = new ParticleSimulation(width, height);
    this.simulation.initialize(
      this.settings.particleCount,
      this.settings.typeCount,
      this.settings.interactionMatrix
    );
    
    // Apply physics settings
    this.simulation.setInteractionRadius(this.settings.interactionRadius);
    this.simulation.setBruteForce(this.settings.useBruteForce);
    this.simulation.setForceFalloff(this.settings.forceFalloff);
    
    // Apply visual settings to renderer
    this.renderer.setColorScheme(this.settings.colorScheme);
    this.renderer.setBackgroundColor(this.settings.bgColor);
    
    // Initialize UI with callbacks for real-time updates
    this.ui = new UIController({
      onColorSchemeChange: (scheme) => this.handleColorSchemeChange(scheme),
      onBgColorChange: (color) => this.handleBgColorChange(color),
      onParticleCountChange: (count) => this.handleParticleCountChange(count),
      onTypeCountChange: (typeCount, matrix) => this.handleTypeCountChange(typeCount, matrix),
      onTypeRemoved: (removedIndex, typeCount, matrix) => this.handleTypeRemoved(removedIndex, typeCount, matrix),
      onMatrixChange: (matrix) => this.handleMatrixChange(matrix),
      onInteractionRadiusChange: (radius) => this.handleInteractionRadiusChange(radius),
      onBruteForceChange: (useBruteForce) => this.handleBruteForceChange(useBruteForce),
      onForceFalloffChange: (falloff) => this.handleForceFalloffChange(falloff),
      onReset: () => this.resetSettings(),
    });
    
    // Load settings into UI
    this.ui.loadSettings(this.settings);
    
    // Setup resize handler
    window.addEventListener('resize', () => this.handleResize());
    
    // Setup zoom and pan controls
    this.zoomController = new ZoomController(this.canvas, this.renderer);
    
    // Initial resize and pan to center
    this.handleResize();
    this.zoomController.centerView();
    
    // Start the game loop
    this.lastFrameTime = performance.now();
    this.fpsUpdateTime = this.lastFrameTime;
    this.gameLoop(this.lastFrameTime);
  }
  
  /**
   * Main game loop - uses requestAnimationFrame for vsync'd rendering.
   * @param {number} timestamp - High-resolution timestamp
   */
  gameLoop(timestamp) {
    // Calculate delta time in seconds
    const dt = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    
    // Update simulation
    this.simulation.update(dt);
    
    // Render
    const { x, y, types, count } = this.simulation.getParticleData();
    this.renderer.render(x, y, types, count);
    
    // Update FPS counter
    this.updateFps(timestamp);
    
    // Schedule next frame
    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }
  
  /**
   * Updates the FPS counter display.
   * @param {number} timestamp
   */
  updateFps(timestamp) {
    this.frameCount++;
    
    // Update FPS display every 500ms
    if (timestamp - this.fpsUpdateTime >= 500) {
      const elapsed = (timestamp - this.fpsUpdateTime) / 1000;
      this.currentFps = Math.round(this.frameCount / elapsed);
      
      document.getElementById('fps-counter').textContent = `FPS: ${this.currentFps}`;
      
      this.frameCount = 0;
      this.fpsUpdateTime = timestamp;
    }
  }
  
  /**
   * Handles canvas resize.
   */
  handleResize() {
    const { width, height } = this.renderer.getLogicalDimensions();
    this.simulation.resize(width, height);
  }
  
  /**
   * Handles color scheme change - applies immediately.
   * @param {string} scheme
   */
  handleColorSchemeChange(scheme) {
    this.settings.colorScheme = scheme;
    this.renderer.setColorScheme(scheme);
    saveSettings(this.settings);
  }
  
  /**
   * Handles background color change - applies immediately.
   * @param {string} color
   */
  handleBgColorChange(color) {
    this.settings.bgColor = color;
    this.renderer.setBackgroundColor(color);
    
    if (color === '#ffffff') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    
    saveSettings(this.settings);
  }
  
  /**
   * Handles particle count change - reinitializes simulation.
   * @param {number} count
   */
  handleParticleCountChange(count) {
    this.settings.particleCount = count;
    
    const { width, height } = this.renderer.getLogicalDimensions();
    this.simulation = new ParticleSimulation(width, height);
    this.simulation.initialize(count, this.settings.typeCount, this.settings.interactionMatrix);
    
    saveSettings(this.settings);
  }
  
  /**
   * Handles type count change - reinitializes simulation with new matrix.
   * @param {number} typeCount
   * @param {number[][]} matrix
   */
  handleTypeCountChange(typeCount, matrix) {
    this.settings.typeCount = typeCount;
    this.settings.interactionMatrix = matrix;
    
    const { width, height } = this.renderer.getLogicalDimensions();
    this.simulation = new ParticleSimulation(width, height);
    this.simulation.initialize(this.settings.particleCount, typeCount, matrix);
    
    saveSettings(this.settings);
  }
  
  /**
   * Handles removal of a specific particle type.
   * Remaps existing particles to new type indices instead of reinitializing.
   * @param {number} removedIndex - The index of the removed type
   * @param {number} typeCount - New type count
   * @param {number[][]} matrix - New interaction matrix
   */
  handleTypeRemoved(removedIndex, typeCount, matrix) {
    this.settings.typeCount = typeCount;
    this.settings.interactionMatrix = matrix;
    
    // Remap particle types in the simulation
    this.simulation.removeParticleType(removedIndex, typeCount, matrix);
    
    saveSettings(this.settings);
  }
  
  /**
   * Handles interaction matrix change - updates simulation in place.
   * @param {number[][]} matrix
   */
  handleMatrixChange(matrix) {
    this.settings.interactionMatrix = matrix.map(row => [...row]);
    this.simulation.setInteractionMatrix(matrix);
    saveSettings(this.settings);
  }
  
  /**
   * Handles interaction radius change - updates simulation in place.
   * @param {number} radius
   */
  handleInteractionRadiusChange(radius) {
    this.settings.interactionRadius = radius;
    this.simulation.setInteractionRadius(radius);
    saveSettings(this.settings);
  }
  
  /**
   * Handles brute force toggle - updates simulation and saves setting.
   * @param {boolean} useBruteForce
   */
  handleBruteForceChange(useBruteForce) {
    this.settings.useBruteForce = useBruteForce;
    this.simulation.setBruteForce(useBruteForce);
    saveSettings(this.settings);
  }
  
  /**
   * Handles force falloff change - updates simulation and saves setting.
   * @param {number} falloff
   */
  handleForceFalloffChange(falloff) {
    this.settings.forceFalloff = falloff;
    this.simulation.setForceFalloff(falloff);
    saveSettings(this.settings);
  }
  
  /**
   * Resets to default settings.
   */
  resetSettings() {
    const defaults = getDefaultSettings();
    this.settings = defaults;
    
    // Update UI
    this.ui.loadSettings(defaults);
    
    // Save to localStorage
    saveSettings(defaults);
    
    // Reinitialize simulation
    const { width, height } = this.renderer.getLogicalDimensions();
    this.simulation = new ParticleSimulation(width, height);
    this.simulation.initialize(defaults.particleCount, defaults.typeCount, defaults.interactionMatrix);
    
    // Apply physics settings
    this.simulation.setInteractionRadius(defaults.interactionRadius);
    this.simulation.setBruteForce(defaults.useBruteForce);
    this.simulation.setForceFalloff(defaults.forceFalloff);
    
    // Update renderer
    this.renderer.setColorScheme(defaults.colorScheme);
    this.renderer.setBackgroundColor(defaults.bgColor);
    
    // Update body class
    if (defaults.bgColor === '#ffffff') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    
    // Reset zoom and pan
    this.zoomController.resetView();
  }
  
  /**
   * Shows an error message to the user.
   * @param {string} message
   */
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 0, 0, 0.9);
      color: white;
      padding: 24px;
      border-radius: 8px;
      font-family: system-ui, sans-serif;
      text-align: center;
      max-width: 400px;
      z-index: 1000;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
  }
  
  /**
   * Cleanup method for SPA navigation if needed.
   */
  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.zoomController) {
      this.zoomController.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ParticleApp());
} else {
  new ParticleApp();
}
