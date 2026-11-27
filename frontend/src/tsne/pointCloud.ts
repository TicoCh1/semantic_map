import type { CustomLayerInterface, CustomRenderMethodInput, Map as LibreMap } from "maplibre-gl";

const vertex = `#version 300 es
layout(location=0) in vec2 position;
layout(location=1) in vec4 colour;
uniform mat4 projection;
uniform float size;
out vec4 rgb;
void main() {
  gl_Position = projection * vec4(position, 0., 1.);
  gl_PointSize = size;
  rgb = colour;
}`;
const fragment = `#version 300 es
precision mediump float;
in vec4 rgb;
uniform float opacity;
out vec4 pixel;
void main() {
  float r = length(gl_PointCoord - .5);
  if (r > .5) discard;
  float a = rgb.a * opacity * (1. - smoothstep(.4, .5, r));
  pixel = vec4(rgb.rgb * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || "Could not compile the point renderer.");
  }
  return shader;
}

/** The London export stores two Mercator float32 coordinates followed by four RGBA bytes. */
export class TsnePointCloud implements CustomLayerInterface {
  readonly id = "london-tsne";
  readonly type = "custom";
  private map?: LibreMap;
  private program?: WebGLProgram;
  private uniforms?: Record<"projection" | "size" | "opacity", WebGLUniformLocation | null>;
  private buffers = new Map<number, { buffer: WebGLBuffer; vao: WebGLVertexArrayObject }>();
  readonly records = new Map<number, ArrayBuffer>();
  weights: [number, number][] = [];

  onAdd(map: LibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = compile(gl, type, source);
      gl.attachShader(program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(message || "Could not initialize the t-SNE renderer.");
    }
    this.program = program;
    this.uniforms = { projection: gl.getUniformLocation(program,"projection"), size: gl.getUniformLocation(program,"size"), opacity: gl.getUniformLocation(program,"opacity") };
  }

  render(gl: WebGL2RenderingContext, {defaultProjectionData}: CustomRenderMethodInput) {
    if (!this.program || !this.uniforms || !this.map) return;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.projection, false, defaultProjectionData.mainMatrix);
    const dpr = gl.drawingBufferWidth / Math.max(1, this.map.getCanvas().clientWidth);
    const diameter = Math.min(9, Math.max(1.5, 2 ** ((this.map.getZoom() - 10) / 2)));
    gl.uniform1f(this.uniforms.size, diameter * dpr);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const [km, opacity] of this.weights) {
      const data = this.records.get(km);
      if (!data) continue;
      let gpu = this.buffers.get(km);
      if (!gpu) {
        gpu = {buffer: gl.createBuffer()!, vao: gl.createVertexArray()!};
        gl.bindVertexArray(gpu.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0);
        gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, true, 12, 8);
        this.buffers.set(km, gpu);
      }
      gl.bindVertexArray(gpu.vao);
      gl.uniform1f(this.uniforms.opacity, opacity);
      gl.drawArrays(gl.POINTS, 0, data.byteLength / 12);
    }
    gl.bindVertexArray(null);
  }

  onRemove(_map: LibreMap, gl: WebGL2RenderingContext) {
    for (const {buffer, vao} of this.buffers.values()) {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(buffer);
    }
    this.buffers.clear();
    if (this.program) gl.deleteProgram(this.program);
    this.program = undefined;
  }
}
