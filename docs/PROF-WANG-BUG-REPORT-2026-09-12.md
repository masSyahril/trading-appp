# Bug report: three functions in the Prof. Wang indicator file

**File:** `src/js/core/technical-indicators.prods__Wang__2026.js`
**Date:** 2026-09-12
**Status:** reported, not changed. The file has not been edited; every fix below was
tested on in-memory copies of the functions.

## Summary

| Function | Menu name in the app | What goes wrong | Fix |
|---|---|---|---|
| `VolRatio` (line 1150) | VR (Volume Ratio) | the smoothed line **eVolRatio** is blank on every bar | give `eVolRatio[day]` a starting value (1 line) |
| `IntradayMomentum` (line 1330) | IMI (Intraday Momentum) | **IMI1** is blank on every bar; **IMI2** is drawn but wrong (goes below 0) | start `Iup` at 0, and make the two start-up loops include day `day1` / `day2` (3 lines) |
| `EOM_EMV` (line 1758) | EOM (Ease of Movement) | the smoothed line **eEOM_EMV** is blank on every bar | `if(i===1)` → `if(i===2)` (1 line) |

A blank line is one where every value is `NaN`: one missing starting value makes
the first result `NaN`, and each later value is computed from the previous one,
so `NaN` carries through to the last bar. The chart shows `NaN` as nothing.

These are the only copies of the three functions in the project, so the fixes
cover both the stock pages and the crypto-trading page.

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
