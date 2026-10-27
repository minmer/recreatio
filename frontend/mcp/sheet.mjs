/**
 * 2026-10-27 — BILDER ZUSAMMENSTELLEN UND NACHMESSEN, in einem leeren Tab des
 * Browsers (Leinwand, keine Abhängigkeit in Node).
 *
 * <code>
 *   compose    viele Aufnahmen auf einem Blatt, je mit Beschriftung — eine lange Seite
 *              in Spalten geschnitten, Slajdy und Szenen als Raster, ein Wechsel als Filmstreifen
 *   contrast   der Kontrast eines Textes gegen das, was auf dem Bild wirklich darunter liegt
 * </code>
 *
 * Ein Blatt ist höchstens `max` px gross (Breite und Höhe): so liest ein Modell
 * es ohne Verkleinerung, die den Text unleserlich machte.
 */

/** Was im Tab läuft — als Text hinübergegeben, damit nichts gebündelt werden muss. */
const STUDIO = String.raw`
window.studio = {
  async load(src) {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  },

  async compose(spec) {
    const gap = spec.gap ?? 14;
    const label = spec.label ?? 15;
    const pad = 12;
    /* Dieselbe Aufnahme (eine lange Seite in Spalten) wird nur einmal geladen. */
    const images = await Promise.all(spec.sources.map((src) => this.load(src)));
    const cells = spec.tiles.map((t) => {
      const img = images[t.source];
      const crop = t.crop ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
      const scale = t.scale ?? 1;
      return { t, img, crop, w: Math.round(crop.w * scale), h: Math.round(crop.h * scale) };
    });
    const columns = Math.max(1, spec.columns ?? cells.length);
    const rows = [];
    for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));
    const head = spec.title ? 30 : 0;
    const lineH = (t) => (t.label ? label + 8 : 0) + (t.sub ? label : 0);
    const width = pad * 2 + Math.max(...rows.map((row) => row.reduce((s, c) => s + c.w, 0) + gap * (row.length - 1)));
    const heights = rows.map((row) => Math.max(...row.map((c) => c.h + lineH(c.t))));
    const height = pad * 2 + head + heights.reduce((s, h) => s + h, 0) + gap * (rows.length - 1);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d');
    g.fillStyle = spec.background ?? '#eceff1';
    g.fillRect(0, 0, width, height);
    g.textBaseline = 'top';
    if (spec.title) {
      g.fillStyle = '#263238';
      g.font = '600 18px system-ui, Segoe UI, sans-serif';
      g.fillText(spec.title, pad, pad);
    }
    let y = pad + head;
    rows.forEach((row, r) => {
      let x = pad;
      for (const c of row) {
        let ty = y;
        if (c.t.label) {
          g.fillStyle = '#263238';
          g.font = '600 ' + label + 'px system-ui, Segoe UI, sans-serif';
          g.fillText(c.t.label, x, ty, c.w);
          ty += label + 4;
        }
        if (c.t.sub) {
          g.fillStyle = '#546e7a';
          g.font = (label - 2) + 'px system-ui, Segoe UI, sans-serif';
          g.fillText(c.t.sub, x, ty, c.w);
          ty += label;
        }
        if (c.t.label) ty += 4;
        g.drawImage(c.img, c.crop.x, c.crop.y, c.crop.w, c.crop.h, x, ty, c.w, c.h);
        g.strokeStyle = c.t.frame ?? '#90a4ae';
        g.lineWidth = 1;
        g.strokeRect(x - 0.5, ty - 0.5, c.w + 1, c.h + 1);
        /* M1, M2 … über den Bausteinen: Bild und Bericht tragen dieselben Namen. */
        if (c.t.marks && c.t.marks.length > 0) {
          const k = c.w / c.crop.w;
          g.save();
          g.beginPath();
          g.rect(x, ty, c.w, c.h);
          g.clip();
          for (const m of c.t.marks) {
            const mx = x + (m.x - c.crop.x) * k, my = ty + (m.y - c.crop.y) * k, mw = m.w * k, mh = m.h * k;
            if (my > ty + c.h || my + mh < ty) continue;
            g.globalAlpha = 0.85;
            g.setLineDash([5, 4]);
            g.strokeStyle = m.color ?? '#e0115f';
            g.lineWidth = 1.5;
            g.strokeRect(mx + 0.75, my + 0.75, Math.max(0, mw - 1.5), Math.max(0, mh - 1.5));
            g.setLineDash([]);
            g.font = '700 11px system-ui, Segoe UI, sans-serif';
            const tw = g.measureText(m.label).width + 6;
            const lx = Math.min(Math.max(x, mx), x + c.w - tw), ly = Math.min(Math.max(ty, my), ty + c.h - 14);
            g.fillStyle = m.color ?? '#e0115f';
            g.fillRect(lx, ly, tw, 14);
            g.globalAlpha = 1;
            g.fillStyle = '#fff';
            g.fillText(m.label, lx + 3, ly + 1.5);
          }
          g.restore();
        }
        x += c.w + gap;
      }
      y += heights[r] + gap;
    });
    const type = spec.format === 'png' ? 'image/png' : 'image/jpeg';
    const url = canvas.toDataURL(type, spec.quality ?? 0.84);
    return { data: url.slice(url.indexOf(',') + 1), width, height, mime: type };
  },

  async contrast(src, samples) {
    const img = await this.load(src);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const contrastOf = (la, lb) => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    return samples.map((s) => {
      const x = Math.max(0, Math.floor(s.rect.x)), y = Math.max(0, Math.floor(s.rect.y));
      const w = Math.min(canvas.width - x, Math.ceil(s.rect.w)), h = Math.min(canvas.height - y, Math.ceil(s.rect.h));
      if (w < 2 || h < 2) return null;
      const data = g.getImageData(x, y, w, h).data;
      const lt = lum(s.color[0], s.color[1], s.color[2]);
      /*
       * DER GRUND: die häufigste Farbe unter den Punkten, die nicht wie die Schrift
       * aussehen (Buchstaben und ihre geglätteten Kanten fallen heraus). Auf einem
       * Foto zählt zusätzlich die Mitte der übrigen — das Schlechtere gilt.
       */
      const bins = new Map();
      const others = [];
      let all = 0;
      const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 8000)));
      for (let py = 0; py < h; py += step) {
        for (let px = 0; px < w; px += step) {
          const i = (py * w + px) * 4;
          all += 1;
          const lp = lum(data[i], data[i + 1], data[i + 2]);
          const c = contrastOf(lt, lp);
          if (c < 1.3) continue;
          others.push(c);
          const key = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4);
          const bin = bins.get(key) ?? { n: 0, l: 0 };
          bin.n += 1;
          bin.l += lp;
          bins.set(key, bin);
        }
      }
      /* Fast nichts hebt sich von der Schrift ab: sie ist so gut wie unsichtbar. */
      if (others.length < all * 0.15) return 1;
      let best = null;
      for (const bin of bins.values()) if (best === null || bin.n > best.n) best = bin;
      others.sort((a, b) => a - b);
      const dominant = contrastOf(lt, best.l / best.n);
      const middle = others[Math.floor(others.length / 2)];
      return Math.round(Math.min(dominant, middle) * 100) / 100;
    });
  }
};
`;

export class Studio {
  constructor(page) {
    this.page = page;
  }

  static async open(browser) {
    const page = await browser.newPage({ width: 800, height: 600 });
    await page.evaluate(STUDIO);
    return new Studio(page);
  }

  /** Aufnahmen (PNG) als ein Blatt (JPEG): `tiles` = { png: Buffer, label, sub?, scale?, crop?, marks? }. */
  async compose({ tiles, columns, title, format = 'jpeg', quality = 0.84, gap, label }) {
    const buffers = [...new Set(tiles.map((t) => t.png))];
    const spec = {
      title, columns, format, quality, gap, label,
      sources: buffers.map((png) => `data:image/png;base64,${png.toString('base64')}`),
      tiles: tiles.map((t) => ({ source: buffers.indexOf(t.png), label: t.label, sub: t.sub, scale: t.scale, crop: t.crop, frame: t.frame, marks: t.marks }))
    };
    const done = await this.page.call(async (s) => window.studio.compose(s), spec);
    return { buffer: Buffer.from(done.data, 'base64'), width: done.width, height: done.height, mime: done.mime };
  }

  /** Der Kontrast der Texte (Rechtecke in Pixeln des Bildes) gegen das Bild darunter. */
  async contrast(png, samples) {
    if (samples.length === 0) return [];
    return this.page.call(async (src, list) => window.studio.contrast(src, list), `data:image/png;base64,${png.toString('base64')}`, samples);
  }
}

/**
 * EINE LANGE AUFNAHME IN SPALTEN: höchstens `column` px hoch je Spalte, so viele
 * Spalten, wie es braucht — und, wenn es mehr als `perSheet` werden, mehrere Blätter.
 */
export function slices(height, column) {
  const out = [];
  for (let y = 0; y < height; y += column) out.push({ y, h: Math.min(column, height - y) });
  return out;
}
