/**
 * Spatial Hash Grid - O(1) average case neighbor queries.
 * 
 * Divides the simulation space into cells, allowing efficient lookup
 * of particles within a certain radius without checking all N particles.
 */

export class SpatialHash {
  /**
   * @param {number} cellSize - Size of each grid cell (should be >= interaction radius)
   * @param {number} width - Total width of simulation space
   * @param {number} height - Total height of simulation space
   */
  constructor(cellSize, width, height) {
    this.cellSize = cellSize;
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    
    // Pre-allocate grid as flat array of arrays for better cache locality
    this.grid = new Array(this.cols * this.rows);
    this.clear();
  }
  
  /**
   * Resizes the spatial hash when canvas dimensions change.
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.cols = Math.ceil(width / this.cellSize);
    this.rows = Math.ceil(height / this.cellSize);
    this.grid = new Array(this.cols * this.rows);
    this.clear();
  }
  
  /**
   * Clears all cells for the next frame.
   */
  clear() {
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = [];
    }
  }
  
  /**
   * Gets the cell index for a position.
   * @param {number} x
   * @param {number} y
   * @returns {number} - Flat array index
   */
  getCellIndex(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    // Clamp to valid range
    const clampedCol = Math.max(0, Math.min(this.cols - 1, col));
    const clampedRow = Math.max(0, Math.min(this.rows - 1, row));
    return clampedRow * this.cols + clampedCol;
  }
  
  /**
   * Inserts a particle index into the appropriate cell.
   * @param {number} particleIndex - Index in the particle arrays
   * @param {number} x - Particle x position
   * @param {number} y - Particle y position
   */
  insert(particleIndex, x, y) {
    const cellIndex = this.getCellIndex(x, y);
    this.grid[cellIndex].push(particleIndex);
  }
  
  /**
   * Gets all particle indices in neighboring cells (including the particle's own cell).
   * This returns candidates that may or may not be within the interaction radius.
   * @param {number} x - Query position x
   * @param {number} y - Query position y
   * @returns {number[]} - Array of particle indices
   */
  getNearby(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    const nearby = [];
    
    // Check 3x3 neighborhood of cells
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = col + dc;
        const r = row + dr;
        
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
          const cellIndex = r * this.cols + c;
          const cell = this.grid[cellIndex];
          for (let i = 0; i < cell.length; i++) {
            nearby.push(cell[i]);
          }
        }
      }
    }
    
    return nearby;
  }
  
  /**
   * Batch query: for each particle, get nearby particles.
   * More efficient when querying for all particles at once.
   * @param {Float32Array} x - All particle x positions
   * @param {Float32Array} y - All particle y positions
   * @param {number} count - Number of particles
   * @returns {number[][]} - Array of nearby indices for each particle
   */
  getAllNearby(x, y, count) {
    // First, rebuild the grid
    this.clear();
    for (let i = 0; i < count; i++) {
      this.insert(i, x[i], y[i]);
    }
    
    // Then query for each particle
    const result = new Array(count);
    for (let i = 0; i < count; i++) {
      result[i] = this.getNearby(x[i], y[i]);
    }
    return result;
  }
}
