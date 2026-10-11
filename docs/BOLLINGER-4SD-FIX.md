## Bollinger 4SD – what was wrong and how it’s fixed

This note explains issues in the original **Bollinger Bands / 4SD** implementation in the Wang technical indicators files, and how the fixed version works.

Files involved:

- `src/js/core/technical-indicators.prods__Wang.js`
- `tryout-stock/js/core/technical-indicators.prods__Wang.js`

Both had the same `computeBollingerBands` implementation.

---
111111
### 1. Original problems

1. **Mixed indexing and misaligned arrays**
   - The old code did:
     - `const sma = computeMA(values, period);`
     - Then looped `for (let i = period - 1; i < values.length; i++)` and accessed `sma[i - (period - 1)]`.
   - At the same time, `computeMA` in this file used **1-based style indexing** (`for (let i = 1; i < Ma_day; i++)`, `MA(i) = ...`) which is invalid JavaScript and does not produce a clean, aligned SMA array.
   - Result: `middle`, `upper`, and `lower` could have **different and/or incorrect lengths and indices**, which breaks alignment when plotting bands on the chart.

2. **Bands computed from an inconsistent mean**
   - Because `sma` itself was not reliably aligned with `values`, the code effectively computed:
     - `standardDeviation` around a mean that might **not correspond to the same window** as the values used.
   - For a 4SD band (`stdDev = 4`), this magnifies the problem: bands shift or scale incorrectly, especially on longer histories.

3. **No guard for too-short input**
   - If `values.length < period`, the loop still tried to run, leading to empty or partially filled arrays without a clear, safe return shape.

---

### 2. Fixed implementation

In both Wang technical-indicator files, `computeBollingerBands` is now a **self-contained**, fully 0-based implementation that does not depend on the broken `computeMA`.

Key points of the fix:

```javascript
// Bollinger Bands (supports any stdDev, e.g. 2SD or 4SD)
function computeBollingerBands(values, period = 20, stdDev = 2) {
  if (!Array.isArray(values) || values.length < period) {
    return { upper: [], middle: [], lower: [] };
  }

  const sma = [];
  const upper = [];
  const lower = [];

  // Simple moving average over rolling window
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += values[i - j];
    }
    const mean = sum / period;
    sma.push(mean);

    // Standard deviation over same window
    let variance = 0;
    for (let j = 0; j < period; j++) {
      const diff = values[i - j] - mean;
      variance += diff * diff;
    }
    const standardDeviation = Math.sqrt(variance / period);

    upper.push(mean + stdDev * standardDeviation);
    lower.push(mean - stdDev * standardDeviation);
  }

  return {
    upper,
    middle: sma,
    lower
  };
}
```

**What this fixes:**

- **Correct indexing**: all indices are standard 0-based JavaScript; every SMA point and its standard deviation use the **same rolling window** of `period` closes.
- **Consistent lengths**: `upper`, `middle`, and `lower` are arrays of identical length (`values.length - period + 1`).
- **Safe input handling**: if there are fewer than `period` values, the function returns empty arrays instead of half-initialised bands.

---

### 3. How to get “Bollinger 4SD”

The function now correctly supports **any standard deviation multiplier**. For standard 2SD bands:

```javascript
const { upper, middle, lower } = computeBollingerBands(closes, 20, 2);
```

For **4 standard deviation** bands (Bollinger 4SD):

```javascript
const { upper, middle, lower } = computeBollingerBands(closes, 20, 4);
```

No separate “4SD” function is required; you only change the `stdDev` argument.

When wiring this into the multi-indicator system:

- Use `closes = data.map(d => d.close);`
- Call `computeBollingerBands(closes, period, stdDev);`
- Then feed `upper`, `middle`, `lower` into the render function (e.g. three line series) and use `seriesWithLeadInPadding` to align with the main chart.

