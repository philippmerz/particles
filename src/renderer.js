/**
 * WebGL2 Renderer with instanced rendering for particles.
 * 
 * Uses a single draw call for all particles via instancing.
 * Each particle is a circle approximated by a triangle fan in the vertex shader.
 */

import { PARTICLE_RADIUS, COLOR_SCHEMES } from './constants.js';

// Vertex shader - generates circle geometry and applies instance transforms
const VERTEX_SHADER = `#version 300 es
precision highp float;

// Per-vertex attributes (circle geometry)
in vec2 a_position;

// Per-instance attributes
in vec2 a_offset;      // Particle position
in float a_typeIndex;  // Particle type (for color lookup)

// Uniforms
uniform vec2 u_resolution;
uniform float u_radius;
uniform vec3 u_colors[8];  // Max 8 particle types
uniform float u_zoom;      // Zoom level
uniform vec2 u_pan;        // Pan offset

out vec3 v_color;
out vec2 v_localPos;

void main() {
  // Apply zoom and pan to get screen position
  vec2 worldPos = (a_offset - u_pan) * u_zoom + u_resolution * 0.5;
  worldPos += a_position * u_radius * u_zoom;
  
  // Convert to clip space (-1 to 1)
  vec2 clipPos = (worldPos / u_resolution) * 2.0 - 1.0;
  clipPos.y = -clipPos.y; // Flip Y for canvas coordinates
  
  gl_Position = vec4(clipPos, 0.0, 1.0);
  
  // Pass color and local position for fragment shader
  int typeIdx = int(a_typeIndex);
  v_color = u_colors[typeIdx];
  v_localPos = a_position;
}
`;

// Fragment shader - renders smooth circles with antialiasing
const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec3 v_color;
in vec2 v_localPos;

out vec4 fragColor;

void main() {
  // Distance from center (0,0) in local space
  float dist = length(v_localPos);
  
  // Smooth circle edge with antialiasing
  float alpha = 1.0 - smoothstep(0.85, 1.0, dist);
  
  if (alpha < 0.01) discard;
  
  // Add slight glow/rim effect
  float brightness = 1.0 + 0.3 * (1.0 - dist);
  vec3 color = v_color * brightness;
  
  fragColor = vec4(color, alpha);
}
`;

/**
 * Compiles a shader from source.
 * @param {WebGL2RenderingContext} gl
 * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param {string} source
 * @returns {WebGLShader}
 */
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation error: ${info}`);
  }
  
  return shader;
}

/**
 * Creates and links a shader program.
 * @param {WebGL2RenderingContext} gl
 * @param {string} vertexSource
 * @param {string} fragmentSource
 * @returns {WebGLProgram}
 */
function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Program link error: ${info}`);
  }
  
  // Clean up shaders (they're now part of the program)
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  
  return program;
}

/**
 * Generates vertices for a unit circle (centered at origin, radius 1).
 * @param {number} segments - Number of segments (more = smoother)
 * @returns {Float32Array}
 */
function generateCircleVertices(segments = 32) {
  // Triangle fan: center + perimeter vertices
  const vertices = [0, 0]; // Center
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    vertices.push(Math.cos(angle), Math.sin(angle));
  }
  
  return new Float32Array(vertices);
}

/**
 * Parses hex color to normalized RGB values.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

export class WebGLRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    
    // Initialize WebGL2 context
    this.gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false, // We do our own AA in the shader
      powerPreference: 'high-performance',
    });
    
    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }
    
    this.program = null;
    this.vao = null;
    this.instanceBuffer = null;
    this.instanceData = null;
    this.maxInstances = 0;
    
    this.colorScheme = 'neon';
    this.bgColor = '#000000';
    
    // Zoom and pan state
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    
    // Attribute and uniform locations
    this.locations = {};
    
    this.init();
  }
  
  /**
   * Initializes shaders, buffers, and VAO.
   */
  init() {
    const gl = this.gl;
    
    // Create shader program
    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
    gl.useProgram(this.program);
    
    // Get attribute locations
    this.locations.a_position = gl.getAttribLocation(this.program, 'a_position');
    this.locations.a_offset = gl.getAttribLocation(this.program, 'a_offset');
    this.locations.a_typeIndex = gl.getAttribLocation(this.program, 'a_typeIndex');
    
    // Get uniform locations
    this.locations.u_resolution = gl.getUniformLocation(this.program, 'u_resolution');
    this.locations.u_radius = gl.getUniformLocation(this.program, 'u_radius');
    this.locations.u_colors = gl.getUniformLocation(this.program, 'u_colors');
    this.locations.u_zoom = gl.getUniformLocation(this.program, 'u_zoom');
    this.locations.u_pan = gl.getUniformLocation(this.program, 'u_pan');
    
    // Create VAO
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    
    // Create and upload circle geometry
    const circleVertices = generateCircleVertices(32);
    const geometryBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, geometryBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, circleVertices, gl.STATIC_DRAW);
    
    // Setup geometry attribute (per-vertex)
    gl.enableVertexAttribArray(this.locations.a_position);
    gl.vertexAttribPointer(this.locations.a_position, 2, gl.FLOAT, false, 0, 0);
    
    // Create instance buffer (will be resized as needed)
    this.instanceBuffer = gl.createBuffer();
    this.vertexCount = circleVertices.length / 2;
    
    // Enable blending for smooth circles
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Unbind VAO
    gl.bindVertexArray(null);
  }
  
  /**
   * Ensures instance buffer can hold the required number of particles.
   * @param {number} count
   */
  ensureInstanceCapacity(count) {
    if (count <= this.maxInstances) return;
    
    const gl = this.gl;
    
    // Instance data: x, y, typeIndex per particle (3 floats)
    this.maxInstances = Math.max(count, this.maxInstances * 2 || 256);
    this.instanceData = new Float32Array(this.maxInstances * 3);
    
    // Bind VAO and update instance buffer
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instanceData.byteLength, gl.DYNAMIC_DRAW);
    
    // Setup instance attributes
    const stride = 3 * 4; // 3 floats * 4 bytes
    
    // a_offset (x, y)
    gl.enableVertexAttribArray(this.locations.a_offset);
    gl.vertexAttribPointer(this.locations.a_offset, 2, gl.FLOAT, false, stride, 0);
    gl.vertexAttribDivisor(this.locations.a_offset, 1); // Per-instance
    
    // a_typeIndex
    gl.enableVertexAttribArray(this.locations.a_typeIndex);
    gl.vertexAttribPointer(this.locations.a_typeIndex, 1, gl.FLOAT, false, stride, 2 * 4);
    gl.vertexAttribDivisor(this.locations.a_typeIndex, 1); // Per-instance
    
    gl.bindVertexArray(null);
  }
  
  /**
   * Updates the color scheme.
   * @param {string} scheme - Color scheme name
   */
  setColorScheme(scheme) {
    this.colorScheme = scheme;
  }
  
  /**
   * Updates the background color.
   * @param {string} color - Hex color
   */
  setBackgroundColor(color) {
    this.bgColor = color;
  }
  
  /**
   * Sets the zoom level.
   * @param {number} zoom - Zoom factor (1 = 100%)
   */
  setZoom(zoom) {
    this.zoom = Math.max(0.25, Math.min(4, zoom));
  }
  
  /**
   * Gets the current zoom level.
   * @returns {number}
   */
  getZoom() {
    return this.zoom;
  }
  
  /**
   * Sets the pan offset (world coordinates centered on screen).
   * @param {number} x
   * @param {number} y
   */
  setPan(x, y) {
    this.panX = x;
    this.panY = y;
  }
  
  /**
   * Gets the current pan offset.
   * @returns {{ x: number, y: number }}
   */
  getPan() {
    return { x: this.panX, y: this.panY };
  }
  
  /**
   * Handles canvas resize.
   */
  resize() {
    const gl = this.gl;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth * dpr;
    const height = this.canvas.clientHeight * dpr;
    
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }
  
  /**
   * Renders all particles in a single draw call.
   * @param {Float32Array} x - Particle x positions
   * @param {Float32Array} y - Particle y positions
   * @param {Uint8Array} types - Particle type indices
   * @param {number} count - Number of particles
   */
  render(x, y, types, count) {
    const gl = this.gl;
    
    this.resize();
    this.ensureInstanceCapacity(count);
    
    // Parse background color and clear
    const [bgR, bgG, bgB] = hexToRgb(this.bgColor);
    gl.clearColor(bgR, bgG, bgB, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if (count === 0) return;
    
    // Update instance data
    const dpr = window.devicePixelRatio || 1;
    for (let i = 0; i < count; i++) {
      const offset = i * 3;
      this.instanceData[offset] = x[i] * dpr;
      this.instanceData[offset + 1] = y[i] * dpr;
      this.instanceData[offset + 2] = types[i];
    }
    
    // Upload instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instanceData.subarray(0, count * 3));
    
    // Use program and set uniforms
    gl.useProgram(this.program);
    gl.uniform2f(this.locations.u_resolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.locations.u_radius, PARTICLE_RADIUS * dpr);
    
    // Set colors uniform
    const colors = COLOR_SCHEMES[this.colorScheme] || COLOR_SCHEMES.neon;
    const colorArray = new Float32Array(8 * 3); // 8 colors * 3 components
    for (let i = 0; i < 8; i++) {
      const [r, g, b] = hexToRgb(colors[i % colors.length]);
      colorArray[i * 3] = r;
      colorArray[i * 3 + 1] = g;
      colorArray[i * 3 + 2] = b;
    }
    gl.uniform3fv(this.locations.u_colors, colorArray);
    
    // Set zoom and pan uniforms
    gl.uniform1f(this.locations.u_zoom, this.zoom);
    
    // Pan is in logical coordinates, convert to physical and center on canvas
    const { width, height } = this.getLogicalDimensions();
    const centerX = this.panX || width / 2;
    const centerY = this.panY || height / 2;
    gl.uniform2f(this.locations.u_pan, centerX * dpr, centerY * dpr);
    
    // Draw all particles with instancing
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, this.vertexCount, count);
    gl.bindVertexArray(null);
  }
  
  /**
   * Gets the logical canvas dimensions (CSS pixels).
   * @returns {{ width: number, height: number }}
   */
  getLogicalDimensions() {
    return {
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
    };
  }
  
  /**
   * Cleans up WebGL resources.
   */
  dispose() {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.instanceBuffer) gl.deleteBuffer(this.instanceBuffer);
  }
}
