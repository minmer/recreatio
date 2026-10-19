/**
 * PARTIKEL-LABOR — DER ZEICHNER (WebGL2): je Partikel ein instanziertes
 * Viereck, der Fragment-Shader macht daraus eine weiche Scheibe. Er nimmt
 * jeden WebGL2-Kontext — den einer OffscreenCanvas im Arbeiter oder den einer
 * Leinwand auf der Seite — und kennt keine Engine, nur Puffer.
 */

import type { View } from '../engine/protocol';

const VS = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec2 center;
layout(location = 2) in float radius;
layout(location = 3) in vec4 color;
uniform vec4 view;
out vec2 uv;
out vec4 tint;
void main() {
  vec2 p = center + corner * radius;
  vec2 ndc = (p - view.xy) / (view.zw - view.xy) * 2.0 - 1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
  uv = corner;
  tint = color;
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 uv;
in vec4 tint;
out vec4 outColor;
void main() {
  float d = dot(uv, uv);
  if (d > 1.0) discard;
  float a = tint.a * (1.0 - smoothstep(0.7, 1.0, d));
  outColor = vec4(tint.rgb * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (sh === null) throw new Error('shader');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
  return sh;
}

export class ParticleRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly posBuf: WebGLBuffer;
  private readonly sizeBuf: WebGLBuffer;
  private readonly colBuf: WebGLBuffer;
  private readonly uView: WebGLUniformLocation | null;
  /** Hintergrund (RGB 0–1): hell, oder dunkel im dunklen Schema. */
  background: readonly [number, number, number] = [0.955, 0.965, 0.975];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const p = gl.createProgram();
    if (p === null) throw new Error('program');
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    this.program = p;
    this.uView = gl.getUniformLocation(p, 'view');
    const vao = gl.createVertexArray();
    const corner = gl.createBuffer();
    const pos = gl.createBuffer();
    const size = gl.createBuffer();
    const col = gl.createBuffer();
    if (vao === null || corner === null || pos === null || size === null || col === null) throw new Error('buffers');
    this.vao = vao;
    this.posBuf = pos;
    this.sizeBuf = size;
    this.colBuf = col;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, size);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, col);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
  }

  /** Zeichnen: `n` Partikeln aus den Puffern, in der Ansicht `view`, auf eine Leinwand der Grösse w × h (Gerätepixel). */
  draw(n: number, pos: Float32Array, size: Float32Array, col: Uint8Array, view: View, w: number, h: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    const [r, g, b] = this.background;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (n <= 0) return;
    gl.useProgram(this.program);
    gl.uniform4f(this.uView, view.x0, view.y0, view.x1, view.y1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STREAM_DRAW, 0, 2 * n);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, size, gl.STREAM_DRAW, 0, n);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, col, gl.STREAM_DRAW, 0, 4 * n);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);
  }
}
