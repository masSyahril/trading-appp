# Bug report: five functions in the Prof. Wang indicator file

**File:** `src/js/core/technical-indicators.prods__Wang__2026.js`
**Date:** 2026-09-12
**Status:** fixes 1-3 (`VolRatio`, `IntradayMomentum`, `EOM_EMV`) were applied to the
file on 2026-09-17, exactly as written below, each marked with a `fix 2026-09-17`
comment; `npm test` no longer shows their three `[WARN]` lines. Fix 4 (`HullMA`) was
applied on 2026-09-19, marked with `fix 2026-09-19` comments (the three weight-sum
loops now use `i<=` instead of `i<`). Fix 5 (`Flexible_KD`, added 2026-09-17 as `Flexible_KDlization`) was applied
the same day as fixes 1-3. Line numbers below are from before the fixes (a line was added
in `VolRatio`, so later lines are one further down). If a new copy of the file
replaces this one, check that it includes these fixes.

## Summary

| Function | Menu name in the app | What goes wrong | Fix |
|---|---|---|---|
| `VolRatio` (line 1150) | VR (Volume Ratio) | the smoothed line **eVolRatio** is blank on every bar | give `eVolRatio[day]` a starting value (1 line) |
| `IntradayMomentum` (line 1330) | IMI (Intraday Momentum) | **IMI1** is blank on every bar; **IMI2** is drawn but wrong (goes below 0) | start `Iup` at 0, and make the two start-up loops include day `day1` / `day2` (3 lines) |
| `EOM_EMV` (line 1758) | EOM (Ease of Movement) | the smoothed line **eEOM_EMV** is blank on every bar | `if(i===1)` → `if(i===2)` (1 line) |
| `HullMA` (line 2836) | HULL_MA (Hull MA), ZeroLagHullMA | values too high - HULL_MA shows about 3 times the price | the three weight sums must include their last weight: `i<` → `i<=` (3 lines) |
| `Flexible_KD`, was `Flexible_KDlization` (line 10703) | Flexible_KD | **the whole file fails to load** (syntax error), so every Prof. Wang indicator disappears | fix the starting values, declare the two arrays, `rsv(i)` → `rsv` (4 lines) |

A blank line is one where every value is `NaN`: one missing starting value makes
the first result `NaN`, and each later value is computed from the previous one,
so `NaN` carries through to the last bar. The chart shows `NaN` as nothing.

These are the only copies of these functions in the project, so the fixes cover
both the stock pages and the crypto-trading page.

---

## 1. `VolRatio` - eVolRatio is blank

**Where:** lines 1158 and 1169

```js
1158  VolRatio[day]=100;       //初值三個均設為第一天的成交量，此時初值VR=100。VR(20)=100
...
1169  eVolRatio[day+1]=(esp-1)/(esp+1)*eVolRatio[day]+2/(esp+1)*VolRatio[day+1];
```

**Cause:** line 1169 uses `eVolRatio[day]`, but nothing ever sets it (only
`VolRatio[day]` gets its starting value of 100). So `eVolRatio[day+1]` is
`NaN`, and so is every value after it.

**Fix:** give eVR the same starting value as VR, as the comment on line 1158 describes:

```js
1158  VolRatio[day]=100;       //初值三個均設為第一天的成交量，此時初值VR=100。VR(20)=100
      eVolRatio[day]=100;      //eVR初值 = VR初值 = 100
```

**Tested** (VR period 26, esp 10):

| | eVolRatio values | VolRatio |
|---|---|---|
| now | 0 of 400 (373 are `NaN`) | - |
| with the fix | 374 of 400, from bar 26, range 60.2 to 227.9 | unchanged |

---

## 2. `IntradayMomentum` - IMI1 is blank, IMI2 is wrong

This function has two separate problems.

### 2a. `Iup` has no starting value (IMI1 blank)

**Where:** line 1333

```js
1333  let Iup, Idn = 0;
```

**Cause:** this sets only `Idn` to 0. `Iup` stays `undefined`, so the first
`Iup=Iup+(...)` gives `NaN` and IMI1 is `NaN` on every bar. (IMI2 doesn't have
this problem, because `Iup=0` and `Idn=0` are set again before the IMI2 part.)

**Fix:**

```js
1333  let Iup = 0, Idn = 0;
```

### 2b. The start-up loops add one day too few (IMI1 and IMI2 go wrong)

**Where:** lines 1334 and 1357

```js
1334  for (let i=1; i<day1; i++) {     //例: i=1 to 10
...
1357  for(let i=1; i<day2; i++) {     //例: let i=1 to 20
```

**Cause:** the comments say "i=1 to 10" and "i=1 to 20", but `i<day1` stops at 9
(and `i<day2` at 19), so day `day1` (day `day2`) is never added. The rolling loops
after them are correct: at each new day they add that day and remove the one
`day1` (`day2`) days earlier. When they later remove the day that was never
added, the running totals `Iup` / `Idn` become wrong. They can even go below 0,
so IMI leaves its 0-100 range.

**Fix:** include the last day, as the comments say:

```js
1334  for (let i=1; i<=day1; i++) {     //例: i=1 to 10
...
1357  for(let i=1; i<=day2; i++) {     //例: let i=1 to 20
```

**Tested** (IMI 10 and 20). As a reference, IMI was also computed directly for every
bar with the function's own formula, ΣUp / (ΣUp + ΣDn) × 100 over the last 10 or
20 days:

| | IMI1 | IMI2 |
|---|---|---|
| now | blank (390 `NaN`) | differs from the reference on 379 of 380 bars (by up to 14.1); 47 values below 0 (lowest -8.5) |
| fix 2a only | 390 values, but 136 outside 0-100 (lowest -30.9), up to 40.2 off the reference | as now |
| fix 2a + 2b | matches the reference on all 390 bars, range 0 to 100 | matches the reference on all 380 bars, range 1.4 to 100 |

So 2a and 2b should be applied together.

---

## 3. `EOM_EMV` - eEOM_EMV is blank

**Where:** lines 1762 and 1775-1778

```js
1762  for(let i=2; i<STK_close.length; i++) {
...
1775    if(i===1){             //指數平滑移動平均
1776      eEOM_EMV[2]=EOM_EMV[2]; }    //eEOM_EMV初值
1777    else {
1778      eEOM_EMV[i]=(esp-1)/(esp+1)*eEOM_EMV[i-1]+2/(esp+1)*EOM_EMV[i];
```

**Cause:** the loop starts at `i=2`, so `i===1` is never true and the starting
value `eEOM_EMV[2]` is never set. At `i=2` the `else` branch uses `eEOM_EMV[1]`,
which is `undefined`, so every value is `NaN`.

**Fix:**

```js
1775    if(i===2){             //指數平滑移動平均
```

**Tested** (esp 9):

| | eEOM_EMV values | EOM_EMV |
|---|---|---|
| now | 0 of 400 (398 are `NaN`) | - |
| with the fix | 398 of 400, from bar 2 | unchanged |

---

## 4. `HullMA` - values about 3 times too high

**Where:** lines 2855, 2872 and 2894 (the function starts at line 2836)

```js
2855  for(let i=1; i<half_day; i++) {   //i=1 to 5 (i=1 to day/2)
...
2872  for(let i=1; i<day; i++) {   //i=1 to 10 (i=1 to day)
...
2894  for(let i=1; i<m; i++) { //i=1 to 4 (i=1 to m)
```

**Cause:** these three loops add up the weights that each weighted average is
divided by. The comments say "i=1 to 5", "i=1 to 10" and "i=1 to 4" (totals 15,
55 and 10), but `i<n` stops one step early, so the totals come out as 10, 45 and
6. The weighted sums themselves use every weight, so each average is divided by
too small a number: WMA1 comes out 1.5 times too big, WMA2 1.22 times and the
final smoothing 1.67 times - in the end about 2.9 times the price.

**Fix:** include the last weight in all three loops, as the comments say:

```js
2855  for(let i=1; i<=half_day; i++) {   //i=1 to 5 (i=1 to day/2)
2872  for(let i=1; i<=day; i++) {   //i=1 to 10 (i=1 to day)
2894  for(let i=1; i<=m; i++) { //i=1 to 4 (i=1 to m)
```

**Tested** (HullMA 10, esp 9; last close 114.09). As a reference, the Hull MA was
computed directly with the formula the comments describe, WMA(2·WMA(day/2) −
WMA(day), m) with m = ceil(√day) = 4:

| | last value | largest difference from the reference |
|---|---|---|
| now | 334.43 | 258.3 |
| with the fix | 112.76 | 1.9 |
| `computeHullMA` in `Wang_design__HullMA _2026-01-18.js` | 112.48 | 0.7 |

**In the app today:** the Hull MA line on the price chart uses `computeHullMA`
from the separate `Wang_design__HullMA _2026-01-18.js` file, so it is right. The
**HULL_MA (Hull MA)** pane indicator calls this `HullMA`, so it currently shows
values about three times the price. **ZeroLagHullMA** uses it too, so its lines
are also too high: with the default inputs its ZeroLagHMA line is about 3 times
the price, and its HMA and eHMA lines about 1.3 times.

---

## 5. `Flexible_KD` (was `Flexible_KDlization`) - syntax error stops the whole file (fixed 2026-09-17)

This function was added on 2026-09-17 and had three problems that stop it from
running. The first one also stops the browser from loading **any** of the file,
so every Prof. Wang indicator on every page disappeared until it was fixed.

| Line | Was | Problem | Now |
|---|---|---|---|
| 10716-10717 | `Flexible_KD_K=[KD_day-1]=50;` (and `_D`) | syntax error ("Invalid destructuring assignment target") | `Flexible_KD_K[KD_day-1]=50;` |
| 10713 | `Flexible_KD_K=[];  Flexible_KD_D=[];` | no `const`, so they become global variables | `const Flexible_KD_K=[], Flexible_KD_D=[];` |
| 10730 | `(1-alpha)*rsv(i)` | `rsv` is a number, so this throws "rsv is not a function" | `(1-alpha)*rsv` |

**Not changed, for Prof. Wang to decide:**

- `TP = (H+L+4*C)/4` - the other functions use `/6`. For a KD this makes no
  difference (the min-max scaling cancels it; tested: the largest difference is
  8e-13), but the comment calls it the Typical Price.
- When the 9-day high equals the low, `rsv = 100`; the other KD functions use 50.
- `alpha` and `beta` are taken as whole numbers 1-9 and divided by 10, while the
  Menu Name comment says `0.1<=alpha, beta<=0.9`. The app labels them
  "alpha (1-9 = 0.1-0.9)" and defaults both to 7 (closest to the classic 2/3).

**Tested** (KD_day 9, alpha 7, beta 7): K and D have values from bar 8 on, all
between 0 and 100, and match a direct calculation of the same formula.

---

## Also checked

- `let maxHigh, minLow=0;` (lines 524, 698, 752 and 837, in the KD functions) looks
  like the same mistake but is fine: both variables are set at the start of every
  loop pass, before they are used.
- The app's test (`npm test`) runs every Prof. Wang function the app draws on 400
  test candles. These three lines are the only ones with no values; after the fixes
  its three `[WARN]` lines disappear.

## How the tests were run

All numbers above come from 400 generated daily candles, the same data `npm test`
uses. Each function was run twice: once as it is in the file, and once as an
in-memory copy of its own source with only the lines above changed. The file
itself was not modified. The app needs no changes: the three lines are already
set up in its indicator definitions and will be drawn once the functions return
values.
