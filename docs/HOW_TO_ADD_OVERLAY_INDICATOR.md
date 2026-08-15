# How to Add a New Indicator to the Main Chart Overlay

This guide covers the **overlay system** behind the "Overlay" dropdown on the
K-line chart — checkboxes grouped into **Moving Averages / Bands / Other /
Pivots**, each with an optional period input, drawing lines directly on top
of the candles (SMA, Bollinger, Pivot points, etc.). This is **separate**
from the sub-panel indicator system (`multi-indicator-system.js`) — see
[HOW-TO-CREATE-NEW-INDICATORS.md](HOW-TO-CREATE-NEW-INDICATORS.md) for that one.

---

## Where the Code Lives

All overlay logic is inside one file:

```
stock-market/stock-app.prod.js
```

The pieces you touch, in the order you edit them:

| # | What | Purpose |
|---|------|---------|
| 1 | `OVERLAY_DEFS` array (~line 100) | Registers the indicator — drives the dropdown, checkbox, color dot, and param inputs automatically |
| 2 | `computeXxx()` function (~line 133+) | Calls the Wang function (or does the math inline), returns `{time, value}[]` or a `{seriesName: [...]}` object |
| 3 | `getOverlayData()` switch (~line 432) | Routes an `id` to its compute function and tags the result with a `type` string |
| 4 | `addOverlayToChart()` (~line 469) / `refreshOverlays()` (~line 561) | Only needed for a **new shape** of multi-line overlay — most multi-line indicators reuse an existing `type` |

The checkbox list, color dots, period inputs, localStorage persistence, and
group headers (`setupOverlayDropdown()`, ~line 632) are all generated purely
from `OVERLAY_DEFS` — you never touch that UI code for a new indicator.

---

## The `type` Tag and What It Buys You

`getOverlayData()` returns `{ type: '...', ...data }`. The `type` string
tells `addOverlayToChart()`/`refreshOverlays()` how many series to create and
how to color them. **Reuse an existing type whenever your indicator's shape
matches one already there** — that's the difference between a 2-step change
(compute + switch case) and a 4-step one (compute + switch case + two new
`if` blocks).

| `type` | Shape | Existing examples |
|---|---|---|
| `'single'` | 1 line | SMA, EMA, VWAP, KAMA, HullMA, DEMA20, ZLEMA, TEMA, VIDYA, MGD |
| `'bb'` | 3 lines, upper/middle/lower, one color | BB20 (Bollinger) |
| `'wvc'` | 3 lines, upper/middle/lower, **distinct** upper/lower colors, 2 params | WVC (Williams Volatility Channel) |
| `'boll4sd'` | 3 lines, upper/middle/lower, 2 params (`MA`, `SD`) | BOLL4SD |
| `'donchian'` | 3 lines, upper/middle/lower | DonchianChannel |
| `'cks'` | 2 lines, long/short (green/red) | CKstop, ChandelierExit — **both reuse the same `'cks'` block**, just different compute functions |
| `'fcb'` | 2 lines, high/low (green/red) | FCB (Fractal Chaos Bands) |
| `'pivot'` | **N lines**, driven by metadata — no new render code needed | PivotClassic, PivotWoodie, PivotFibonacci, PivotCamarilla, PivotDeMark |

If your new indicator is "3 lines, one color" → reuse `'bb'`. "2 lines,
long/short" → reuse `'cks'`. Only invent a new `type` string (and write new
`if` blocks in both `addOverlayToChart` and `refreshOverlays`) when nothing
existing fits.

---

## `OVERLAY_DEFS` Field Reference

```js
{ id:'WVC', group:'Bands', label:'WilliamsVC', color:'#38bdf8',
  colorUpper:'#f87171', colorLower:'#4ade80',
  multi:true, defaultParam:10, defaultParam2:9,
  paramLabel:'day', paramLabel2:'esp' }
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique key — used everywhere internally |
| `group` | yes | Dropdown group heading: `'Moving Averages'`, `'Bands'`, `'Other'`, `'Pivots'` (a new group name just works — the UI reads groups from whatever's in `OVERLAY_DEFS`) |
| `label` | yes | Display prefix shown in legend/title (e.g. `'WMA'`) |
| `color` | yes | Default line color; also the checkbox accent color and the group's color dot |
| `defaultParam` | no | If set, a period input appears (label defaults to `n`, override with `paramLabel`) |
| `defaultParam2` | no | A **second** input for two-parameter indicators (e.g. `day`/`esp`, `MA`/`SD`) — label via `paramLabel2` |
| `paramLabel` / `paramLabel2` | no | Text shown next to the param input(s), e.g. `'day'`, `'MA'` |
| `colorLong` / `colorShort` | no | Used by `'cks'`/`'fcb'` types for the two-line long/short or high/low coloring |
| `colorUpper` / `colorLower` | no | Used by `'wvc'` to color the band edges differently from the middle line |
| `multi` | no | Documentation only — the `type` string is what actually drives rendering, not this flag |
| `pivotLines` | only for `'pivot'` type | Array of `{ key, role }` — `key` matches a property on the compute function's return object, `role` is `'resistance'` / `'support'` / `'pivot'` (drives red/green/neutral coloring) |

---

## Step-by-Step: Single-Line Overlay

### Step 1 — Add to `OVERLAY_DEFS`

```js
// stock-market/stock-app.prod.js  ~line 100
const OVERLAY_DEFS = [
  // ... existing entries ...
  { id:'WMA14', group:'Moving Averages', label:'WMA', color:'#f59e0b', defaultParam:14 },
];
```

### Step 2 — Write a compute function

Must return an array of `{ time, value }` objects, same length as `chartData`.

```js
function computeWMAData(data, period) {
  return data.map((d, i) => {
    if (i < period - 1) return { time: d.time, value: null };
    let weightedSum = 0, weightSum = 0;
    for (let j = 0; j < period; j++) {
      const weight = period - j;          // newest bar gets highest weight
      weightedSum += data[i - j].close * weight;
      weightSum   += weight;
    }
    return { time: d.time, value: weightedSum / weightSum };
  });
}
```

**If you are wrapping a Wang function** (from `technical-indicators.prods__Wang__2026.js`):

```js
function computeMyWangData(data, day) {
  const fn = window.MyWangFunction;
  if (!fn) return null;
  const highs  = data.map(d => d.high);
  const lows   = data.map(d => d.low);
  const closes = data.map(d => d.close);
  try {
    const out = fn(highs, lows, closes, day);
    const src = out && out.MyOutput ? out.MyOutput : [];
    return data.map((d, i) => ({
      time:  d.time,
      value: (src[i + 1] != null && Number.isFinite(src[i + 1])) ? src[i + 1] : null
    }));
  } catch (e) { return null; }
}
```

> **Don't assume the `+1` shift — verify it per function.** Wang-style
> functions are usually 1-based internally (`src[i + 1]` lines up with
> 0-based chart bar `i`), which is what most existing overlays use (KAMA,
> HullMA, DEMA, WVC, Donchian, Chandelier, CKstop). But it isn't universal:
> `computeZeroLagEMAData` reads `src[i]` with **no** shift, and
> `computeBoll4SDData` does the same — the code has a comment there noting
> it was "verified empirically, unlike the other Wang overlays here." The
> pivot functions also use `src[i]` directly, because their one-bar lag is
> already baked into the formula (they key off the *previous* bar's H/L/C).
> **Log a few values and compare against a known reference** rather than
> copying the `+1` blindly — an off-by-one here silently shifts your whole
> line by one bar.

### Step 3 — Add a case to `getOverlayData()`

```js
function getOverlayData(id) {
  const d = chartData;
  const p = getOverlayParam(id);
  switch (id) {
    // ... existing cases ...
    case 'WMA14': return { type:'single', data: computeWMAData(d, p) };
    default: return null;
  }
}
```

That's it — checkbox, param input, localStorage persistence, and rendering
are all automatic for `type: 'single'`.

---

## Step-by-Step: Two-Line Long/Short Overlay (reuse `'cks'`)

Use this when your indicator naturally has two lines that are never both
"active" at the same bar — a long stop and a short stop, a fractal high and
low. **CKstop and ChandelierExit both reuse the exact same `'cks'` render
block** — only their compute functions differ.

```js
// OVERLAY_DEFS
{ id:'MyStop', group:'Bands', label:'My Stop', color:'#fbbf24',
  colorLong:'#4ade80', colorShort:'#f87171', multi:true, defaultParam:10, paramLabel:'n' },
```

```js
// compute — return { long: [...], short: [...] }
function computeMyStopData(data, num) {
  const fn = window.MyStopFunction;
  if (!fn) return null;
  const highs = data.map(d => d.high), lows = data.map(d => d.low), closes = data.map(d => d.close);
  try {
    const out = fn(highs, lows, closes, num);
    if (!out) return null;
    const srcLong = out.Long || [], srcShort = out.Short || [];
    const toSeries = src => data.map((d, i) => ({
      time: d.time,
      value: (src[i + 1] != null && Number.isFinite(src[i + 1])) ? src[i + 1] : null
    }));
    return { long: toSeries(srcLong), short: toSeries(srcShort) };
  } catch (e) { return null; }
}
```

```js
// getOverlayData — reuse type: 'cks', no new render code needed
case 'MyStop': return { type:'cks', ...computeMyStopData(d, p) };
```

`addOverlayToChart`/`refreshOverlays` already know how to draw `'cks'`
(`def.colorLong`/`def.colorShort`, two series, titled `${label}-Long(n)` /
`${label}-Short(n)`). If your pair is "high/low" rather than "long/short",
reuse `'fcb'` instead — same idea, different result keys (`high`/`low`).

---

## Step-by-Step: N-Line Overlay via Metadata (Pivots pattern)

This is the pattern to reach for whenever an indicator draws **more than 3
related lines** (resistance/support levels, multiple bands) — instead of
writing bespoke render code per indicator, describe the lines as data and
let one generic block draw all of them.

### Step 1 — compute returns one array per line, keyed by name

```js
// Real code: mapPivotSeries() + computePivotData(), ~line 289
function mapPivotSeries(out, data) {
  if (!out) return null;
  const result = {};
  Object.keys(out).forEach(key => {
    const src = out[key];
    result[key] = data.map((d, i) => {
      const v = src ? src[i] : undefined;
      return { time: d.time, value: (v != null && Number.isFinite(v)) ? v : null };
    });
  });
  return result;
}

function computePivotData(fn, data) {
  if (!fn) return null;
  const highs = data.map(d => d.high), lows = data.map(d => d.low), closes = data.map(d => d.close);
  try { return mapPivotSeries(fn(highs, lows, closes), data); } catch (e) { return null; }
}
```

`fn(highs, lows, closes)` here is e.g. `window.PivotPointsClassic`, which
returns an object like `{ Resistance3, Resistance2, Resistance1, Support1,
Support2, Support3 }` — `mapPivotSeries` turns every key into an aligned
`{time, value}[]` automatically, with no per-line code.

### Step 2 — `OVERLAY_DEFS` entry describes the lines and their roles

```js
{ id:'PivotClassic', group:'Pivots', label:'Pivot Classic', color:'#60a5fa', multi:true,
  pivotLines:[
    {key:'Resistance3',role:'resistance'}, {key:'Resistance2',role:'resistance'}, {key:'Resistance1',role:'resistance'},
    {key:'Support1',role:'support'}, {key:'Support2',role:'support'}, {key:'Support3',role:'support'},
  ] },
```

`key` must match a property name the compute function returns. `role` drives
color (resistance → red, support → green, `'pivot'` → the def's own color).

### Step 3 — `getOverlayData()` case

```js
case 'PivotClassic': return { type:'pivot', ...computePivotData(window.PivotPointsClassic, d) };
```

### Nothing else to write

`addOverlayToChart` and `refreshOverlays` already have a generic `'pivot'`
branch that loops `def.pivotLines` and creates/updates one series per entry:

```js
// addOverlayToChart — real code, ~line 525
} else if (result.type === 'pivot') {
  if (!def.pivotLines) return;
  const opts = { lineWidth: 1, lineStyle: 2, priceLineVisible: false, crosshairMarkerVisible: false, lastValueVisible: true };
  overlaySeries[id] = def.pivotLines.map(pl => {
    const color = pl.role === 'resistance' ? '#f87171' : pl.role === 'support' ? '#4ade80' : (def.color || '#94a3b8');
    const s = chart.addLineSeries({ ...opts, color, lineStyle: pl.key.endsWith('1') || pl.role === 'pivot' ? 0 : 2, title: `${def.label} ${pl.key}` });
    s.setData(nonNull(result[pl.key]));
    return s;
  });
}
```

Adding a **6th** pivot variant (say, Pivot Camarilla with 8 lines) only ever
needs Steps 1–3 above — zero changes to the render code, because it's fully
data-driven off `pivotLines`. This is the preferred pattern any time you'd
otherwise be tempted to hand-write a 4th, 5th, 6th "multi-line" `if` block.

---

## Step-by-Step: Two-Parameter Multi-Line Overlay (`'wvc'` / `'boll4sd'` pattern)

Use when the indicator needs two independent inputs (e.g. a period and a
smoothing factor) and draws a fixed 3-line band. `getOverlayParam2(id)`
reads the second value the same way `getOverlayParam(id)` reads the first.

```js
// OVERLAY_DEFS
{ id:'BOLL4SD', group:'Bands', label:'Bollinger 4SD', color:'#c084fc',
  multi:true, defaultParam:10, defaultParam2:20, paramLabel:'MA', paramLabel2:'SD' },
```

```js
// getOverlayData
case 'BOLL4SD': return { type:'boll4sd', ...computeBoll4SDData(d, p, getOverlayParam2(id)) };
```

If your 2-param indicator is a 3-line band, you can reuse `'boll4sd'`'s
render block (same shape as `'bb'`, just titled with both params) — only add
a new `type`/render block if the coloring needs to differ per line (like
`'wvc'` does with `colorUpper`/`colorLower`).

---

## Visual Summary

```
OVERLAY_DEFS entry
  id, group, label, color(s), defaultParam(s), paramLabel(s), [pivotLines]
        │
        ▼
computeXxxData(data, ...params)
  calls window.WangFunction(...) or computes inline
  aligns Wang's (often 1-based) output to 0-based chart bars — verify the
  shift empirically per function, don't assume +1
  returns { data: [...] } (single) or named arrays (multi) or per-key map (pivot)
        │
        ▼
getOverlayData(id)
  tags the result: { type: 'single' | 'bb' | 'wvc' | 'boll4sd' | 'donchian'
                           | 'cks' | 'fcb' | 'pivot' | <new>, ...data }
        │
        ├──► addOverlayToChart()   creates series (reuses existing type's
        │                          block, or a new one only if no shape fits)
        └──► refreshOverlays()     calls setData() on the stored series
```

---

## Quick Checklist

- [ ] Picked a `type` — reused an existing one if the shape matches (`single` / `bb` / `wvc` / `boll4sd` / `donchian` / `cks` / `fcb` / `pivot`), only invented a new one if nothing fits
- [ ] Added entry to `OVERLAY_DEFS` (`id`, `group`, `label`, color(s), `defaultParam`(s), `paramLabel`(s), `pivotLines` if using the pivot pattern)
- [ ] Wrote `computeXxx()` — verified the Wang function's index alignment empirically (don't assume `src[i + 1]`)
- [ ] Added `case 'MY_ID':` in `getOverlayData()`
- [ ] **Only if no existing `type` fits:** added a new `else if (result.type === 'mytype')` block in both `addOverlayToChart()` and `refreshOverlays()`
- [ ] Verified `window.MyWangFunction` exists in `technical-indicators.prods__Wang__2026.js`
- [ ] Reloaded the page, loaded data, checked the dropdown group, toggled the checkbox, confirmed the line(s) render and update when the period input changes
