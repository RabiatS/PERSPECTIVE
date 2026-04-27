# Agent brief — Data badge export (Phase 3)

**Agent owners:** FORGE (implementation), FORM (modal/drawer + trigger UX)  
**PRD refs:** Phase 3 — Data Badge Export (PNG P0, SVG P1), Design System §8  
**Status:** Scoping only — no implementation gate until Phase 1 store + chart path is stable

---

## Goal

Build the **data badge export** flow: a **premium dark card** with a **mini 3D chart thumbnail**, **four key stats**, **dataset name**, **timestamp**, and **branding** — exportable as **PNG** (primary) and **SVG** (secondary, with an explicit technical policy below).

---

## Prerequisites (blockers — document in kickoff)

| Prerequisite | Notes |
|--------------|--------|
| Zustand fields | `uploadedData`, `lensOutput`, `datasetMeta`, `activeChartType` exist and match `useSceneStore` contract |
| LENS | `lensOutput` non-null after parse; `lensOutput.axisMapping` available (`x` / `y` / optional `z`) |
| Plotly stack | One integration pattern app-wide (e.g. `react-plotly.js`) — avoid divergent Plotly wrappers |
| Failure UX | If prerequisites fail: return `null` or show disabled export with one-line reason — **no throw** |

---

## Files (suggested split)

| File | Owner | Purpose |
|------|--------|---------|
| `src/components/ui/BadgeExport.jsx` | FORGE / FORM | Card UI, PNG/SVG actions |
| `src/utils/badgeMiniTrace.js` | FORGE | `buildMiniTrace(chartType, data, axisMapping)` |
| `src/utils/badgeStats.js` | FORGE | `computeStats(data, axisMapping)` — pure, testable |
| `src/utils/sanitizeFilename.js` | FORGE | Safe `download=` basename |

**Install (when building):** `npm install html2canvas`

---

## Integration (trigger)

- Add **EXPORT BADGE** to **`LensPanel`** (or agreed **FAB** bottom-left per FORM).
- Opens **modal or drawer** with `<BadgeExport />`; close on overlay / Escape; optional focus trap.

---

## Acceptance criteria (RIGOR-oriented)

- [ ] **Empty data / 1 row / no numeric columns:** card still renders; stats use **N/A** or agreed fallback; **no uncaught exceptions**
- [ ] **Missing Z axis:** mini trace behavior documented (e.g. `z = 0`); consistent across PNG/SVG policy
- [ ] **Large data:** thumbnail caps at **≤ 200 points**; never passes full dataset to mini Plotly
- [ ] **PNG:** `html2canvas` with **`scale: 2`**; **opaque** background matching PRD (`#0A0A0F` or token) unless product explicitly wants transparency
- [ ] **SVG:** Implements **chosen SVG policy** (below); tested **Chrome, Firefox, Safari**; UI may say “experimental” if Option B
- [ ] **Download filename:** `sanitizeFilename(datasetMeta.filename)` — no path segments, illegal chars stripped, max length (e.g. 80)
- [ ] **Timestamp:** **Date + time** — e.g. `toISOString()` or fixed-locale `toLocaleString()` — PRD says “timestamp,” not date-only
- [ ] **Branding:** e.g. **SPATIAL VIZ** (or final product string from FORM); bottom-right, subtle

---

## SVG export policy (pick one before coding — avoids false “done”)

Naive **`foreignObject` + `outerHTML`** often **fails** for Plotly **WebGL/canvas** (empty or partial thumbnail).

| Option | Description | When to use |
|--------|-------------|-------------|
| **A (recommended v1)** | SVG wraps layout; **mini chart = embedded raster** (data URL from small `canvas` snapshot of plot region only) | Reliable visual parity with PNG for the chart |
| **B** | Best-effort `foreignObject` serialization | RIGOR documents broken cases; UI: “SVG experimental” |
| **C** | SVG uses **non-Plotly** simplified preview | Only if FORM accepts visual mismatch |

**Deliverable:** State chosen option in PR / ticket so QA expectations match implementation.

---

## Design tokens (PRD §8)

- Background / gradient / border: `--color-bg-primary`, `--color-bg-surface`, `--color-accent-cyan`, `--color-text-primary`, `--color-text-secondary`, `--color-border-subtle`
- Typography: **IBM Plex Mono** for data; optional **Syne** for headers if FORM specifies
- Card: ~**400×220px**, grid texture overlay, neon border glow, floating panel aesthetic

---

## Reference: `sanitizeFilename`

```js
/** Safe basename for download= (no path traversal, no illegal Windows/mac chars). */
export function sanitizeFilename(name, fallback = 'dataset') {
  const base = String(name || '')
    .replace(/^[a-zA-Z]:\\|^\\\\|^\/+/g, '')
    .split(/[/\\]/)
    .pop()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return base || fallback;
}
```

---

## Reference: `computeStats` (edge-safe, exactly four stats)

```js
function numCol(data, col) {
  if (!col || !Array.isArray(data) || data.length === 0) return [];
  return data
    .map((r) => parseFloat(r[col]))
    .filter((v) => Number.isFinite(v));
}

function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return 'N/A';
  return n.toFixed(digits);
}

/** Exactly four stats; never throws. */
export function computeStats(data, axisMapping) {
  const safeAxis = axisMapping || {};
  const rows = Array.isArray(data) ? data.length : 0;
  const colCount =
    rows > 0 && data[0] && typeof data[0] === 'object'
      ? Object.keys(data[0]).length
      : 0;

  const stats = [
    { label: 'ROWS', value: rows.toLocaleString() },
    { label: 'COLUMNS', value: colCount.toLocaleString() },
  ];

  const x = safeAxis.x;
  const y = safeAxis.y;
  const xv = numCol(data, x);
  const yv = numCol(data, y);

  const xMean =
    xv.length > 0 ? xv.reduce((a, b) => a + b, 0) / xv.length : NaN;
  stats.push({
    label: x ? `${String(x).toUpperCase()} MEAN` : 'X MEAN',
    value: fmt(xMean),
  });

  const yMax = yv.length > 0 ? Math.max(...yv) : NaN;
  stats.push({
    label: y ? `${String(y).toUpperCase()} MAX` : 'Y MAX',
    value: fmt(yMax),
  });

  return stats.slice(0, 4);
}
```

---

## Reference: `buildMiniTrace`

```js
/** Max 200 points for badge thumbnail performance. */
export function buildMiniTrace(chartType, data, axisMapping) {
  const ax = axisMapping || {};
  const sample = Array.isArray(data) ? data.slice(0, 200) : [];
  const xk = ax.x;
  const yk = ax.y;
  const zk = ax.z;

  const x = sample.map((r) => (xk ? parseFloat(r[xk]) : NaN));
  const y = sample.map((r) => (yk ? parseFloat(r[yk]) : NaN));
  const z = sample.map((r) => (zk ? parseFloat(r[zk]) : 0));

  const clean = (arr, fallback = 0) =>
    arr.map((v) => (Number.isFinite(v) ? v : fallback));

  const cx = clean(x, 0);
  const cy = clean(y, 0);
  const cz = clean(z, 0);

  if (chartType === 'surface') {
    return {
      type: 'scatter3d',
      mode: 'markers',
      x: cx,
      y: cy,
      z: cz,
      marker: {
        size: 2,
        color: cz,
        colorscale: 'Viridis',
        opacity: 0.85,
      },
    };
  }

  return {
    type: 'scatter3d',
    mode: 'markers',
    x: cx,
    y: cy,
    z: cz,
    marker: { size: 2, color: '#00F5FF', opacity: 0.85 },
  };
}
```

---

## Reference: `BadgeExport.jsx` shape (FORGE wires utils + Plotly)

- `import` **`computeStats`**, **`buildMiniTrace`**, **`sanitizeFilename`** — single module graph, no undefined helpers
- **`useRef`** on the **card root** for `html2canvas`
- **Mini Plotly `layout`:** transparent paper/plot bg, zero margins, hidden axes, fixed `scene.camera`
- **`exportPNG`:** `html2canvas(badgeRef.current, { backgroundColor: '#0A0A0F', scale: 2, logging: false })` → `toDataURL` → download `${sanitizeFilename(...)}-badge.png`
- **`exportSVG`:** implement **chosen SVG policy**; do not ship raw `foreignObject` + `outerHTML` without Option B sign-off
- **Export buttons:** outside the `ref` target if buttons must not appear on the badge image (clarify with FORM); if buttons are inside ref, they appear on PNG — usually **exclude** buttons from capture

### Mini layout (reference)

```js
const miniLayout = {
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  margin: { l: 0, r: 0, t: 0, b: 0 },
  showlegend: false,
  scene: {
    bgcolor: 'rgba(0,0,0,0)',
    xaxis: { visible: false },
    yaxis: { visible: false },
    zaxis: { visible: false },
    camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
  },
};
```

### Card layout (your original structure — keep)

- Left: **160×160** mini chart container, rounded, cyan border glow  
- Right: **DATASET** label, filename, **2×2 stats grid**, footer **chart type** pill + **timestamp**  
- Absolute **grid texture** overlay; **SPATIAL VIZ** (or final) bottom-right  
- **Export row** below card (recommended **outside** `badgeRef` so PNG is card-only)

---

## Hand-off checklist (ANCHOR / RIGOR)

- [ ] SVG policy **A / B / C** recorded in ticket  
- [ ] `badgeStats` + `badgeMiniTrace` covered by **unit tests** or RIGOR scripts  
- [ ] CORS / font issues for `html2canvas` documented if external assets added  
- [ ] No critical console errors on export path (Chrome, Firefox, Safari)

---

## Coordination (PRD Appendix A)

1. **PRIME** — user story + acceptance criteria linked to this brief  
2. **COMPASS** — validates Plotly + export approach against test matrix  
3. **FORGE** — implements files above  
4. **FORM** — modal, trigger placement, copy, optional “SVG experimental”  
5. **RIGOR** — empty/large/malformed data, PNG byte sanity, SVG cross-browser  

---

*Scoping document — internal agent alignment. Implementation follows Phase 3 schedule.*
