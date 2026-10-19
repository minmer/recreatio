/**
 * LABOR 2D (v2) — DER ZEICHNER (WebGL2): nimmt jeden WebGL2-Kontext — den
 * einer OffscreenCanvas im Arbeiter oder den einer Leinwand auf der Seite —
 * und kennt keine Engine, nur Puffer (frame.ts).
 *
 * Reihenfolge: Grund der Kiste; die Flüssigkeit als glatte Fläche (die
 * Bedeckung aus den Teilchen, linear gelesen und bei ½ geschnitten — eine
 * Isolinie wie Marching Squares, aber im Shader); Blasen als Kreise in wahrer
 * Grösse; darüber die Zelltextur (Feststoffe deckend, Nebel und Einblendungen
 * halb durchsichtig); zuletzt die Wände der Kiste (offene Seiten bleiben
 * offen).
 */

import type { FrameBuffers } from './frame';
import { viridis } from './palette';
import type { View } from './view';

const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 corner;
uniform vec4 view;
uniform vec2 box;
out vec2 uv;
void main() {
  vec2 p = corner * box;
  uv = corner;
  gl_Position = vec4((p - view.xy) / (view.zw - view.xy) * 2.0 - 1.0, 0.0, 1.0);
}`;

const CELLS_FS = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D tex;
out vec4 color;
void main() {
  vec4 c = texture(tex, uv);
  color = vec4(c.rgb * c.a, c.a);
}`;

const LIQUID_FS = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D tex;
uniform sampler2D lut;
uniform vec3 water;
uniform float tint;
uniform vec2 texel;
out vec4 color;
void main() {
  vec4 c = texture(tex, uv);
  float cover = c.r;
  float a = smoothstep(0.42, 0.58, cover);
  if (a <= 0.0) discard;
  vec3 rgb = mix(water, texture(lut, vec2(c.g, 0.5)).rgb, tint);
  /* Die Oberfläche als feine dunklere Linie: dort, wo die Bedeckung ½ kreuzt. */
  float edge = 1.0 - smoothstep(0.0, 0.12, abs(cover - 0.5));
  rgb *= 1.0 - 0.25 * edge;
  float alpha = 0.82 * a;
  color = vec4(rgb * alpha, alpha);
}`;

const DISC_VS = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 inst;
uniform vec4 view;
out vec2 local;
out float air;
void main() {
  vec2 p = inst.xy + corner * max(inst.z, 0.00012);
  local = corner;
  air = inst.w;
  gl_Position = vec4((p - view.xy) / (view.zw - view.xy) * 2.0 - 1.0, 0.0, 1.0);
}`;

const DISC_FS = `#version 300 es
precision mediump float;
in vec2 local;
in float air;
out vec4 color;
void main() {
  float d = length(local);
  if (d > 1.0) discard;
  float ring = smoothstep(0.72, 0.95, d);
  vec3 inside = mix(vec3(0.93, 0.97, 1.0), vec3(0.95, 0.95, 0.9), air);
  vec3 rgb = mix(inside, vec3(0.16, 0.36, 0.62), ring);
  float alpha = mix(0.55, 0.95, ring) * (1.0 - smoothstep(0.95, 1.0, d));
  color = vec4(rgb * alpha, alpha);
}`;

const RECT_VS = `#version 300 es
layout(location = 0) in vec2 corner;
layout(location = 1) in vec4 rect;
uniform vec4 view;
void main() {
  vec2 p = mix(rect.xy, rect.zw, corner);
  gl_Position = vec4((p - view.xy) / (view.zw - view.xy) * 2.0 - 1.0, 0.0, 1.0);
}`;

const RECT_FS = `#version 300 es
precision mediump float;
uniform vec4 fill;
out vec4 color;
void main() { color = vec4(fill.rgb * fill.a, fill.a); }`;

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (p === null) throw new Error('program');
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const sh = gl.createShader(type);
    if (sh === null) throw new Error('shader');
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader');
    gl.attachShader(p, sh);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
  return p;
}

export interface Walls { readonly left: boolean; readonly right: boolean; readonly bottom: boolean; readonly top: boolean }

export class LabRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly cellsProg: WebGLProgram;
  private readonly liquidProg: WebGLProgram;
  private readonly discProg: WebGLProgram;
  private readonly rectProg: WebGLProgram;
  private readonly quadVao: WebGLVertexArrayObject;
  private readonly discVao: WebGLVertexArrayObject;
  private readonly rectVao: WebGLVertexArrayObject;
  private readonly instBuf: WebGLBuffer;
  private readonly rectBuf: WebGLBuffer;
  private readonly cellTex: WebGLTexture;
  private readonly liquidTex: WebGLTexture;
  private readonly lutTex: WebGLTexture;
  private texW = 0;
  private texH = 0;
  /** Grund (RGB 0–1) innen und aussen — das helle Schema; das dunkle setzt die Oberfläche. */
  ground: readonly [number, number, number] = [0.93, 0.95, 0.97];
  outside: readonly [number, number, number] = [0.86, 0.88, 0.9];
  water: readonly [number, number, number] = [0.24, 0.56, 0.85];
  wall: readonly [number, number, number] = [0.42, 0.46, 0.5];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.cellsProg = compile(gl, QUAD_VS, CELLS_FS);
    this.liquidProg = compile(gl, QUAD_VS, LIQUID_FS);
    this.discProg = compile(gl, DISC_VS, DISC_FS);
    this.rectProg = compile(gl, RECT_VS, RECT_FS);
    const unit = gl.createBuffer();
    const inst = gl.createBuffer();
    const rect = gl.createBuffer();
    const q = gl.createVertexArray();
    const d = gl.createVertexArray();
    const r = gl.createVertexArray();
    const ct = gl.createTexture();
    const lt = gl.createTexture();
    const lut = gl.createTexture();
    if (unit === null || inst === null || rect === null || q === null || d === null || r === null || ct === null || lt === null || lut === null) throw new Error('webgl');
    this.instBuf = inst;
    this.rectBuf = rect;
    this.quadVao = q;
    this.discVao = d;
    this.rectVao = r;
    this.cellTex = ct;
    this.liquidTex = lt;
    this.lutTex = lut;
    gl.bindBuffer(gl.ARRAY_BUFFER, unit);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindVertexArray(q);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    /* Kreise: Ecken −1…1. */
    const disc = gl.createBuffer();
    if (disc === null) throw new Error('webgl');
    gl.bindBuffer(gl.ARRAY_BUFFER, disc);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindVertexArray(d);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(r);
    gl.bindBuffer(gl.ARRAY_BUFFER, unit);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, rect);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
    /* Die Farbskala als Textur (256 × 1). */
    const lutData = new Uint8Array(256 * 4);
    for (let k = 0; k < 256; k += 1) { viridis(k / 255, lutData, 4 * k); lutData[4 * k + 3] = 255; }
    gl.bindTexture(gl.TEXTURE_2D, lut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData);
    this.params(gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  private params(filter: number): void {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private upload(f: FrameBuffers): void {
    const gl = this.gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (this.texW !== f.nx || this.texH !== f.ny) {
      this.texW = f.nx;
      this.texH = f.ny;
      gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.nx, f.ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.cells);
      this.params(gl.NEAREST);
      gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.lx, f.ly, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.liquid);
      this.params(gl.LINEAR);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.nx, f.ny, gl.RGBA, gl.UNSIGNED_BYTE, f.cells);
      gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.lx, f.ly, gl.RGBA, gl.UNSIGNED_BYTE, f.liquid);
    }
  }

  private readonly rects = new Float32Array(16);

  /** Zeichnen: ein Bild in der Ansicht `view` auf eine Leinwand von w × h Gerätepixeln. */
  draw(f: FrameBuffers, view: View, w: number, h: number, walls: Walls, wallThickness: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, w, h);
    gl.clearColor(this.outside[0], this.outside[1], this.outside[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (f.nx === 0) return;
    this.upload(f);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    /* Grund der Kiste. */
    this.rect(0, 0, f.boxW, f.boxH, this.ground, 1, view);
    /* Flüssigkeit. */
    gl.useProgram(this.liquidProg);
    gl.uniform4f(gl.getUniformLocation(this.liquidProg, 'view'), view.x0, view.y0, view.x1, view.y1);
    gl.uniform2f(gl.getUniformLocation(this.liquidProg, 'box'), f.boxW, f.boxH);
    gl.uniform3f(gl.getUniformLocation(this.liquidProg, 'water'), this.water[0], this.water[1], this.water[2]);
    gl.uniform1f(gl.getUniformLocation(this.liquidProg, 'tint'), f.tintLiquid ? 1 : 0);
    gl.uniform2f(gl.getUniformLocation(this.liquidProg, 'texel'), 1 / f.lx, 1 / f.ly);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
    gl.uniform1i(gl.getUniformLocation(this.liquidProg, 'tex'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.uniform1i(gl.getUniformLocation(this.liquidProg, 'lut'), 1);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.activeTexture(gl.TEXTURE0);
    /* Blasen. */
    if (f.nb > 0) {
      gl.useProgram(this.discProg);
      gl.uniform4f(gl.getUniformLocation(this.discProg, 'view'), view.x0, view.y0, view.x1, view.y1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, f.bubbles, gl.STREAM_DRAW, 0, 4 * f.nb);
      gl.bindVertexArray(this.discVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, f.nb);
    }
    /* Zellen: Feststoffe, Nebel, Einblendung. */
    gl.useProgram(this.cellsProg);
    gl.uniform4f(gl.getUniformLocation(this.cellsProg, 'view'), view.x0, view.y0, view.x1, view.y1);
    gl.uniform2f(gl.getUniformLocation(this.cellsProg, 'box'), f.boxW, f.boxH);
    gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
    gl.uniform1i(gl.getUniformLocation(this.cellsProg, 'tex'), 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    /* Wände der Kiste. */
    const t = wallThickness;
    if (walls.left) this.rect(-t, -t, 0, f.boxH + (walls.top ? t : 0), this.wall, 1, view);
    if (walls.right) this.rect(f.boxW, -t, f.boxW + t, f.boxH + (walls.top ? t : 0), this.wall, 1, view);
    if (walls.bottom) this.rect(-t, -t, f.boxW + t, 0, this.wall, 1, view);
    if (walls.top) this.rect(-t, f.boxH, f.boxW + t, f.boxH + t, this.wall, 1, view);
    gl.bindVertexArray(null);
  }

  private rect(x0: number, y0: number, x1: number, y1: number, rgb: readonly [number, number, number], a: number, view: View): void {
    const gl = this.gl;
    gl.useProgram(this.rectProg);
    gl.uniform4f(gl.getUniformLocation(this.rectProg, 'view'), view.x0, view.y0, view.x1, view.y1);
    gl.uniform4f(gl.getUniformLocation(this.rectProg, 'fill'), rgb[0], rgb[1], rgb[2], a);
    this.rects[0] = x0; this.rects[1] = y0; this.rects[2] = x1; this.rects[3] = y1;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.rects, gl.STREAM_DRAW, 0, 4);
    gl.bindVertexArray(this.rectVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
  }
}
