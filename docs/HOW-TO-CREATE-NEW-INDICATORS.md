# How to Create New Indicators

## New system: one registry entry

Every indicator - on the price chart or in its own pane - is one entry in the
registry (`src/js/indicators/`). Panes are native panes of the main chart
(lightweight-charts v5); the legend, settings dialog, colours, saving and the
**Indicators** picker all come from the entry, so there's nothing else to wire.

The entries live in `src/js/indicators/defs/`:

| File | What's in it |
|------|--------------|
| `overlays.js` | price-chart indicators (moving averages, bands, pivots) |
| `wang.js` | Prof. Wang's pane functions, one table row each (see section 0) |
| `trend.js`, `momentum.js`, `oscillators.js`, `volume.js`, `volatility.js` | the classic pane indicators; their `math` calls the compute method in `multi-indicator-system.js` |
| `legacy.js` | fallback: a definition added only to `multi-indicator-system.js` still shows up as a pane indicator, and `npm test` lists it as "still legacy" |

```js
TFIndicators.registry.register({
  id: 'SMA',                       // unique, stable (saved setups refer to it)
  name: 'Simple Moving Average', shortName: 'SMA',
  category: 'Moving averages',     // picker group (see registry.CATEGORY_ORDER)
  placement: 'chart',              // default home: 'chart' (price pane) or 'pane'
  params:  [{ key: 'period', label: 'Length', default: 20, min: 1 }],
  outputs: [{ key: 'value', color: '#34d399' }],   // one series per output
  compute: (candles, p) => ({ value: sma(candles.map(c => c.close), p.period) }),
});
```

- `compute` returns one array per output: one value per candle, or fewer - a
  shorter array is right-aligned (its last value is the latest candle's).
  `null` / `NaN` leave a gap, and a bare array counts as `{ value: array }`.
  For a Prof. Wang function use `TFIndicators.util.call('FnName', ...)` and
  `util.aligned(candles, out.X, shift)` - `shift 1` for his 1-based functions
  (`src[i+1]` belongs to bar i), `0` for the others.
- Output options: `type` (`'line'` | `'histogram'` | `'area'`), `from` (the
  result field to draw when it isn't `key`), `title` (legend label),
  `lineWidth`, `lineStyle` (`'solid'` | `'dashed'` | `'dotted'`),
  `lineType: 'step'`, `scale: 'left'` (a second price scale on the pane's left;
  `leftScale: { borderColor, scaleMargins }` on the entry sets its options),
  `lastValue: false` (no price-axis label / legend value), `axisTitle: true`
  (put the key on the axis label), `priceFormat`, and for histograms
  `signColors: { up, down }` or `colorKey: 'Field'` (per-bar colours, looked
  up in `colorMap` if given).
- `levels: [{ value: 70 }, { value: 30 }]` draws fixed horizontal lines and
  keeps them in view.
- `stats: [{ label: 'Acc', value: (result) => result.Acc_RR, digits: 2, suffix: '%' }]`
  shows summary numbers from compute()'s result after the legend values.
- `minBars`: draw nothing on fewer candles.
- Pane files use the shorthands `TFIndicators.outputs.line(key, color, title, extra)`
  / `.hist(key, extra)` and the colours in `TFIndicators.palette` (`UP`, `DOWN`,
  `LINE1` ...).
- `npm test` runs every entry (`test/run-registry-tests.js`). An entry that
  replaced a `multi-indicator-system.js` definition must draw exactly what the
  old one drew, point by point.

The rest of this guide describes the older `multi-indicator-system.js`
definitions. The crypto-trading page still uses them for its panels, and the
classic pane files call their compute methods for the math - but a new
indicator for the stock pages only needs a registry entry.

---

**Want a short version?** See **[SIMPLE-INDICATOR-PLAN.md](SIMPLE-INDICATOR-PLAN.md)** — 3 steps, one file, copy-paste example.

This guide explains how to add new technical indicators to the TradeLite trading app in full detail. Indicators are defined and rendered in the **multi-indicator system** and can use shared compute functions from `technical-indicators.js` or custom logic.

---

## 0. Quick path: a Prof. Wang function drawn in a small window

If the function already exists in `technical-indicators.prods__Wang__2026.js`
(exposed as `window.X`) and its comment says *"drawing ... in the small
windows"*, you don't need a compute/render pair. Add **one row** to `TABLE`
in `src/js/indicators/defs/wang.js`:

```javascript
TRIX: { name: 'TRIX', type: 'momentum', fn: 'TRIX', inputs: ['close'], params: [['esp', 9]], lines: ['TRIX', 'eTRIX'] },
```

| Field | Meaning |
|-------|---------|
| key (`TRIX`) | Unique indicator key (also saved in layouts) |
| `name` | Name in the indicator picker - use the function's `Menu Name` |
| `type` | Picker category: `trend`, `momentum`, `oscillator`, `volume`, `volatility` |
| `fn` | The `window.*` function to call |
| `inputs` | Candle fields passed first, in the function's argument order: `open`, `high`, `low`, `close`, `volume` |
| `params` | The remaining arguments in order, as `[name, default]` - add `true` as a 3rd item for a fractional one (e.g. `['va', 0.7, true]`); the others are rounded because they're day counts |
| `lines` | Returned arrays to draw as lines (`titles: { key: 'Legend name' }` renames any) |
| `histogram` | Optional returned array drawn as bars, colored by sign - or by a returned `'Green'/'Red'/'Blue'` array named in `colorKey` |
| `withClose` | Also draw the close price (for price-scale indicators the comment says to draw with `STK_close`) |
| `volumeScale` / `precision` | Axis format for values in the millions (K/M/B) / very small values |
| `minPeriod` | Optional; defaults to the largest day-count param |

That's all - the picker entry, parameter inputs, legend and the regression
test (`npm test`) pick it up automatically. Run `npm test` after adding one:
it fails if the function throws, or its output is blank everywhere or at the
latest bars, and it warns about a single line with no values - which is how
most bugs in new Wang functions show up. The crypto-trading page reads its own
copy of this table (`WANG_PANEL_INDICATORS` in `multi-indicator-system.js`);
add the row there as well if it should appear on that page. If the comment
says *"K_Line area"*, it's a price-chart indicator instead: give it an entry
in `src/js/indicators/defs/overlays.js`.

When the table can't express an indicator, write a registry entry (see the
top of this guide).

---

## 1. Overview

Each indicator has:

1. **Compute** – turns candle data into one or more value arrays (e.g. line values, histogram).
2. **Render** – creates LightweightCharts series (line, histogram, area) and feeds them with **aligned** data (lead-in nulls so indicator bars line up with price candles).

Definitions live in **one place**: `createIndicatorDefinitions()` inside `src/js/core/multi-indicator-system.js`. Adding a new indicator means:

- Adding an entry to that object,
- Implementing a `compute*` method (and optionally a standalone compute function),
- Implementing a `render*` method that uses `seriesWithLeadInPadding` for alignment.

---

## 2. Input Data Shape

The **compute** functions receive:

- **`data`** – Array of candle objects, one per bar. Each item has:
  - `time` – bar time (e.g. `'2024-01-15'` or Unix)
  - `open`, `high`, `low`, `close` – numbers
  - `volume` (optional) – number
- **`params`** – Object with your indicator’s parameters (from `defaultParams` and the UI).

Always take **data as parameters**. Do not rely on globals (e.g. `STK_close`); the app passes candle data into your compute function.

Example: extract arrays for your formula:

```javascript
computeMyIndicator(data, period) {
  const high  = data.map(d => d.high);
  const low   = data.map(d => d.low);
  const close = data.map(d => d.close);
  const volume = data.map(d => d.volume ?? 0);
  // ... compute and return { line1: [...], line2: [...] }
}
```

---

## 3. Indicator Definition Shape

In `createIndicatorDefinitions()` you add an entry like:

```javascript
MY_INDICATOR: {
  name: 'My Indicator',           // Display name in UI
  type: 'oscillator',             // 'oscillator' | 'trend' | 'momentum' | 'volume' | 'volatility'
  defaultParams: { period: 14 },   // Default parameters
  paramLabels: { period: 'Period' },  // Labels for parameter inputs
  minPeriod: 14,                  // Minimum bars needed (for validation/empty state)
  overbought: 70,                 // Optional: for oscillators (reference line)
  oversold: 30,                   // Optional: for oscillators (reference line)
  compute: (data, params) => this.computeMyIndicator(data, params.period),
  render: (chart, data, colors, seriesMap) => this.renderMyIndicator(chart, data, colors, seriesMap)
}
```

Optional:

- **`paramOptions`** – e.g. `{ type: ['SMA', 'EMA'] }` for dropdowns.
- **`editable: false`** – to disable parameter editing in the UI.

---

## 4. Compute Function

- **Input:** `data` (array of candles), and your parameters (e.g. `period`).
- **Output:** A single object whose keys are the series you will draw (e.g. `line1`, `line2`, `histogram`). Values are **arrays of numbers** (or `null`/`NaN` where no value).

Return arrays **aligned by index** with the candle array: same length as `data`, use `null` or `NaN` for bars where the indicator is not defined (e.g. warm-up).

Example (single line):

```javascript
computeMyIndicator(data, period = 14) {
  const close = data.map(d => d.close);
  const out = new Array(close.length).fill(null);
  for (let i = period; i < close.length; i++) {
    // your formula
    out[i] = close[i] - close[i - period];
  }
  return { line1: out };
}
```

Example (two lines, e.g. RWI):

```javascript
computeRandomWalkingIndex(data, RWI_n = 10, esp = 9) {
  const high  = data.map(d => d.high);
  const low   = data.map(d => d.low);
  const close = data.map(d => d.close);
  const result = computeRandomWalkIndex(RWI_n, esp, high, low, close);
  const toNull = (v) => (v != null && Number.isFinite(v) ? v : null);
  return {
    RWI_high: result.RWI_high.map(toNull),
    RWI_low:  result.RWI_low.map(toNull)
  };
}
```

If you implement the math in a **separate file** (e.g. `Wang_design_new_indicators__RandomWalkIndex _2026-01-20.js`), expose it on `window` and call it from the compute wrapper (as with `window.computeRandomWalkIndex` for RWI). The wrapper’s job is to map `data` → arrays and pass them in, then map the result (e.g. NaN → null) and return the object expected by render.

---

## 5. Render Function

- **Input:** `chart` (LightweightCharts instance for that panel), `data` (the object returned by compute), `colors` (theme), `seriesMap` (Map of series key → series object).
- **Job:** Create series once (using `seriesMap`), then convert your arrays to **time-value data with lead-in null padding** and call `setData`.

Use **`this.seriesWithLeadInPadding(array, valueFn)`** so indicator points align with price candles (TradingView-style). It prepends nulls so the first valid value lines up with the correct candle.

Example (one line):

```javascript
renderMyIndicator(chart, data, colors, seriesMap) {
  if (!data || !data.line1) return;

  if (!seriesMap.has('line1')) {
    seriesMap.set('line1', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Line 1',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }

  const line1Data = this.seriesWithLeadInPadding(data.line1, (v) =>
    (v != null && !isNaN(v) && Number.isFinite(v) ? v : null)
  );
  seriesMap.get('line1').setData(line1Data);
}
```

Two lines:

```javascript
if (!seriesMap.has('rwi_high')) {
  seriesMap.set('rwi_high', chart.addLineSeries({
    color: colors.LINE1, lineWidth: 2, title: 'RWI High',
    crosshairMarkerVisible: false, priceLineVisible: false
  }));
}
if (!seriesMap.has('rwi_low')) {
  seriesMap.set('rwi_low', chart.addLineSeries({
    color: colors.LINE2, lineWidth: 2, title: 'RWI Low',
    crosshairMarkerVisible: false, priceLineVisible: false
  }));
}

const highData = this.seriesWithLeadInPadding(data.RWI_high, (v) =>
  (v != null && !isNaN(v) && Number.isFinite(v) ? v : null)
);
const lowData = this.seriesWithLeadInPadding(data.RWI_low, (v) =>
  (v != null && !isNaN(v) && Number.isFinite(v) ? v : null)
);
seriesMap.get('rwi_high').setData(highData);
seriesMap.get('rwi_low').setData(lowData);
```

For **histograms** (e.g. MACD), use `addHistogramSeries` and pass `{ value, color }` in the valueFn when you need per-bar color:

```javascript
const histData = this.seriesWithLeadInPadding(data.hist, (v) => {
  if (v == null || isNaN(v)) return { value: null };
  return { value: v, color: v >= 0 ? colors.UP : colors.DOWN };
});
seriesMap.get('histogram').setData(histData);
```

---

## 5.1 Example: Complete two-line indicator

This example adds a **two-line oscillator**: a raw line and a smoothed line (e.g. Vol RSI and eVol RSI). Use it as a template for any indicator that draws two series.

### 1) Definition in `createIndicatorDefinitions()`

```javascript
TWO_LINE_EXAMPLE: {
  name: 'Two-Line Example',
  type: 'oscillator',
  defaultParams: { period: 10, smooth: 9 },
  paramLabels: { period: 'Period', smooth: 'Smoothing' },
  minPeriod: 10,
  overbought: 70,
  oversold: 30,
  compute: (data, params) => this.computeTwoLineExample(data, params.period, params.smooth),
  render: (chart, data, colors, seriesMap) => this.renderTwoLineExample(chart, data, colors, seriesMap)
}
```

### 2) Compute: return two arrays (same length as `data`)

Your compute must return one object with **two array keys**; the render will use those keys to create two series. Use `null` for bars before the indicator is defined.

```javascript
computeTwoLineExample(data, period = 10, smooth = 9) {
  const close = data.map(d => d.close);
  const len = close.length;
  const lineA = new Array(len).fill(null);   // raw line
  const lineB = new Array(len).fill(null);   // smoothed line

  if (len < period + 1) return { lineA, lineB };

  // Example: first line = simple average of last `period` closes; second = smoothed
  for (let i = period; i < len; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += close[i - j];
    lineA[i] = sum / period;

    if (i === period) {
      lineB[i] = lineA[i];
    } else {
      lineB[i] = (smooth - 1) / (smooth + 1) * lineB[i - 1] + (2 / (smooth + 1)) * lineA[i];
    }
  }

  return { lineA, lineB };
}
```

### 3) Render: two line series + optional reference lines

Create **two line series** (and optionally overbought/oversold lines). Use `seriesWithLeadInPadding` for each array so they align with the price chart.

```javascript
renderTwoLineExample(chart, data, colors, seriesMap) {
  if (!data || !data.lineA || !data.lineB) return;

  if (!seriesMap.has('lineA')) {
    seriesMap.set('lineA', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Line A',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('lineB')) {
    seriesMap.set('lineB', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'Line B',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('ob')) {
    seriesMap.set('ob', chart.addLineSeries({
      color: '#666', lineWidth: 1, lineStyle: 2, title: '', crosshairMarkerVisible: false, priceLineVisible: false
    }));
  }
  if (!seriesMap.has('os')) {
    seriesMap.set('os', chart.addLineSeries({
      color: '#666', lineWidth: 1, lineStyle: 2, title: '', crosshairMarkerVisible: false, priceLineVisible: false
    }));
  }

  const valueFn = (v) => (v != null && !isNaN(v) ? v : null);
  const lineAData = this.seriesWithLeadInPadding(data.lineA, valueFn);
  const lineBData = this.seriesWithLeadInPadding(data.lineB, valueFn);
  const obData   = this.seriesWithLeadInPadding(data.lineA, (v) => (v != null && !isNaN(v) ? 70 : null));
  const osData   = this.seriesWithLeadInPadding(data.lineA, (v) => (v != null && !isNaN(v) ? 30 : null));

  seriesMap.get('lineA').setData(lineAData);
  seriesMap.get('lineB').setData(lineBData);
  seriesMap.get('ob').setData(obData);
  seriesMap.get('os').setData(osData);
}
```

**Summary for two-line indicators:**

| Step   | What to do |
|--------|------------|
| Define | One entry in `createIndicatorDefinitions()` with `compute` and `render` pointing to your methods. |
| Compute | Return `{ lineA: number[], lineB: number[] }`; arrays same length as `data`, use `null` where no value. |
| Render | Create two `addLineSeries` (and optional ref lines), then `seriesWithLeadInPadding` for each array and `setData`. |

---

## 5.2 Example: Complete three-line indicator

This example adds a **three-line indicator**: e.g. short, medium, and long moving averages (or upper/mid/lower band). Use it as a template for any indicator that draws three series.

### 1) Definition in `createIndicatorDefinitions()`

```javascript
THREE_LINE_EXAMPLE: {
  name: 'Three-Line Example',
  type: 'trend',
  defaultParams: { short: 5, medium: 10, long: 20 },
  paramLabels: { short: 'Short', medium: 'Medium', long: 'Long' },
  minPeriod: 20,
  compute: (data, params) => this.computeThreeLineExample(data, params.short, params.medium, params.long),
  render: (chart, data, colors, seriesMap) => this.renderThreeLineExample(chart, data, colors, seriesMap)
}
```

### 2) Compute: return three arrays (same length as `data`)

Return one object with **three array keys**; use `null` for bars before each line has a value.

```javascript
computeThreeLineExample(data, shortPeriod = 5, mediumPeriod = 10, longPeriod = 20) {
  const close = data.map(d => d.close);
  const len = close.length;
  const line1 = new Array(len).fill(null);   // short MA
  const line2 = new Array(len).fill(null);   // medium MA
  const line3 = new Array(len).fill(null);   // long MA

  const sma = (arr, i, period) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += arr[i - j];
    return sum / period;
  };

  for (let i = 0; i < len; i++) {
    line1[i] = sma(close, i, shortPeriod);
    line2[i] = sma(close, i, mediumPeriod);
    line3[i] = sma(close, i, longPeriod);
  }

  return { line1, line2, line3 };
}
```

### 3) Render: three line series

Create **three line series**, then `seriesWithLeadInPadding` for each and `setData`.

```javascript
renderThreeLineExample(chart, data, colors, seriesMap) {
  if (!data || !data.line1 || !data.line2 || !data.line3) return;

  if (!seriesMap.has('line1')) {
    seriesMap.set('line1', chart.addLineSeries({
      color: colors.LINE1,
      lineWidth: 2,
      title: 'Short',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('line2')) {
    seriesMap.set('line2', chart.addLineSeries({
      color: colors.LINE2,
      lineWidth: 2,
      title: 'Medium',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }
  if (!seriesMap.has('line3')) {
    seriesMap.set('line3', chart.addLineSeries({
      color: colors.LINE3,
      lineWidth: 2,
      title: 'Long',
      crosshairMarkerVisible: false,
      priceLineVisible: false
    }));
  }

  const valueFn = (v) => (v != null && !isNaN(v) ? v : null);
  seriesMap.get('line1').setData(this.seriesWithLeadInPadding(data.line1, valueFn));
  seriesMap.get('line2').setData(this.seriesWithLeadInPadding(data.line2, valueFn));
  seriesMap.get('line3').setData(this.seriesWithLeadInPadding(data.line3, valueFn));
}
```

**Summary for three-line indicators:**

| Step   | What to do |
|--------|------------|
| Define | One entry with three params (e.g. short/medium/long periods), `compute` and `render` pointing to your methods. |
| Compute | Return `{ line1: number[], line2: number[], line3: number[] }`; arrays same length as `data`, use `null` where no value. |
| Render | Create three `addLineSeries`, then `seriesWithLeadInPadding` for each array and `setData`. Use `colors.LINE1`, `LINE2`, `LINE3` if available. |

---

## 6. Step-by-Step Checklist

1. **Add the definition** in `createIndicatorDefinitions()` in `src/js/core/multi-indicator-system.js`:
   - Unique key (e.g. `MY_INDICATOR`), `name`, `type`, `defaultParams`, `paramLabels`, `minPeriod`, `compute`, `render`.
2. **Implement the compute method** on the class (e.g. `computeMyIndicator(data, period)`):
   - Map `data` to arrays (`high`, `low`, `close`, etc.), run your math, return an object of arrays (same length as `data`, use null/NaN where undefined).
3. **Implement the render method** (e.g. `renderMyIndicator(chart, data, colors, seriesMap)`):
   - Create series only if not in `seriesMap` (line, histogram, or area).
   - Build data with `this.seriesWithLeadInPadding(array, valueFn)` and call `series.setData(...)`.
4. **Expose the indicator in the UI** by including its key in the list of indicators used when creating the flexible indicator section (e.g. `createFlexibleIndicatorSection(containerId, ['MACD', 'RSI', 'MY_INDICATOR'])` or whatever config drives the dropdown/list).

---

## 7. File Locations

| What | File |
|------|------|
| Indicator definitions (registry) | `src/js/core/multi-indicator-system.js` — `createIndicatorDefinitions()` |
| Compute + render methods | Same file — class `MultiIndicatorSystem` |
| Shared compute helpers (SMA, EMA, RSI, MACD, etc.) | `src/js/core/technical-indicators.js` |
| Optional standalone indicator scripts | e.g. `src/js/core/Wang_design_new_indicators__RandomWalkIndex _2026-01-20.js` (expose on `window` if used from multi-indicator-system) |
| Alignment / zoom behavior | See `docs/INDICATOR-ALIGNMENT-AND-ZOOM.md` |

---

## 8. Optional: External Script for the Formula

You can keep the **formula** in a separate script and only wire it in the multi-indicator system:

1. Implement a function that takes **raw arrays** (e.g. `high`, `low`, `close`) and parameters, and returns raw arrays (e.g. `{ RWI_high, RWI_low }`). Use `NaN` or null for invalid bars.
2. Expose it on `window`, e.g. `window.computeRandomWalkIndex = computeRandomWalkIndex;`
3. In `multi-indicator-system.js`, in your compute wrapper, call that function with `data.map(d => d.close)` etc., then convert NaN to null and return the object your render expects.
4. Load the script before the app (or via your script loader) so `window.computeRandomWalkIndex` exists when the panel is created.

This keeps the math in one place and reuses it from the main indicator registry.

---

## 9. Summary

- **One registry:** all indicators are entries in `createIndicatorDefinitions()` in `multi-indicator-system.js`.
- **Data in, data out:** compute receives `data` (candles) and `params`, returns `{ seriesKey: number[] }` with length matching `data`, using null/NaN where the indicator is not defined.
- **Render with alignment:** create series once via `seriesMap`, then use `this.seriesWithLeadInPadding(array, valueFn)` and `setData` so indicator lines align with candles.
- **New indicator:** add definition → add compute method → add render method → include indicator key in the UI’s indicator list.

For zoom, range sync, and lead-in padding details, see **INDICATOR-ALIGNMENT-AND-ZOOM.md**.
