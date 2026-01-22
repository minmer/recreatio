# Cogita Color System (Draft)

This guide defines how to apply Cogita colors across the application, with a predictable pattern for depth, emphasis, and motion. The palette is derived from the Cogita logo (deep navy + ice + signal red) and extended into a multi-layer system.

## 1) Core Palette

- Deep Navy: `#050F1C` (base background)
- Night Blue: `#06162A` (primary panel / hero base)
- Ocean Blue: `#0C2D49` (radial background core)
- Slate Blue: `#123B5C` (secondary panels)
- Ice: `#E6F1FF` (primary text on dark)
- Mist: `#BBD3EA` (muted text)
- Glow Cyan: `#7EC8FF` (primary highlight + network glow)
- Signal Red: `#EE4D3C` (logo bubbles / alerts / key moments)

## 2) Role-Based Usage

- Base surfaces: Deep Navy + Night Blue
- Primary text on dark: Ice
- Secondary text on dark: Mist
- Accent / focus: Glow Cyan (never used as full background)
- Critical / logo highlight: Signal Red (small, controlled areas)

## 3) Pattern Rules

1) Backgrounds are always multi-layered:
   - Layer 1: Deep Navy gradient (`#050F1C` → `#06162A`)
   - Layer 2: Radial light (`#0C2D49`) for depth
   - Layer 3: Soft glow (`#7EC8FF` at 15–25% opacity)

2) Overlays are translucent:
   - Panels: `rgba(10, 26, 46, 0.5)` + border `rgba(140, 190, 235, 0.3)`
   - Haze: `rgba(120, 200, 255, 0.2)`

3) Signal Red is limited to “meaning moments”:
   - Logo bubbles
   - CTA hover state (small strokes)
   - Warnings / critical points

4) CTA hierarchy:
   - Primary CTA: Glow Cyan fill, Ice text
   - Secondary CTA: Transparent, Mist text, Glow Cyan border
   - Danger CTA: Signal Red outline only

## 4) Slide Theme Matrix (Presentation)

Use one theme per slide. Only the radial core and glow shift, while the base remains Deep Navy.

Slide 1 (Identity / Logo)
- bg0 `#06162A`
- bg1 `#0C2D49`
- glow `rgba(120, 200, 255, 0.85)`
- accent Signal Red bubbles

Slide 2 (Library)
- bg0 `#071A2A`
- bg1 `#0B3B56`
- glow `rgba(129, 220, 255, 0.9)`
- accents: Glow Cyan strokes on cards

Slide 3 (Live)
- bg0 `#0A1D33`
- bg1 `#0F334F`
- glow `rgba(110, 195, 255, 0.88)`
- accents: rotating orbit nodes

Slide 4 (Results)
- bg0 `#08192F`
- bg1 `#123B5C`
- glow `rgba(140, 210, 255, 0.9)`
- accents: pulsing nodes

Slide 5 (Security)
- bg0 `#071424`
- bg1 `#0F2A4A`
- glow `rgba(120, 200, 255, 0.85)`
- accents: soft shield rings

Slide 6 (Login / CTA)
- bg0 `#071A2A`
- bg1 `#0A2742`
- glow `rgba(160, 220, 255, 0.85)`
- accent: CTA focus glow

## 5) Accessibility Notes

- Minimum text contrast on dark: use Ice `#E6F1FF` for body, Mist `#BBD3EA` for secondary.
- Do not place Signal Red text on Glow Cyan backgrounds.
- Maintain 16px minimum body size on dark surfaces.

## 6) Implementation Notes

- Use CSS variables per slide for smooth transitions:
  - `--cogita-bg0`, `--cogita-bg1`, `--cogita-glow`, `--cogita-line`, `--cogita-dot`
- Transitions should be >= 700ms for background shifts.
- Keep overlays semi-transparent to preserve depth and the network canvas visibility.
