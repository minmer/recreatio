/**
 * LABOR 2D (v2) — DER ZEICHNER (WebGL2): nimmt jeden WebGL2-Kontext — den
 * einer OffscreenCanvas im Arbeiter oder den einer Leinwand auf der Seite —
 * und kennt keine Engine, nur Puffer (frame.ts).
 *
 * Reihenfolge: Grund der Kiste; die Flüssigkeit als glatte Fläche (die
 * Bedeckung aus den Teilchen, linear gelesen und bei ½ geschnitten — eine
 * Isolinie wie Marching Squares, aber im Shader); Blasen als Kreise in wahrer
 * Grösse; darüber die Feldtextur (Nebel und stetige Einblendungen, weich),
 * die Zelltextur (Feststoffe deckend, scharf); zuletzt die Wände der Kiste
 * (offene Seiten bleiben offen).
 */

import { LIQUIDS } from '../engine/materials';
import type { FrameBuffers } from './frame';
import { hex, viridis } from './palette';
import type { View } from './view';

/** Farbe der zweiten Flüssigkeit (Öl) aus materials.json, 0–1. */
const OIL = (LIQUIDS[1] ? hex(LIQUIDS[1].color) : [227, 180, 55]).map((v) => v / 255);

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

/* Feldtextur: schon vormultipliziert (linear gelesen, ohne dunkle Säume). */
const FIELD_FS = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D tex;
out vec4 color;
void main() { color = texture(tex, uv); }`;

const LIQUID_FS = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D tex;
uniform sampler2D lut;
uniform vec3 water;
/* Die zweite Flüssigkeit (Öl): ihr Anteil steht in Kanal B. */
uniform vec3 oil;
uniform float tint;
uniform vec2 texel;
out vec4 color;
void main() {
  vec4 c = texture(tex, uv);
  float cover = c.r;
  float a = smoothstep(0.42, 0.58, cover);
  if (a <= 0.0) discard;
  vec3 rgb = mix(mix(water, oil, c.b), texture(lut, vec2(c.g, 0.5)).rgb, tint);
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

/* Rohe Teilchen: Punkte, gefärbt nach ihrer Temperatur (Farbskala als Textur). */
const POINT_VS = `#version 300 es
layout(location = 0) in vec3 p;
uniform vec4 view;
uniform float size;
out float tt;
void main() {
  gl_Position = vec4((p.xy - view.xy) / (view.zw - view.xy) * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = size;
  tt = p.z;
}`;

const POINT_FS = `#version 300 es
precision mediump float;
in float tt;
uniform sampler2D lut;
out vec4 color;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  if (dot(d, d) > 1.0) discard;
  vec3 rgb = texture(lut, vec2(tt, 0.5)).rgb;
  color = vec4(rgb * 0.95, 0.95);
}`;

/* Pfeile: Strecken in einer Farbe. */
const LINE_VS = `#version 300 es
layout(location = 0) in vec2 p;
uniform vec4 view;
void main() { gl_Position = vec4((p - view.xy) / (view.zw - view.xy) * 2.0 - 1.0, 0.0, 1.0); }`;

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
  private readonly fieldProg: WebGLProgram;
  private readonly liquidProg: WebGLProgram;
  private readonly discProg: WebGLProgram;
  private readonly rectProg: WebGLProgram;
  private readonly pointProg: WebGLProgram;
  private readonly lineProg: WebGLProgram;
  private readonly pointVao: WebGLVertexArrayObject;
  private readonly lineVao: WebGLVertexArrayObject;
  private readonly pointBuf: WebGLBuffer;
  private readonly lineBuf: WebGLBuffer;
  private readonly quadVao: WebGLVertexArrayObject;
  private readonly discVao: WebGLVertexArrayObject;
  private readonly rectVao: WebGLVertexArrayObject;
  private readonly instBuf: WebGLBuffer;
  private readonly rectBuf: WebGLBuffer;
  private readonly cellTex: WebGLTexture;
  private readonly fieldTex: WebGLTexture;
  private readonly liquidTex: WebGLTexture;
  private readonly lutTex: WebGLTexture;
  private texW = 0;
  private texH = 0;
  /** Grund (RGB 0–1) innen und aussen — das helle Schema; das dunkle setzt die Oberfläche. */
  ground: readonly [number, number, number] = [0.93, 0.95, 0.97];
  outside: readonly [number, number, number] = [0.86, 0.88, 0.9];
  water: readonly [number, number, number] = [0.24, 0.56, 0.85];
  wall: readonly [number, number, number] = [0.42, 0.46, 0.5];
  /** Farbe der Pfeile des Gases (hell: dunkel, dunkel: hell) und des Wassers. */
  ink: readonly [number, number, number] = [0.08, 0.1, 0.12];
  waterInk: readonly [number, number, number] = [1, 1, 1];

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.cellsProg = compile(gl, QUAD_VS, CELLS_FS);
    this.fieldProg = compile(gl, QUAD_VS, FIELD_FS);
    this.liquidProg = compile(gl, QUAD_VS, LIQUID_FS);
    this.discProg = compile(gl, DISC_VS, DISC_FS);
    this.rectProg = compile(gl, RECT_VS, RECT_FS);
    this.pointProg = compile(gl, POINT_VS, POINT_FS);
    this.lineProg = compile(gl, LINE_VS, RECT_FS);
    const pb = gl.createBuffer();
    const lb = gl.createBuffer();
    const pv = gl.createVertexArray();
    const lv = gl.createVertexArray();
    if (pb === null || lb === null || pv === null || lv === null) throw new Error('webgl');
    this.pointBuf = pb;
    this.lineBuf = lb;
    this.pointVao = pv;
    this.lineVao = lv;
    gl.bindVertexArray(pv);
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(lv);
    gl.bindBuffer(gl.ARRAY_BUFFER, lb);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    const unit = gl.createBuffer();
    const inst = gl.createBuffer();
    const rect = gl.createBuffer();
    const q = gl.createVertexArray();
    const d = gl.createVertexArray();
    const r = gl.createVertexArray();
    const ct = gl.createTexture();
    const ft = gl.createTexture();
    const lt = gl.createTexture();
    const lut = gl.createTexture();
    if (unit === null || inst === null || rect === null || q === null || d === null || r === null || ct === null || ft === null || lt === null || lut === null) throw new Error('webgl');
    this.instBuf = inst;
    this.rectBuf = rect;
    this.quadVao = q;
    this.discVao = d;
    this.rectVao = r;
    this.cellTex = ct;
    this.fieldTex = ft;
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
      gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.nx, f.ny, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.field);
      this.params(gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_2D, this.liquidTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.lx, f.ly, 0, gl.RGBA, gl.UNSIGNED_BYTE, f.liquid);
      this.params(gl.LINEAR);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.nx, f.ny, gl.RGBA, gl.UNSIGNED_BYTE, f.cells);
      gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, f.nx, f.ny, gl.RGBA, gl.UNSIGNED_BYTE, f.field);
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
    /* Flüssigkeit: die glatte Fläche — oder, im rohen Blick, die Teilchen selbst. */
    if (f.np > 0) this.points(f, view, w);
    else this.surface(f, view);
    /* Blasen. */
    if (f.nb > 0) {
      gl.useProgram(this.discProg);
      gl.uniform4f(gl.getUniformLocation(this.discProg, 'view'), view.x0, view.y0, view.x1, view.y1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, f.bubbles, gl.STREAM_DRAW, 0, 4 * f.nb);
      gl.bindVertexArray(this.discVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, f.nb);
    }
    this.layers(f, view, walls, wallThickness);
  }

  /** Die Flüssigkeit als glatte Fläche aus der Bedeckung. */
  private surface(f: FrameBuffers, view: View): void {
    const gl = this.gl;
    gl.useProgram(this.liquidProg);
    gl.uniform4f(gl.getUniformLocation(this.liquidProg, 'view'), view.x0, view.y0, view.x1, view.y1);
    gl.uniform2f(gl.getUniformLocation(this.liquidProg, 'box'), f.boxW, f.boxH);
    gl.uniform3f(gl.getUniformLocation(this.liquidProg, 'water'), this.water[0], this.water[1], this.water[2]);
    gl.uniform3f(gl.getUniformLocation(this.liquidProg, 'oil'), OIL[0], OIL[1], OIL[2]);
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
  }

  /** Die rohen Teilchen als Punkte (Durchmesser etwa eine halbe Zelle), nach Temperatur gefärbt. */
  private points(f: FrameBuffers, view: View, w: number): void {
    const gl = this.gl;
    gl.useProgram(this.pointProg);
    gl.uniform4f(gl.getUniformLocation(this.pointProg, 'view'), view.x0, view.y0, view.x1, view.y1);
    const px = (0.5 * (f.boxW / Math.max(1, f.nx)) * w) / (view.x1 - view.x0);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, 'size'), Math.max(1.5, px));
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.uniform1i(gl.getUniformLocation(this.pointProg, 'lut'), 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, f.parts, gl.STREAM_DRAW, 0, 3 * f.np);
    gl.bindVertexArray(this.pointVao);
    gl.drawArrays(gl.POINTS, 0, f.np);
    gl.activeTexture(gl.TEXTURE0);
  }

  /** Feld, Zellen, Pfeile, Wände der Kiste. */
  private layers(f: FrameBuffers, view: View, walls: Walls, wallThickness: number): void {
    const gl = this.gl;
    /* Feld: Nebel und stetige Einblendungen (weich). */
    gl.useProgram(this.fieldProg);
    gl.uniform4f(gl.getUniformLocation(this.fieldProg, 'view'), view.x0, view.y0, view.x1, view.y1);
    gl.uniform2f(gl.getUniformLocation(this.fieldProg, 'box'), f.boxW, f.boxH);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
    gl.uniform1i(gl.getUniformLocation(this.fieldProg, 'tex'), 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    /* Zellen: Feststoffe und die Mapa stanów (scharf). */
    gl.useProgram(this.cellsProg);
    gl.uniform4f(gl.getUniformLocation(this.cellsProg, 'view'), view.x0, view.y0, view.x1, view.y1);
    gl.uniform2f(gl.getUniformLocation(this.cellsProg, 'box'), f.boxW, f.boxH);
    gl.bindTexture(gl.TEXTURE_2D, this.cellTex);
    gl.uniform1i(gl.getUniformLocation(this.cellsProg, 'tex'), 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    /* Pfeile der Geschwindigkeit: Gas, dann Wasser. */
    if (f.nag + f.nal > 0) {
      gl.useProgram(this.lineProg);
      gl.uniform4f(gl.getUniformLocation(this.lineProg, 'view'), view.x0, view.y0, view.x1, view.y1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, f.arrows, gl.STREAM_DRAW, 0, 4 * (f.nag + f.nal));
      gl.bindVertexArray(this.lineVao);
      const fill = gl.getUniformLocation(this.lineProg, 'fill');
      if (f.nag > 0) { gl.uniform4f(fill, this.ink[0], this.ink[1], this.ink[2], 0.85); gl.drawArrays(gl.LINES, 0, 2 * f.nag); }
      if (f.nal > 0) { gl.uniform4f(fill, this.waterInk[0], this.waterInk[1], this.waterInk[2], 0.9); gl.drawArrays(gl.LINES, 2 * f.nag, 2 * f.nal); }
    }
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
