/**
 * UI Controller - manages the sidebar and user interactions.
 * 
 * Handles:
 * - Sidebar toggle and animation
 * - Particle count and type sliders
 * - Interaction matrix editor
 * - Color scheme selection
 * - Settings persistence triggers
 */

import { 
  COLOR_SCHEMES, 
  MATRIX_MIN, 
  MATRIX_MAX,
  MIN_INTERACTION_RADIUS,
  MAX_INTERACTION_RADIUS,
  MIN_FORCE_FALLOFF,
  MAX_FORCE_FALLOFF,
  MIN_PARTICLE_RADIUS,
  MAX_PARTICLE_RADIUS,
} from './constants.js';
import { generateRandomMatrix, resizeMatrix } from './settings.js';

export class UIController {
  /**
   * @param {Object} callbacks - Event callbacks
   * @param {Function} callbacks.onColorSchemeChange - Called when color scheme changes
   * @param {Function} callbacks.onBgColorChange - Called when background color changes
   * @param {Function} callbacks.onParticleCountChange - Called when particle count changes
   * @param {Function} callbacks.onTypeAdded - Called when a new particle type is added
   * @param {Function} callbacks.onTypeRemoved - Called when a specific type is removed
   * @param {Function} callbacks.onMatrixChange - Called when interaction matrix changes
   * @param {Function} callbacks.onInteractionRadiusChange - Called when interaction radius changes
   * @param {Function} callbacks.onBruteForceChange - Called when brute force toggle changes
   * @param {Function} callbacks.onForceFalloffChange - Called when force falloff changes
   * @param {Function} callbacks.onParticleRadiusChange - Called when particle radius changes
   * @param {Function} callbacks.onReset - Called when user clicks Reset
   */
  constructor(callbacks) {
    this.callbacks = callbacks;
    
    // Current UI state (mirrors settings but not applied until user clicks Apply)
    this.particleCount = 100;
    this.typeCount = 3;
    this.interactionMatrix = generateRandomMatrix(3);
    this.bgColor = '#000000';
    this.colorScheme = 'neon';
    this.interactionRadius = 300;
    this.useBruteForce = true;
    this.forceFalloff = 2.0;
    this.particleRadius = 4;
    
    // DOM elements
    this.elements = {};
    
    this.init();
  }
  
  /**
   * Initializes DOM references and event listeners.
   */
  init() {
    // Cache DOM elements
    this.elements = {
      sidebar: document.getElementById('sidebar'),
      sidebarToggle: document.getElementById('sidebar-toggle'),
      
      particleCountSlider: document.getElementById('particle-count'),
      particleCountInput: document.getElementById('particle-count-input'),
      particleCountDisplay: document.getElementById('particle-count-display'),
      
      interactionRadiusSection: document.getElementById('interaction-radius-section'),
      interactionRadiusSlider: document.getElementById('interaction-radius'),
      interactionRadiusInput: document.getElementById('interaction-radius-input'),
      interactionRadiusDisplay: document.getElementById('interaction-radius-display'),
      
      forceFalloffSlider: document.getElementById('force-falloff'),
      forceFalloffInput: document.getElementById('force-falloff-input'),
      forceFalloffDisplay: document.getElementById('force-falloff-display'),
      
      particleRadiusSlider: document.getElementById('particle-radius'),
      particleRadiusInput: document.getElementById('particle-radius-input'),
      particleRadiusDisplay: document.getElementById('particle-radius-display'),
      
      matrixContainer: document.getElementById('matrix-container'),
      particleTypeDots: document.getElementById('particle-type-dots'),
      addTypeBtn: document.getElementById('add-particle-type'),
      randomizeMatrixBtn: document.getElementById('randomize-matrix'),
      clearMatrixBtn: document.getElementById('clear-matrix'),
      
      bruteForceToggle: document.getElementById('brute-force-toggle'),
      
      resetBtn: document.getElementById('reset-settings'),
    };
    
    this.setupEventListeners();
    this.renderMatrix();
    this.renderParticleTypeDots();
  }
  
  /**
   * Sets up all event listeners.
   */
  setupEventListeners() {
    // Sidebar toggle
    this.elements.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    
    // Particle count
    this.elements.particleCountSlider.addEventListener('input', (e) => {
      this.particleCount = parseInt(e.target.value, 10);
      this.syncParticleCountUI();
      this.callbacks.onParticleCountChange(this.particleCount);
    });
    
    this.elements.particleCountInput.addEventListener('change', (e) => {
      this.particleCount = Math.max(10, Math.min(2000, parseInt(e.target.value, 10) || 100));
      this.syncParticleCountUI();
      this.callbacks.onParticleCountChange(this.particleCount);
    });
    
    // Interaction radius
    this.elements.interactionRadiusSlider.addEventListener('input', (e) => {
      this.interactionRadius = parseInt(e.target.value, 10);
      this.syncInteractionRadiusUI();
      this.callbacks.onInteractionRadiusChange(this.interactionRadius);
    });
    
    this.elements.interactionRadiusInput.addEventListener('change', (e) => {
      this.interactionRadius = Math.max(
        MIN_INTERACTION_RADIUS, 
        Math.min(MAX_INTERACTION_RADIUS, parseInt(e.target.value, 10) || 300)
      );
      this.syncInteractionRadiusUI();
      this.callbacks.onInteractionRadiusChange(this.interactionRadius);
    });
    
    // Force falloff
    this.elements.forceFalloffSlider.addEventListener('input', (e) => {
      this.forceFalloff = parseFloat(e.target.value);
      this.syncForceFalloffUI();
      this.callbacks.onForceFalloffChange(this.forceFalloff);
    });
    
    this.elements.forceFalloffInput.addEventListener('change', (e) => {
      this.forceFalloff = Math.max(
        MIN_FORCE_FALLOFF,
        Math.min(MAX_FORCE_FALLOFF, parseFloat(e.target.value) || 2.0)
      );
      this.syncForceFalloffUI();
      this.callbacks.onForceFalloffChange(this.forceFalloff);
    });
    
    // Particle radius
    this.elements.particleRadiusSlider.addEventListener('input', (e) => {
      this.particleRadius = parseInt(e.target.value, 10);
      this.syncParticleRadiusUI();
      this.callbacks.onParticleRadiusChange(this.particleRadius);
    });
    
    this.elements.particleRadiusInput.addEventListener('change', (e) => {
      this.particleRadius = Math.max(
        MIN_PARTICLE_RADIUS,
        Math.min(MAX_PARTICLE_RADIUS, parseInt(e.target.value, 10) || 4)
      );
      this.syncParticleRadiusUI();
      this.callbacks.onParticleRadiusChange(this.particleRadius);
    });
    
    // Add particle type button
    this.elements.addTypeBtn.addEventListener('click', () => {
      this.addParticleType();
    });
    
    // Randomize matrix
    this.elements.randomizeMatrixBtn.addEventListener('click', () => {
      this.interactionMatrix = generateRandomMatrix(this.typeCount);
      this.renderMatrix();
      this.callbacks.onMatrixChange(this.interactionMatrix);
    });
    
    // Clear matrix (set all values to 0)
    this.elements.clearMatrixBtn.addEventListener('click', () => {
      this.interactionMatrix = this.createZeroMatrix(this.typeCount);
      this.renderMatrix();
      this.callbacks.onMatrixChange(this.interactionMatrix);
    });
    
    // Background color
    document.querySelectorAll('input[name="bg-color"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.bgColor = e.target.value;
        this.updateBodyClass();
        this.callbacks.onBgColorChange(this.bgColor);
      });
    });
    
    // Color scheme
    document.querySelectorAll('input[name="color-scheme"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.colorScheme = e.target.value;
        this.renderParticleTypeDots(); // Update dot colors
        this.renderMatrix(); // Update matrix header colors
        this.callbacks.onColorSchemeChange(this.colorScheme);
      });
    });
    
    // Reset button
    this.elements.resetBtn.addEventListener('click', () => {
      this.callbacks.onReset();
    });
    
    // Brute force toggle
    this.elements.bruteForceToggle.addEventListener('change', (e) => {
      this.useBruteForce = e.target.checked;
      this.updateRadiusSectionVisibility();
      this.callbacks.onBruteForceChange(this.useBruteForce);
    });
    
    // Close sidebar when clicking outside (on canvas)
    document.getElementById('canvas').addEventListener('click', () => {
      if (this.elements.sidebar.classList.contains('expanded')) {
        this.toggleSidebar();
      }
    });
    
    // Keyboard shortcut to toggle sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.sidebar.classList.contains('expanded')) {
        this.toggleSidebar();
      }
    });
  }
  
  /**
   * Toggles sidebar visibility.
   */
  toggleSidebar() {
    this.elements.sidebar.classList.toggle('collapsed');
    this.elements.sidebar.classList.toggle('expanded');
    this.elements.sidebarToggle.classList.toggle('expanded');
  }
  
  /**
   * Syncs particle count UI elements.
   */
  syncParticleCountUI() {
    this.elements.particleCountSlider.value = this.particleCount;
    this.elements.particleCountInput.value = this.particleCount;
    this.elements.particleCountDisplay.textContent = this.particleCount;
  }
  
  /**
   * Syncs interaction radius UI elements.
   */
  syncInteractionRadiusUI() {
    this.elements.interactionRadiusSlider.value = this.interactionRadius;
    this.elements.interactionRadiusInput.value = this.interactionRadius;
    this.elements.interactionRadiusDisplay.textContent = this.interactionRadius;
  }
  
  /**
   * Syncs force falloff UI elements.
   */
  syncForceFalloffUI() {
    this.elements.forceFalloffSlider.value = this.forceFalloff;
    this.elements.forceFalloffInput.value = this.forceFalloff;
    this.elements.forceFalloffDisplay.textContent = this.forceFalloff.toFixed(1);
  }
  
  /**
   * Syncs particle radius UI elements.
   */
  syncParticleRadiusUI() {
    this.elements.particleRadiusSlider.value = this.particleRadius;
    this.elements.particleRadiusInput.value = this.particleRadius;
    this.elements.particleRadiusDisplay.textContent = this.particleRadius;
  }
  
  /**
   * Creates a zero-filled interaction matrix.
   * @param {number} size - Matrix dimensions (size × size)
   * @returns {number[][]} - Zero matrix
   */
  createZeroMatrix(size) {
    const matrix = [];
    for (let i = 0; i < size; i++) {
      matrix.push(new Array(size).fill(0));
    }
    return matrix;
  }
  
  /**
   * Renders the particle type dots for adding/removing types.
   */
  renderParticleTypeDots() {
    const container = this.elements.particleTypeDots;
    container.innerHTML = '';
    
    const colors = COLOR_SCHEMES[this.colorScheme] || COLOR_SCHEMES.neon;
    const minTypes = 2;
    const maxTypes = 8;
    
    // Create a dot for each particle type
    for (let i = 0; i < this.typeCount; i++) {
      const dot = document.createElement('button');
      dot.className = 'particle-type-dot';
      dot.style.backgroundColor = colors[i % colors.length];
      dot.title = this.typeCount <= minTypes ? `Type ${i + 1}` : `Remove type ${i + 1}`;
      dot.setAttribute('aria-label', `Particle type ${i + 1}`);
      
      // Disable removal if at minimum types
      if (this.typeCount <= minTypes) {
        dot.classList.add('disabled');
      } else {
        dot.addEventListener('click', () => this.removeParticleType(i));
      }
      
      container.appendChild(dot);
    }
    
    // Update add button state
    this.elements.addTypeBtn.disabled = this.typeCount >= maxTypes;
    this.elements.addTypeBtn.title = this.typeCount >= maxTypes ? 'Max 8 types' : 'Add type';
  }
  
  /**
   * Adds a new particle type.
   */
  addParticleType() {
    const maxTypes = 8;
    if (this.typeCount >= maxTypes) return;
    
    // Expand the matrix by adding a new row and column with random values
    const newSize = this.typeCount + 1;
    const newMatrix = [];
    
    for (let i = 0; i < newSize; i++) {
      const row = [];
      for (let j = 0; j < newSize; j++) {
        if (i < this.typeCount && j < this.typeCount) {
          // Keep existing values
          row.push(this.interactionMatrix[i][j]);
        } else {
          // New row or column - random value
          const value = MATRIX_MIN + Math.random() * (MATRIX_MAX - MATRIX_MIN);
          row.push(Math.round(value * 10) / 10);
        }
      }
      newMatrix.push(row);
    }
    
    this.interactionMatrix = newMatrix;
    this.typeCount = newSize;
    
    // Update UI
    this.renderMatrix();
    this.renderParticleTypeDots();
    
    // Notify callback
    this.callbacks.onTypeAdded(this.typeCount, this.interactionMatrix);
  }
  
  /**
   * Removes a particle type at the specified index.
   * @param {number} typeIndex - Index of the type to remove
   */
  removeParticleType(typeIndex) {
    const minTypes = 2;
    if (this.typeCount <= minTypes) return;
    if (typeIndex < 0 || typeIndex >= this.typeCount) return;
    
    // Remove the row and column from the matrix
    const newSize = this.typeCount - 1;
    const newMatrix = [];
    
    for (let i = 0; i < this.typeCount; i++) {
      if (i === typeIndex) continue; // Skip removed row
      
      const row = [];
      for (let j = 0; j < this.typeCount; j++) {
        if (j === typeIndex) continue; // Skip removed column
        row.push(this.interactionMatrix[i][j]);
      }
      newMatrix.push(row);
    }
    
    this.interactionMatrix = newMatrix;
    this.typeCount = newSize;
    
    // Update UI
    this.renderMatrix();
    this.renderParticleTypeDots();
    
    // Notify callback - pass the removed index so simulation can remap particles
    this.callbacks.onTypeRemoved(typeIndex, this.typeCount, this.interactionMatrix);
  }
  
  /**
   * Handles type count change - resizes matrix.
   * @param {number} newCount
   */
  handleTypeCountChange(newCount) {
    if (newCount === this.typeCount) return;
    
    this.interactionMatrix = resizeMatrix(this.interactionMatrix, newCount);
    this.typeCount = newCount;
    this.renderMatrix();
    this.renderParticleTypeDots();
  }
  
  /**
   * Renders the interaction matrix editor.
   */
  renderMatrix() {
    const container = this.elements.matrixContainer;
    container.innerHTML = '';
    
    const size = this.typeCount;
    const colors = COLOR_SCHEMES[this.colorScheme] || COLOR_SCHEMES.neon;
    
    // Set grid columns: header + size cells
    container.style.gridTemplateColumns = `28px repeat(${size}, 1fr)`;
    
    // Header row (column labels)
    container.appendChild(this.createMatrixHeader('')); // Empty corner cell
    for (let j = 0; j < size; j++) {
      const header = this.createMatrixHeader(`${j + 1}`);
      header.style.color = colors[j % colors.length];
      container.appendChild(header);
    }
    
    // Data rows
    for (let i = 0; i < size; i++) {
      // Row header
      const rowHeader = document.createElement('div');
      rowHeader.className = 'matrix-row-header';
      rowHeader.textContent = `${i + 1}`;
      rowHeader.style.color = colors[i % colors.length];
      container.appendChild(rowHeader);
      
      // Cells
      for (let j = 0; j < size; j++) {
        // Create wrapper for cell + dot
        const wrapper = document.createElement('div');
        wrapper.className = 'matrix-cell-wrapper';
        
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'matrix-cell';
        input.min = MATRIX_MIN;
        input.max = MATRIX_MAX;
        input.step = 0.1;
        input.value = this.interactionMatrix[i][j];
        input.title = `Type ${i + 1} → Type ${j + 1}`;
        
        // Create dot indicator
        const dot = document.createElement('div');
        dot.className = 'matrix-cell-dot';
        
        // Update matrix on change
        input.addEventListener('change', (e) => {
          const value = parseFloat(e.target.value);
          if (!isNaN(value)) {
            this.interactionMatrix[i][j] = Math.max(MATRIX_MIN, Math.min(MATRIX_MAX, value));
            e.target.value = this.interactionMatrix[i][j];
            this.callbacks.onMatrixChange(this.interactionMatrix);
          }
        });
        
        // Color the dot based on value
        this.colorMatrixDot(dot, input.value);
        input.addEventListener('input', () => this.colorMatrixDot(dot, input.value));
        
        wrapper.appendChild(input);
        wrapper.appendChild(dot);
        container.appendChild(wrapper);
      }
    }
  }
  
  /**
   * Creates a matrix header cell.
   * @param {string} text
   * @returns {HTMLElement}
   */
  createMatrixHeader(text) {
    const header = document.createElement('div');
    header.className = 'matrix-header';
    header.textContent = text;
    return header;
  }
  
  /**
   * Colors a matrix dot indicator based on value (red=repulsion, green=attraction).
   * @param {HTMLElement} dot - The dot element
   * @param {number|string} value - The cell value
   */
  colorMatrixDot(dot, value) {
    const numValue = parseFloat(value) || 0;
    const normalized = (numValue - MATRIX_MIN) / (MATRIX_MAX - MATRIX_MIN); // 0 to 1
    
    // Interpolate from red (0) through neutral (0.5) to green (1)
    let r, g, b;
    if (normalized < 0.5) {
      // Red (repulsion)
      const t = normalized * 2;
      r = 220;
      g = Math.round(80 * t);
      b = Math.round(80 * t);
    } else {
      // Green (attraction)
      const t = (normalized - 0.5) * 2;
      r = Math.round(220 * (1 - t));
      g = Math.round(80 + 140 * t);
      b = Math.round(80 * (1 - t));
    }
    
    dot.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  }
  
  /**
   * Updates body class based on background color.
   */
  updateBodyClass() {
    if (this.bgColor === '#ffffff') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }
  
  /**
   * Shows/hides the interaction radius section based on brute force mode.
   * Radius is only relevant when spatial hashing is enabled.
   */
  updateRadiusSectionVisibility() {
    this.elements.interactionRadiusSection.style.display = this.useBruteForce ? 'none' : 'block';
  }
  
  /**
   * Gets current UI settings.
   * @returns {Object}
   */
  getSettings() {
    return {
      particleCount: this.particleCount,
      typeCount: this.typeCount,
      interactionMatrix: this.interactionMatrix.map(row => [...row]),
      bgColor: this.bgColor,
      colorScheme: this.colorScheme,
      interactionRadius: this.interactionRadius,
      useBruteForce: this.useBruteForce,
      forceFalloff: this.forceFalloff,
      particleRadius: this.particleRadius,
    };
  }
  
  /**
   * Loads settings into the UI (e.g., from localStorage).
   * @param {Object} settings
   */
  loadSettings(settings) {
    this.particleCount = settings.particleCount;
    this.typeCount = settings.typeCount;
    this.interactionMatrix = settings.interactionMatrix.map(row => [...row]);
    this.bgColor = settings.bgColor;
    this.colorScheme = settings.colorScheme;
    this.interactionRadius = settings.interactionRadius;
    this.useBruteForce = settings.useBruteForce;
    this.forceFalloff = settings.forceFalloff;
    this.particleRadius = settings.particleRadius;
    
    // Update UI elements
    this.syncParticleCountUI();
    this.syncInteractionRadiusUI();
    this.syncForceFalloffUI();
    this.syncParticleRadiusUI();
    this.renderMatrix();
    this.renderParticleTypeDots();
    this.updateBodyClass();
    
    // Update radio buttons
    document.querySelector(`input[name="bg-color"][value="${this.bgColor}"]`).checked = true;
    document.querySelector(`input[name="color-scheme"][value="${this.colorScheme}"]`).checked = true;
    
    // Update brute force checkbox and radius visibility
    this.elements.bruteForceToggle.checked = this.useBruteForce;
    this.updateRadiusSectionVisibility();
  }
}
