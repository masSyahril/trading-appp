# Bug report: twenty-three functions in the Prof. Wang indicator file

**File:** `src/js/core/technical-indicators.prods__Wang__2026.js`
**Date:** 2026-09-12
**Status:** fixes 1-3 (`VolRatio`, `IntradayMomentum`, `EOM_EMV`) were applied to the
file on 2026-09-17, exactly as written below, each marked with a `fix 2026-09-17`
comment; `npm test` no longer shows their three `[WARN]` lines. Fix 4 (`HullMA`) was
applied on 2026-09-19, marked with `fix 2026-09-19` comments (the three weight-sum
loops now use `i<=` instead of `i<`). Fix 5 (`Flexible_KD`, added 2026-09-17 as `Flexible_KDlization`) was applied
the same day as fixes 1-3. Fix 6 (the 2026-09-18/19 batch: `HighLowOsc_KDlization`,
`VariantRateMA_TwoDaysAgo_KD`, `VariantRateMA_ThreeDaysAgo_KD`, and
`VariantRateEMA_TwoDaysAgo_KD` and `VariantRateEMA_ThreeDaysAgo_KD` added later
the same day) was applied on
2026-09-19, marked with `fix 2026-09-19` comments. Fix 7 (`VertHoriFilter`, registered
on 2026-09-19) was applied the same day. Fix 8 (the 2026-09-19/20/22/25 batch of nine
functions) was applied on 2026-09-26, marked with `fix 2026-09-26` comments.

**Please read section 5a first.** On 2026-09-26 the `Flexible_KD` syntax error of
section 5 was back in the file, so nothing in it loaded at all.

Line numbers below are from before the fixes (a line was added
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
| `HighLowOsc_KDlization` (line 10832) | HighLowOsc(HLO)_KD | throws on every call, so the indicator never draws | `const TR` → `let TR`; `min` used `Math.max` (2 lines) |
| `VariantRateMA_TwoDaysAgo_KD` (line 10878) | VariRtMA_TwoDaysAgo_KD | throws on every call, so the indicator never draws | loop reads `STK_high.length`, which this function never receives → `STK_close.length`; `min` used `Math.max` (2 lines) |
| `VariantRateMA_ThreeDaysAgo_KD` (line 10922) | VariRtMA_ThreeDaysAgo_KD | throws on every call, so the indicator never draws | same two fixes (2 lines) |
| `VariantRateEMA_TwoDaysAgo_KD` (line 10966) | VariRtEMA_TwoDaysAgo_KD | both lines sit flat at exactly 50 on every bar | `min` used `Math.max` (1 line) |
| `VariantRateEMA_ThreeDaysAgo_KD` (line 11021) | VariRtEMA_ThreeDaysAgo_KD | both lines sit flat at exactly 50 on every bar | `min` used `Math.max` (1 line) |
| `VertHoriFilter` (line 1113) | VHF2 (Vertical Horizontal Filter) | **VHF** is drawn on every second bar only; **eVHF** is blank on every bar | `for(j=i++; ...)` → `for(let j=i; ...)` (1 line) |
| `VariantRateMA_OneDayAgo_KD` (line 11073) | VariRtMA_OneDayAgo_KD | throws on every call, so the indicator never draws | `STK_high.length` → `STK_close.length`; starting value sat on the loop’s own first bar; `min` used `Math.max` (3 lines) |
| `VariantRateEMA_OneDayAgo_KD` (11117) | VariRtEMA_OneDayAgo_KD | both lines sit flat at exactly 50 on every bar | `min` used `Math.max` (1 line) |
| `VariantRateEMA_FourDaysAgo_KD` (11204) | VariRtEMA_FourDaysAgo_KD | both lines sit flat at exactly 50 on every bar | `min` used `Math.max` (1 line) |
| `VariantRateEMA_ThreeDaysAgo_KD_double` (11265) | VariRtEMA_ThreeDaysAgo_KD_dbl | both lines sit flat at exactly 50 on every bar | `min` used `Math.max` (1 line) |
| `VariantRateEMA_TwoDaysAgo_KD_double` (11327) | VariRtEMA_TwoDaysAgo_KD_dbl | both lines sit flat at exactly 50 on every bar | `min` used `Math.max` (1 line) |
| `VariantRateEMA_OneDayAgo_KD_double` (11389) | VariRtEMA_OneDayAgo_KD_dbl | both lines sit flat at exactly 50 on every bar | `min` used `Math.max` (1 line) |
| `VariantRateEMA_FourDaysAgo_KD_double` (11450) | VariRtEMA_FourDaysAgo_KD_dbl | both lines sit flat at exactly 50 on every bar | `min` used `Math.max` (1 line) |
| `HullMA_KD` (11564) | HullMA_KD | both lines flat at 50; and blank on every bar for `day` 18 or more | `min` used `Math.max`; `start=day+3` → `start=day+m-1` (2 lines) |
| `KST_Stochastic` (11763) | KST_Stochastic | throws on every call, so the indicator never draws | `STK_high.length` → `STK_close.length`; `min` used `Math.max`; `max_day` missing `let` (3 lines) |
| `Acceleration_Stochastic` (11864) | Acceleration(ACC)Stochastic | throws on every call, so the indicator never draws | `STK_high.length` → `STK_close.length`; `min` used `Math.max` (2 lines) |
| `Flexible_KD` (10703) | Flexible_KD | `alpha` and `beta` do nothing - every setting gives the same line | the clamp was 10-90 and the divisor 100; should be 1-9 and 10 (4 lines) |
| `BollingerBands` (12151) | Bollinger Bands 4SD | the middle band is a constant 9.889 too low on every bar | the first MA adds 9 closes and divides by 10: `i<MA_day` -> `i<=MA_day` (1 line) |
| `HullMA` (2836), as drawn | HULL_MA (Hull MA) | only `HMA` was drawn, and through a different function; `eHMA` was not drawn at all | draw both, from Prof. Wang’s `HullMA`, on the K-Line (app-side change) |

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

## 5a. The `Flexible_KD` syntax error came back (2026-09-26)

On 2026-09-26 line 10715 read:

```js
Flexible_KD_K=[KD_day-1]=50;   // and the same for _D on 10716
```

This is the exact syntax error of section 5, which was fixed on 2026-09-17. A
syntax error anywhere in this file stops the **whole file** from loading, so on
that day **all 109 Prof. Wang pane indicators disappeared from the app**, along with
the price-chart overlays that call into this file - not just `Flexible_KD`. The other three fixes from section 5 were still in place,
so it looks like these two lines were re-typed rather than the file being replaced
wholesale.

It is corrected again to `Flexible_KD_K[KD_day-1]=50;`, marked `fix 2026-09-26`.

**Worth agreeing on a habit:** running `node --check` on the file (or just
`npm test`) after editing it catches this in one second, before it reaches the
app. A syntax error is the one class of mistake here that costs everything at once.

---

## 6. The 2026-09-18/19 batch - five broken functions (fixed 2026-09-19)

These three were added on 2026-09-18/19. None of them could run: each threw on
the first call, so the indicator drew nothing at all. Each also computed its
window minimum with `Math.max`, which is a silent bug - `min` would end up equal
to `max`, the `max === min` guard would fire on every bar and the KD lines would
sit flat at 50.

### 6a. `HighLowOsc_KDlization` (line 10832)

```js
10835  const TR=0;     //True Range, TR
...
10839    TR=Math.max(...);          // TypeError: Assignment to constant variable
10855    max=Math.max(max, HLO[j]);  min=Math.max(min, HLO[j]);   // min uses Math.max
```

**Fix:** `let TR=0;` and `min=Math.min(min, HLO[j]);`

### 6b/6c. `VariantRateMA_TwoDaysAgo_KD` (10878), `VariantRateMA_ThreeDaysAgo_KD` (10922)

Both take `(STK_close, MA_day, KD_num)` - there is no `STK_high` in them - but
their main loop ends at `STK_high.length`:

```js
10894  for(let i=KD_num+MA_day+1; i<=STK_high.length; i++) {   // ReferenceError: STK_high is not defined
10899    min=Math.max(min, VarRtMA_TwoDaysAgo[j]);             // min uses Math.max
```

**Fix:** `STK_close.length`, and `min=Math.min(...)` in both functions.

**Tested** (esp 9, KD_num 9, MA_day 5), after the fixes: all three return values
on every bar from their documented start bar, all within 0-100.

| Function | Before | After |
|---|---|---|
| `HighLowOsc_KDlization` | throws (TypeError) | K and D from bar 9, 8.5 to 91.3 |
| `VariantRateMA_TwoDaysAgo_KD` | throws (ReferenceError) | K and D from bar 14, 0.2 to 99.8 |
| `VariantRateMA_ThreeDaysAgo_KD` | throws (ReferenceError) | K and D from bar 15, 0.0 to 99.9 |

### 6d/6e. `VariantRateEMA_TwoDaysAgo_KD` (10966), `VariantRateEMA_ThreeDaysAgo_KD` (11021)

Added later on 2026-09-19. These two run, but carry the same `min` typo, and on
its own that is enough to make an indicator useless:

```js
10996      max=Math.max(max, VarRtEMA_TwoDaysAgo[j]);
10997      min=Math.max(min, VarRtEMA_TwoDaysAgo[j]);   // min uses Math.max
```

With `min` computed as a maximum, `min` always ends up equal to `max`, so the
`if(max===min) { RSV=50; }` guard fires on every bar and K and D come out as
exactly 50.00 on every bar. `VariantRateEMA_ThreeDaysAgo_KD` has the identical
line (11052) over `VarRtEMA_ThreeDaysAgo[j]`.

| Function | Before | After |
|---|---|---|
| `VariantRateEMA_TwoDaysAgo_KD` | 50.00 on all 190 test bars (1 distinct value) | 190 distinct values, 0.2 to 99.96, from bar 10 |
| `VariantRateEMA_ThreeDaysAgo_KD` | 50.00 on all 189 test bars (1 distinct value) | 189 distinct values, 0.4 to 100.0, from bar 11 |

**Fix:** use `Math.min` for `min` in both functions.

### Where this keeps coming from

The commented-out shortcut inside `DEMA_KDlization` (line 10809) carried the
same mistake, so every function copied from it inherited it. That comment now
reads `min=Math.min(...)`, to stop the next copy repeating it.

`DEMA2` and `DEMA_KDlization` themselves, added the same day, had no problems.

---

## 7. `VertHoriFilter` - VHF skips every second bar, eVHF is blank (fixed 2026-09-19)

Registered on 2026-09-19 as **VHF2 (Vertical Horizontal Filter)**. One line in the
inner loop causes both problems:

```js
for(j=i++; j<=(i+VHF_day-1); j++) {   // line 1122
```

`i++` is the outer loop counter. Reading it here increments it a second time, on
top of the `i++` the `for` statement already does, and that has two separate
effects:

1. **VHF gets holes.** The outer loop now advances by 2, so it writes
   `VHF[20]`, `VHF[22]`, `VHF[24]` ... and every odd bar is left empty. Half the
   chart is missing. (The window it measures is also one day too long: the
   condition `j<=(i+VHF_day-1)` reads the already-incremented `i`, so it covers
   `VHF_day+1` days instead of `VHF_day`.)
2. **eVHF is blank.** `i` is 2 by the time `if (i>1)` is reached on the very
   first pass, so the guard that is meant to keep the first `eVHF` as its seed
   value fires immediately. It reads `eVHF[i+VHF_day-2]`, which is one of the
   holes from (1) - `undefined` - so the first value becomes `NaN`, and every
   later value is computed from the one before it, so all of them are `NaN`.

**Fix:** `for(let j=i; j<=(i+VHF_day-1); j++) {`

`max_close`, `min_close` and `j` were also missing `let`, which made them global
variables shared with anything else on the page; they now have it.

| | VHF | eVHF |
|---|---|---|
| now | 90 of 200 test bars, 89 holes between them | blank (all `NaN`) |
| with the fix | 180 of 200, no holes, 0.29 to 0.98 | 180 of 200, no holes, 0.43 to 0.95 |

The app already had a one-line `VHF (Vertical Horizontal Filter)` of its own
(`computeVHF` in `technical-indicators-wang.js`), computing the same ratio. It is
still there as a separate menu entry; Prof. Wang's version is listed as **VHF2**
and adds the smoothed `eVHF` line.

---

## 8. The 2026-09-19/20/22/25 batch - nine broken functions (fixed 2026-09-26)

Thirteen functions were added between 2026-09-19 and 2026-09-25. Nine had problems;
four (`VariantRateEMA_FourDaysAgo`, `KD_double`, `UOSC1`, `UOSC2`) were correct as
written.

### 8a. `min` used `Math.max` - seven more functions

```js
min=Math.max(min, X[j]);   // should be Math.min
```

`min` then always ends up equal to `max`, the `if(max===min) { RSV=50; }` guard
fires on every bar, and **K and D come out as exactly 50.00 on every bar**. The
indicator looks like it works - two lines are drawn - but they are a flat line at
50 and carry no information.

| Function | Before | After |
|---|---|---|
| `VariantRateEMA_OneDayAgo_KD` | 50.00 on all 191 test bars | 0.4 to 99.8, from bar 9 |
| `VariantRateEMA_FourDaysAgo_KD` | 50.00 on all 188 test bars | 0.1 to 100.0, from bar 12 |
| `VariantRateEMA_OneDayAgo_KD_double` | 50.00 on all 191 test bars | 23.9 to 78.9, from bar 9 |
| `VariantRateEMA_TwoDaysAgo_KD_double` | 50.00 on all 190 test bars | 20.8 to 80.1, from bar 10 |
| `VariantRateEMA_ThreeDaysAgo_KD_double` | 50.00 on all 189 test bars | 18.9 to 81.7, from bar 11 |
| `VariantRateEMA_FourDaysAgo_KD_double` | 50.00 on all 188 test bars | 18.2 to 82.8, from bar 12 |
| `HullMA_KD` | 50.00 on all 180 test bars | 0.0 to 100.0, from bar 20 |

That makes **twelve functions** carrying this one typo over eight days. It is by far
the most expensive mistake in the file, because nothing about it looks wrong: no
error, no blank line, two lines drawn on the chart. The only way to catch it is to
notice that the values never move.

### 8b. `STK_high` in functions that do not receive it - two functions

```js
function VariantRateMA_OneDayAgo_KD(STK_close, MA_day, KD_num) {   // no STK_high
  for(let i=KD_num+MA_day; i<=STK_high.length; i++) {              // ReferenceError
```

Same in `KST_Stochastic(STK_close, day1, day2, day3, day4, esp, KD_num)`. Both threw
`ReferenceError: STK_high is not defined` on every call, so neither drew at all.
Both now read `STK_close.length`. This is the same mistake as sections 6b/6c.

### 8c. `VariantRateMA_OneDayAgo_KD` - the starting value is overwritten

```js
VarRtMA_OneDayAgo_KD_K[KD_num+MA_day]=50;      // [14]
for(let i=KD_num+MA_day; i<=...; i++) {        // also starts at [14]
```

The loop’s first pass recomputes the same bar the starting value was just written
to, from `K[i-1]` = `K[13]`, which was never set - so the starting value is
destroyed and every later value is `NaN`. The function’s own comments say
初值[13]=50 and `first turn=[14]`, so the seed index should be one lower:
`[KD_num+MA_day-1]`. Its sibling `VariantRateMA_TwoDaysAgo_KD` already does this
correctly (seed `[KD_num+MA_day]`, loop from `KD_num+MA_day+1`).

### 8d. `HullMA_KD` - blank for any `day` of 18 or more

```js
let start=day+3;   //開始算HMA_KD[]的時間點, if day=10 then start=13
```

`HMA[]` actually starts at `day+m-1`, where `m=Math.ceil(Math.sqrt(day))`. For `day`
10 to 16 `m` is 4, so `day+3` happens to be right. From `day`=18 up `m` is 5 or
more, `start` points at a bar where `HMA[]` does not exist yet, and every value
comes out `NaN`:

| `day` | Before | After |
|---|---|---|
| 10 (default) | worked, once 8a was fixed | unchanged |
| 20 | 1 value out of 200 bars, the rest blank | 169 values, 0.0 to 100.0, from bar 31 |

**Fix:** `let start=day+m-1;` - which gives the same 13 for `day`=10, so the
documented example is unaffected.

### 8e. Two smaller things

- `KST_Stochastic` sets `max_day` without `let`, making it a global shared with five
  other functions in the file. Each sets it before use, so it is not causing a bug
  today; `let` was added anyway.
- **`HullMA_KD` never uses `esp`.** It is argument 3, and the only line that reads it
  is `eHMA[i]=...`, but `eHMA` is not returned - the K/D smoothing uses `alpha`. So
  turning the `esp` knob in the app does nothing. Two ways to read this, and it is
  your call which you want:
  1. it is deliberate, and `esp` is only there to keep the argument list the same as
     the other functions - in which case nothing needs changing (the app now labels
     it "esp (unused)" so it is not mistaken for a live control); or
  2. `HMA[]` and `eHMA[]` were meant to be returned as well - which is what the
     function’s last comment says ("Normally drawing the HMA[], eHMA[] figures in
     the K-Line area"), and would also make `esp` matter.

  Nothing was changed here, since either answer is a design decision, not a bug.

### Where the K-Line / small-window note matters

Every function in this batch says "drawing these figures in the small windows", and
all thirteen were registered as panes. `HullMA_KD` is the one to watch: its last
comment says *"Normally drawing the HMA[], eHMA[] figures in the K-Line area"*, but
that sentence is left over from the original `HullMA` (the code above it is marked
上述是HullMA的完整程式，此處不修改). `HullMA_KD` returns only `HMA_KD_K` and
`HMA_KD_D`, which are 0-100 stochastic values - on the price chart they would be
pinned to the bottom of the axis. It is registered as a pane.

---

## 9. Prof. Wang’s handwritten review notes (2026-09-26)

Seven numbered notes. Items 1-5 are done and verified; 6 and 7 could not be read
from the photo and are still open.

### 9a. Notes 1, 2, 3 - HullMA must draw HMA **and** eHMA on the K-Line

All three notes say the same thing: Prof. Wang’s `HullMA` should output and draw
both `HMA[]` and `eHMA[]` in the K-Line area. His own comment agrees:

```
//Normally drawing the STK_close[], HMA[], eHMA[] figures in the K-Line area.
```

The app was doing neither half of that properly. `HullMA` sat in the single-line
overlay table, so it drew **one** line, and the function it called was
`computeHullMA()` from `Wang_design__HullMA _2026-01-18.js` - not Prof. Wang’s
`HullMA`, which is the one that returns `eHMA`.

It is now its own two-line price-chart entry calling `HullMA(close, day, esp)`,
drawing `HMA` in amber and `eHMA` in blue, with `esp` exposed as "Smoothing".

**On the alignment:** the old entry used `shift 1`. Prof. Wang’s `HullMA` also
returns `values` - the close array it was handed - which makes the right shift
checkable rather than a guess:

| shift | returned `values` vs the real close | most recent bar |
|---|---|---|
| 0 | matches on all 200 test bars | drawn |
| 1 | differs on all 199 | **blank** |

So `shift 0` it is. At `shift 1` the newest bar of the chart was always empty -
the same mismatch found in `DoubleEMA` on 2026-09-26. `KAMA` is the last entry
still on `shift 1` and has not been checked.

Verified after the change: `HMA` and `eHMA` both run to the last bar with no gaps,
the peak of `HMA` is 1.001x the peak of the close (it tracks the price, rather than
the ~3x of section 4), and `esp` moves `eHMA` without touching `HMA`.

### 9b. Note 4 - `Flexible_KD`: alpha and beta did nothing

```js
// Menu Name: FlexibleKD(TP)  //KD_day=9,10,... input: 10<=alpha,beta<=90
if(alpha > 90) { alpha = 90; } else if(alpha < 10) { alpha = 10; }
alpha = alpha/100;   //0.10<=alpha<=0.90
```

The app used to offer `alpha` and `beta` as 1-9. The function clamped anything below 10
up to 10, so **every value the app could send produced the identical result** -
alpha was always 0.10 and both knobs were dead:

Where the two ranges disagreed, every app value collapsed to the same output:

| alpha=beta (old 1-9 scale) | last K before | last K after |
|---|---|---|
| 1 | 92.2282 | 92.2282 |
| 3 | 92.2282 | 93.4401 |
| 5 | 92.2282 | 94.8554 |
| 7 | 92.2282 | 96.4695 |
| 9 | 92.2282 | 90.9324 |

**Settled 2026-09-26:** the function keeps its original form - it clamps to
**10-90** and divides by 100 - and the app now sends whole numbers in that range.

```js
if(alpha > 90) { alpha = 90; } else if(alpha < 10) { alpha = 10; }
alpha = alpha/100;   //0.10<=alpha<=0.90
```

| | what the app sends | what reaches the maths |
|---|---|---|
| the bug | 1-9 | every value clamped up to 10, so always 0.10 - both knobs dead |
| now | 10-90, whole numbers, default 70 | 0.10 to 0.90 |

The row is deliberately **not** marked fractional, so a typed 70.4 is rounded to
70 before it reaches the function - the professor’s clamp expects whole numbers.
The default of 70 gives 0.70.

### 9b-note. The same syntax error, a third time

Reverting `Flexible_KD` to its original form on 2026-09-26 also brought back the
`Flexible_KD_K=[KD_day-1]=50;` syntax error of sections 5 and 5a. That is now the
**third** time this one line has reappeared, and each time it stops the *whole*
file from loading - all 109 Prof. Wang pane indicators plus the price-chart
overlays vanish from the app, not just `Flexible_KD`.

The correct line is `Flexible_KD_K[KD_day-1]=50;` - square brackets on the array,
not `=[...]=`.

It is worth guarding rather than re-fixing: `node --check
src/js/core/technical-indicators.prods__Wang__2026.js` takes under a second and
catches exactly this, and `npm test` catches it too. A syntax error is the one
mistake in this file that costs everything at once.
### 9c. Note 5 - UOSC1 and UOSC2 on separate charts

Already the case, and the same for OSC1/OSC2: four separate pane entries, one line
each. They are split because one is a price difference and the other a ratio near
1.0, which a shared axis flattens. The older combined `UOSC (Ultimate Oscillator)`
entry still draws both on one axis - worth deciding whether to retire it.

### 9d. Notes 6 and 7 - not yet actioned

The photo is upside down and these two lines could not be read with enough
confidence to act on. Both appear to end in 沒有. Note 7 appears to concern
`Vol Ratio`; for the record, that indicator is wired up and working - the app’s
`VR (Volume Ratio)` entry calls Prof. Wang’s `VolRatio()` and draws both
`VolRatio` and `eVolRatio` (the latter was fixed in section 1).

---

## 10. Every "drawing ... in the K_Line area" comment, checked (2026-09-26)

**48 functions** in the file carry a comment saying they are drawn in the K-Line
area. (An earlier pass of this section said 21 - that search required the word
"normally" and missed every comment that just says "drawing ... in the K_Line
area". 48 is the real number.)

Each was checked against where the app actually draws it. Rather than matching
names, every exported Wang function was wrapped in a recorder and every registry
entry was then evaluated, so the mapping from function to indicator is what the
code really does, including the ones reached through a `compute*` wrapper.

**16 were in a small window when the comment says the price chart, and were moved.**

### 10a. What decides it

The comment alone is not enough - several of these functions say "K_Line area" but
return oscillator values, which would be pinned flat against a price axis. So each
output was measured against the close on 300-400 test bars. A line goes on the
price chart when its values sit in the price’s own range; otherwise it stays in a
pane.

### 10b. Moved to the K-Line (16)

| Indicator | Lines now on the price chart |
|---|---|
| `Alligator` | Lips, Teeth, Jaw |
| `GannHiLo` | MA_High_Low |
| `VariantMA` | VariantMA, eVariantMA |
| `CDP` | AH, NH, CDP, NL, AL, Support, Pressure |
| `KeltnerChannels` | upperEMA, middleEMA, lowerEMA |
| `ZeroLagHullMA` | ZeroLagHMA, HMA, eHMA |
| `Gaussian` | GaussianMA, eGaussianMA |
| `MA_Envelope` | EMA, Upper, Lower |
| `RainbowMA` | MA1-MA5, RMA |
| `LinearReg` | LRI, upper, lower |
| `LinearRegTP` | LRI, upper, lower |
| `AdaptiveLaguerre` | ALF |
| `HighLowBands` | TEMA, HighBand, LowBand |
| `StollerBands` | STARC_EMA, upper, lower |
| `MAone + MAtwo` | MA1, MA2 |
| `Bollinger Bands 4SD` | upperBand, MA, lowerBand |

Price-chart entries went from 29 to 45.

### 10c. The duplicate close line

Four of these also return the close itself - `GannHiLo` (`K_Close`), `VariantMA`
(`values`), `KeltnerChannels` (`withClose`) and `MAone_MAtwo` (`line3`, titled
"Close"). That is right in a pane, where there is nothing else to compare against,
but on the price chart the candles already are the close. Prof. Wang’s comments
name only the other lines, so the close line is dropped on the price chart and kept
on the crypto page, which still draws everything in a panel. `MAone_MAtwo` is
renamed from "MAone + MAtwo + Close" to "MAone + MAtwo" to match.

### 10d. Left as panes on purpose (6)

| Indicator | Range on the test data | Why it stays |
|---|---|---|
| `VolRatio` (VR) | 40-266 | a percentage, not a price. It only looks price-like because the test series sits near 100; on a $5 or $500 stock it would be far off the axis. Its own comment contradicts itself - the line above says "drawing ... in the small windows" |
| `TDI` | -7 to 122 | RSI-based |
| `HullMA_KD (K, D)` | 0-100 | stochastic. The `HullMA_KD` name itself now draws HMA/eHMA on the K-Line - see 10g |
| `MASS` | 4.2-6.2 | the Mass Index is a small unitless number |
| `RainbowOscillator` | -8.6 to 7.7 | swings about zero. Its price-scale companion `RainbowMA` did move |
| `MAoneMAtwo with RR` | mixed | MA1/MA2 are price, but it also draws a cumulative-RR step line and a trade-RR histogram on a **second scale**, which a price axis cannot hold. Its price-only half is the separate `MAone + MAtwo`, which moved |

### 10e. A blank last bar found on the way: `Alligator`

Moving `Alligator` next to the candles made an existing bug obvious - all three
lines stopped one bar short of the chart edge.

```js
// computeAlligatorIndicator(), multi-indicator-system.js
for (let i = 3; i < len; i++) {
  const w1 = srcLip[i + 1];        // for the newest bar this reads srcLip[len]
```

`Alligator()` fills `Lip_emp[4..len-1]`, so index `len` is never written and the
most recent bar of all three lines was always empty. Like the rest of this file,
`out[i]` belongs to bar `i` - no shift. The three loops now read `src[i]` and start
at 4, 6 and 9, matching the first indices Prof. Wang’s comment gives.

This is the third instance of the same `+1` mismatch, after `DoubleEMA` and
`HullMA`. `KAMA` is the last entry still on shift 1 and has not been checked.

### 10f. `BollingerBands` - the middle band was wrong on every bar

Found while checking whether `Bollinger Bands 4SD` was safe to put next to the
candles: its MA sat about 10 points **below** the close on a series whose own low
was higher than that - impossible for a moving average of those closes.

```js
for(let i=1; i<MA_day; i++) {   //i=1 to 10
  sum=sum+K_close[i];
}
MA[MA_day]=sum/MA_day;          //first MA[10]=sum/10
```

The comment says "i=1 to 10", but `i<MA_day` stops at 9, so the first MA adds **9**
closes and divides by **10**. Everything after it is a rolling update
(`sum = sum - K_close[i-MA_day] + K_close[i]`), so that starting error never washes
out - it is carried, unchanged, to the last bar.

| | middle band vs a plain 10-period SMA |
|---|---|
| before | exactly 9.889 too low on every single bar (300 of 300) |
| after | matches to 0.000 on every bar |

**Fix:** `for(let i=1; i<=MA_day; i++)`. Same `i<` / `i<=` mistake as `HullMA` in
section 4.

Two further things in the same function, neither of them active today:

- the last line of the main loop computes `Bandwith[i]` from `MA[tp]` - the fixed
  first index - instead of `MA[i]`. `Bandwith` is not in the `return`, so nothing
  draws it yet, but it would be wrong if it were uncommented.
- the `return` sends back only `upperBand, MA, lowerBand`. The commented-out line
  below it would also return `percentB` and `Bandwith`, which the function’s last
  comment says belong in a small window.

### 10g. `HullMA_KD` - split into a chart half and a pane half (2026-09-26)

Its comment says *"Normally drawing the HMA[], eHMA[] figures in the K-Line area"*,
and it does compute both - but it returned only `HMA_KD_K` and `HMA_KD_D`, so
nothing outside the function could draw them. Section 9a first put this down to a
leftover comment. That was wrong: the comment is right, the `return` was short.

```js
return { HMA_KD_K, HMA_KD_D };            // before
return { HMA_KD_K, HMA_KD_D, HMA, eHMA }; // after - two extra keys, nothing else changed
```

Adding keys cannot break an existing caller, since they all destructure the two
they want.

It is now two entries, the same shape **and the same naming order** as
`BollingerBandsNew`: the plain name is the price-chart half, the suffixed one is
the pane.

| Entry | id | Where | Lines |
|---|---|---|---|
| `HullMA_KD` | `HullMA_KD` | **K-Line (main chart)** | HMA, eHMA - price-scale |
| `HullMA_KD (K, D)` | `HullMA_KD_KD` | small window | HMA_KD_K, HMA_KD_D - 0 to 100 |

Picking `HullMA_KD` from the menu now draws on the main chart, which is what the
comment asks for. The K/D half has to stay in a pane: against a price axis, 0-100
values would sit as a flat line along the bottom. `KD_num` and `alpha` only affect
K/D, so the chart entry does not offer them, and `esp` only affects `eHMA`, so it
does nothing for the K/D pane.

**Saved selections:** anything stored under the id `HullMA_KD` now resolves to the
chart entry rather than the pane. That is the intended behaviour here, but it is a
change for anyone who had the old pane version saved - they would re-add it as
`HullMA_KD (K, D)`.

One thing worth knowing: for the same `day` and `esp`, the HMA and eHMA from
`HullMA_KD` are **identical to the plain `HullMA` entry** - checked bar by bar, 387
of 387 equal - because `HullMA_KD` embeds the same Hull calculation. So the chart
entry draws the same two lines `HullMA` already does. That is inherent to how the
function is written, not a mistake, but if you would rather not have the pair
listed twice, the chart half can be dropped and `HullMA` used instead.

---
### 10h. How the table records this

`defs/wang.js` rows take two new optional fields, documented at the top of that
file: `placement: 'chart'`, and `chartOmit` for lines to leave out when drawn on
the price chart. The crypto page ignores both, so the two copies of the table stay
identical. Entries in `defs/trend.js` and `defs/oscillators.js` just pass
`placement: 'chart'` to their `add()` helper, which already allowed it.

### 10i. Four functions no registry entry reaches

`KingEMA`, `MAone`, `computeMA` and `computeWangEMA` carry a K-Line comment but no
indicator in the app calls them - they are helpers used by other functions, or
superseded. Nothing to draw.

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
