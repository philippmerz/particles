/**
 * Settings Manager - handles persistence and state for simulation configuration.
 * Uses localStorage for cross-session persistence.
 */

import {
  STORAGE_KEY,
  DEFAULT_PARTICLE_COUNT,
  DEFAULT_TYPE_COUNT,
  MATRIX_MIN,
  MATRIX_MAX,
} from './constants.js';

/**
 * @typedef {Object} SimulationSettings
 * @property {number} particleCount - Number of particles
 * @property {number} typeCount - Number of particle types
 * @property {number[][]} interactionMatrix - typeCount × typeCount attraction/repulsion matrix
 * @property {string} bgColor - Background color hex
 * @property {string} colorScheme - Color scheme name
 */

/**
 * Generates a random interaction matrix with values in [MATRIX_MIN, MATRIX_MAX].
 * @param {number} size - Matrix dimensions (size × size)
 * @returns {number[][]} - Random interaction matrix
 */
export function generateRandomMatrix(size) {
  const matrix = [];
  for (let i = 0; i < size; i++) {
    const row = [];
    for (let j = 0; j < size; j++) {
      // Random value between MATRIX_MIN and MATRIX_MAX, rounded to 1 decimal
      const value = MATRIX_MIN + Math.random() * (MATRIX_MAX - MATRIX_MIN);
      row.push(Math.round(value * 10) / 10);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Creates default settings object.
 * @returns {SimulationSettings}
 */
export function getDefaultSettings() {
  return {
    particleCount: DEFAULT_PARTICLE_COUNT,
    typeCount: DEFAULT_TYPE_COUNT,
    interactionMatrix: generateRandomMatrix(DEFAULT_TYPE_COUNT),
    bgColor: '#000000',
    colorScheme: 'neon',
  };
}

/**
 * Validates and sanitizes loaded settings.
 * Ensures all required fields exist and have valid values.
 * @param {any} settings - Settings object to validate
 * @returns {SimulationSettings} - Valid settings object
 */
function validateSettings(settings) {
  const defaults = getDefaultSettings();
  
  if (!settings || typeof settings !== 'object') {
    return defaults;
  }
  
  // Validate particleCount
  const particleCount = typeof settings.particleCount === 'number'
    ? Math.max(10, Math.min(2000, Math.round(settings.particleCount)))
    : defaults.particleCount;
  
  // Validate typeCount
  const typeCount = typeof settings.typeCount === 'number'
    ? Math.max(2, Math.min(8, Math.round(settings.typeCount)))
    : defaults.typeCount;
  
  // Validate interactionMatrix
  let interactionMatrix = settings.interactionMatrix;
  if (!Array.isArray(interactionMatrix) || interactionMatrix.length !== typeCount) {
    interactionMatrix = generateRandomMatrix(typeCount);
  } else {
    // Ensure all rows have correct length and valid values
    interactionMatrix = interactionMatrix.map((row, i) => {
      if (!Array.isArray(row) || row.length !== typeCount) {
        return generateRandomMatrix(typeCount)[i];
      }
      return row.map(val => {
        if (typeof val !== 'number' || isNaN(val)) {
          return Math.round((MATRIX_MIN + Math.random() * (MATRIX_MAX - MATRIX_MIN)) * 10) / 10;
        }
        return Math.max(MATRIX_MIN, Math.min(MATRIX_MAX, val));
      });
    });
  }
  
  // Validate bgColor
  const bgColor = ['#000000', '#ffffff'].includes(settings.bgColor)
    ? settings.bgColor
    : defaults.bgColor;
  
  // Validate colorScheme
  const validSchemes = ['neon', 'pastel', 'warm', 'cool', 'monochrome'];
  const colorScheme = validSchemes.includes(settings.colorScheme)
    ? settings.colorScheme
    : defaults.colorScheme;
  
  return { particleCount, typeCount, interactionMatrix, bgColor, colorScheme };
}

/**
 * Loads settings from localStorage, falling back to defaults.
 * @returns {SimulationSettings}
 */
export function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return validateSettings(parsed);
    }
  } catch (e) {
    console.warn('Failed to load settings from localStorage:', e);
  }
  return getDefaultSettings();
}

/**
 * Saves settings to localStorage.
 * @param {SimulationSettings} settings
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings to localStorage:', e);
  }
}

/**
 * Resizes the interaction matrix when type count changes.
 * Preserves existing values where possible, fills new cells with random values.
 * @param {number[][]} oldMatrix - Existing matrix
 * @param {number} newSize - New matrix size
 * @returns {number[][]} - Resized matrix
 */
export function resizeMatrix(oldMatrix, newSize) {
  const matrix = [];
  for (let i = 0; i < newSize; i++) {
    const row = [];
    for (let j = 0; j < newSize; j++) {
      if (oldMatrix[i] && typeof oldMatrix[i][j] === 'number') {
        row.push(oldMatrix[i][j]);
      } else {
        row.push(Math.round((MATRIX_MIN + Math.random() * (MATRIX_MAX - MATRIX_MIN)) * 10) / 10);
      }
    }
    matrix.push(row);
  }
  return matrix;
}
