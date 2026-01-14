/**
 * ZoomController - Centralized zoom and pan management.
 * 
 * Handles all zoom/pan input methods:
 * - UI controls (slider, +/- buttons)
 * - Mouse wheel (scroll to pan, Ctrl+scroll or pinch to zoom)
 * - Middle-mouse button (drag to pan, scroll to zoom)
 * - Keyboard shortcuts (Cmd/Ctrl +/-/0)
 * 
 * Provides a unified interface for the renderer and ensures
 * consistent behavior across all input methods.
 */

/** Zoom constraints */
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const WHEEL_ZOOM_SENSITIVITY = 0.01;
const MOUSE_WHEEL_ZOOM_SENSITIVITY = 0.002;

export class ZoomController {
  /**
   * @param {HTMLCanvasElement} canvas - The canvas element to attach listeners to
   * @param {Object} renderer - The renderer with setZoom/getZoom/setPan/getPan methods
   */
  constructor(canvas, renderer) {
    this.canvas = canvas;
    this.renderer = renderer;
    
    // Middle-mouse pan state
    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;
    
    // DOM elements for UI controls
    this.elements = {
      slider: document.getElementById('zoom-slider'),
      display: document.getElementById('zoom-display'),
      zoomInBtn: document.getElementById('zoom-in'),
      zoomOutBtn: document.getElementById('zoom-out'),
    };
    
    // Bind methods to preserve context
    this.handleWheel = this.handleWheel.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    
    this.init();
  }
  
  /**
   * Initializes all event listeners.
   */
  init() {
    this.setupUIControls();
    this.setupWheelZoom();
    this.setupMiddleMousePan();
    this.setupKeyboardShortcuts();
  }
  
  /**
   * Sets up the UI slider and button controls.
   */
  setupUIControls() {
    const { slider, zoomInBtn, zoomOutBtn } = this.elements;
    
    // Slider input
    slider.addEventListener('input', (e) => {
      const zoom = parseFloat(e.target.value);
      this.setZoom(zoom);
    });
    
    // Zoom in button
    zoomInBtn.addEventListener('click', () => {
      this.zoomIn();
    });
    
    // Zoom out button
    zoomOutBtn.addEventListener('click', () => {
      this.zoomOut();
    });
  }
  
  /**
   * Sets up mouse wheel zoom and pan.
   * - Regular scroll: pan
   * - Ctrl+scroll or pinch: zoom
   */
  setupWheelZoom() {
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
  }
  
  /**
   * Handles wheel events for zoom and pan.
   * @param {WheelEvent} e
   */
  handleWheel(e) {
    e.preventDefault();
    
    // During middle-mouse pan, wheel zooms
    if (this.isPanning) {
      this.handleWheelZoom(e, MOUSE_WHEEL_ZOOM_SENSITIVITY);
      return;
    }
    
    // Pinch-to-zoom (trackpad) or Ctrl+scroll
    if (e.ctrlKey) {
      this.handleWheelZoom(e, WHEEL_ZOOM_SENSITIVITY);
    } else {
      // Regular scroll - pan the view
      this.handleWheelPan(e);
    }
  }
  
  /**
   * Handles wheel-based zooming with zoom-toward-cursor behavior.
   * @param {WheelEvent} e
   * @param {number} sensitivity - Zoom sensitivity multiplier
   */
  handleWheelZoom(e, sensitivity) {
    const currentZoom = this.renderer.getZoom();
    const zoomDelta = -e.deltaY * sensitivity;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoom + zoomDelta));
    
    if (newZoom !== currentZoom) {
      // Zoom toward cursor position for better UX
      this.zoomTowardPoint(e.clientX, e.clientY, newZoom);
    }
  }
  
  /**
   * Handles wheel-based panning.
   * @param {WheelEvent} e
   */
  handleWheelPan(e) {
    const pan = this.renderer.getPan();
    const zoom = this.renderer.getZoom();
    
    this.renderer.setPan(
      pan.x + e.deltaX / zoom,
      pan.y + e.deltaY / zoom
    );
  }
  
  /**
   * Sets up middle-mouse button pan.
   * - Middle-mouse down + drag: pan
   * - During pan, scroll wheel: zoom
   */
  setupMiddleMousePan() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    
    // Use document for move/up to handle cursor leaving canvas
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    
    // Prevent context menu on middle-click (some browsers trigger it)
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
    
    // Also prevent default middle-click behavior (auto-scroll on some browsers)
    this.canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault();
      }
    });
  }
  
  /**
   * Handles mouse down - initiates pan if middle button.
   * @param {MouseEvent} e
   */
  handleMouseDown(e) {
    // Middle mouse button (button === 1)
    if (e.button === 1) {
      e.preventDefault();
      this.startPan(e.clientX, e.clientY);
    }
  }
  
  /**
   * Handles mouse move - updates pan if currently panning.
   * @param {MouseEvent} e
   */
  handleMouseMove(e) {
    if (!this.isPanning) return;
    
    const deltaX = e.clientX - this.lastPanX;
    const deltaY = e.clientY - this.lastPanY;
    
    const pan = this.renderer.getPan();
    const zoom = this.renderer.getZoom();
    
    // Pan is inverted (dragging right moves view left, showing more on right)
    this.renderer.setPan(
      pan.x - deltaX / zoom,
      pan.y - deltaY / zoom
    );
    
    this.lastPanX = e.clientX;
    this.lastPanY = e.clientY;
  }
  
  /**
   * Handles mouse up - ends pan if middle button released.
   * @param {MouseEvent} e
   */
  handleMouseUp(e) {
    if (e.button === 1 && this.isPanning) {
      this.endPan();
    }
  }
  
  /**
   * Prevents context menu during middle-mouse operations.
   * @param {Event} e
   */
  handleContextMenu(e) {
    // Only prevent if we're in the middle of panning
    if (this.isPanning) {
      e.preventDefault();
    }
  }
  
  /**
   * Starts a pan operation.
   * @param {number} x - Starting X position
   * @param {number} y - Starting Y position
   */
  startPan(x, y) {
    this.isPanning = true;
    this.lastPanX = x;
    this.lastPanY = y;
    
    // Change cursor to indicate panning
    this.canvas.classList.add('panning');
  }
  
  /**
   * Ends the current pan operation.
   */
  endPan() {
    this.isPanning = false;
    this.canvas.classList.remove('panning');
  }
  
  /**
   * Sets up keyboard shortcuts for zoom.
   * - Cmd/Ctrl + Plus: Zoom in
   * - Cmd/Ctrl + Minus: Zoom out
   * - Cmd/Ctrl + 0: Reset zoom and center
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', this.handleKeyDown);
  }
  
  /**
   * Handles keyboard shortcuts.
   * @param {KeyboardEvent} e
   */
  handleKeyDown(e) {
    // Don't handle if typing in an input
    if (e.target.tagName === 'INPUT') return;
    
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;
    
    switch (e.key) {
      case '=':
      case '+':
        e.preventDefault();
        this.zoomIn();
        break;
      case '-':
        e.preventDefault();
        this.zoomOut();
        break;
      case '0':
        e.preventDefault();
        this.resetView();
        break;
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Sets the zoom level and updates UI.
   * @param {number} zoom - New zoom level
   */
  setZoom(zoom) {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    this.renderer.setZoom(clampedZoom);
    this.updateDisplay();
  }
  
  /**
   * Gets the current zoom level.
   * @returns {number}
   */
  getZoom() {
    return this.renderer.getZoom();
  }
  
  /**
   * Zooms in by one step.
   */
  zoomIn() {
    this.setZoom(this.getZoom() + ZOOM_STEP);
  }
  
  /**
   * Zooms out by one step.
   */
  zoomOut() {
    this.setZoom(this.getZoom() - ZOOM_STEP);
  }
  
  /**
   * Zooms toward a specific screen point (for zoom-to-cursor behavior).
   * Keeps the point under the cursor stationary while zooming.
   * @param {number} screenX - Screen X coordinate
   * @param {number} screenY - Screen Y coordinate
   * @param {number} newZoom - Target zoom level
   */
  zoomTowardPoint(screenX, screenY, newZoom) {
    const rect = this.canvas.getBoundingClientRect();
    const currentZoom = this.getZoom();
    const pan = this.renderer.getPan();
    const { width, height } = this.renderer.getLogicalDimensions();
    
    // Convert screen coordinates to canvas-relative coordinates
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // Calculate the world position under the cursor before zoom
    // The current view: worldPos = pan + (canvasPos - center) / zoom
    const centerX = width / 2;
    const centerY = height / 2;
    
    const worldX = pan.x + (canvasX - centerX) / currentZoom;
    const worldY = pan.y + (canvasY - centerY) / currentZoom;
    
    // Apply new zoom
    this.renderer.setZoom(newZoom);
    
    // Calculate new pan to keep the world point under the cursor
    // We want: worldX = newPan.x + (canvasX - centerX) / newZoom
    // So: newPan.x = worldX - (canvasX - centerX) / newZoom
    const newPanX = worldX - (canvasX - centerX) / newZoom;
    const newPanY = worldY - (canvasY - centerY) / newZoom;
    
    this.renderer.setPan(newPanX, newPanY);
    this.updateDisplay();
  }
  
  /**
   * Resets zoom to 100% and centers the view.
   */
  resetView() {
    this.setZoom(1);
    this.centerView();
  }
  
  /**
   * Centers the view on the simulation.
   */
  centerView() {
    const { width, height } = this.renderer.getLogicalDimensions();
    this.renderer.setPan(width / 2, height / 2);
  }
  
  /**
   * Updates the UI display elements.
   */
  updateDisplay() {
    const zoom = this.getZoom();
    this.elements.display.textContent = `${Math.round(zoom * 100)}%`;
    this.elements.slider.value = zoom;
  }
  
  /**
   * Cleans up event listeners.
   */
  dispose() {
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }
}
