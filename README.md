# BrightStack Portfolio

Static site, no build step. Every page is a self-contained `.html` file with its
own inline `<style>` block — open any one of them directly and it works.

## Theme — "Aqua Blue × Peach Puff"

The whole site sits on a two-pole colour axis: **aqua** (`#5FD9E8`) for the
primary/cool side, **peach puff** (`#FFDAB9`) for the warm accent.

Homepage tokens live in the `:root` block at the top of `index.html`:

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | `#04161B` | page background |
| `--paper-2` | `#0A242C` | raised panels, tier cards |
| `--signal` | `#5FD9E8` | primary CTAs, links, eyebrows |
| `--indigo` / `--peach-200` | `#FFD3B0` / `#FFDAB9` | warm accent, tags |
| `--glass` / `--glass-line` | translucent | the tilting project cards |

### Re-theming the other 36 pages

Each project page keeps its own identity (the bakery is warm, the coffee
assistant is roasted browns) — they just all now sit on the same aqua/peach
axis. That migration was done by `tools/retheme.py`, which maps every colour's
**hue** onto the two poles while preserving its **lightness** exactly, so no
contrast ratio changes.

```bash
python3 tools/retheme.py --plan    # preview the old -> new mapping table
python3 tools/retheme.py --apply   # rewrite files in place
```

Semantic colours (error reds, success greens, warning ambers, the Fiverr green)
are deliberately left alone — recolouring a validation error to peach would
destroy the signal it exists to send.

> The script is idempotent-ish but not reversible. It has already been applied.
> Only re-run it if you add a new page in an old palette.

## The 3D / motion layer

Three libraries, all loaded from CDN at the bottom of `index.html`, all
**optional** — if any fail to load the page still works exactly as it does now.
Everything is also disabled for `prefers-reduced-motion` and on touch devices.

| Library | Version | Does what |
| --- | --- | --- |
| [Spline](https://spline.design) viewer | 2.0.66 | the 3D hero scene |
| [Vanilla-Tilt](https://micku7zu.github.io/vanilla-tilt.js/) | 1.8.1 | tilt + glare on project cards |
| [GSAP](https://gsap.com) + ScrollTrigger | 3.15.0 | scroll parallax and reveals |

### Swapping in your own Spline scene

Find this near the bottom of `index.html`:

```js
const SCENE_URL = 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode';
```

It currently points at **Spline's public demo scene** — replace it with yours:

1. Build a scene at [spline.design](https://spline.design)
2. **Export ▸ "Spline Viewer"** ▸ copy the `.splinecode` URL
3. Paste it over the value above

Set `SCENE_URL = null` to switch Spline off entirely. The hand-built CSS 3D
stack underneath it stays as the fallback either way — it's what renders on
phones, on slow connections, and any time the scene fails to load, so the hero
is never empty.

Spline is only loaded when **all** of these are true: a scene URL is set, the
pointer is fine (not touch), the viewport is ≥1024px, Data Saver is off, and the
device reports ≥4GB RAM. A Spline scene is a multi-megabyte WebGL download —
it should never land on someone's phone over mobile data.

## Contact routing

Project enquiries go to **email first** (`19hsnkhan@gmail.com`), with Fiverr as
the alternative for people who want the platform's escrow. The homepage form
writes to Firestore (`leads` collection) via `firebase-config.js`.

The complaints workflow still exists, but it lives where it belongs — inside the
signed-in client area, not on the public landing page.

## Local preview

```bash
python3 -m http.server 8000
```
