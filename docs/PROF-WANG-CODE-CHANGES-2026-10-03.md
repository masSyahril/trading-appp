# Changes made to `technical-indicators.prods__Wang__2026.js`

**File:** `src/js/core/technical-indicators.prods__Wang__2026.js`
**Period covered:** 2026-09-17 → 2026-10-03
**Edit sites:** 70, across 33 functions
**Formula changes:** none
**Scope note:** two further passes on 2026-10-03 added 27 more `fix 2026-10-03` sites, in
functions this document does not cover: `MoneyFlowIndex`, `PositiveVolIndex`,
`NegativeVolIndex`, `ARBR`, `CR`, `BBI3`/`BBI4`/`BBI5`, `UOSC`, `WilliamR`, `CCI`,
`AccuDistOSC`, `VolumeMA`, `WilliamVolConDiv`, `VolWgtAvgPrice`, `KingEMA`, plus one more
each in `BollingerBands` and `MoneyFlowIndex_Stochastic`. Those 27 are written up as
sections 12 and 14 of `PROF-WANG-BUG-REPORT-2026-09-12.md`. **This document describes only
the 70 sites listed here.**

This is the code-level companion to `PROF-WANG-BUG-REPORT-2026-09-12.md`. That report explains
each broken indicator in prose; this one shows the **original line next to the changed line** for
every kind of change, so each edit can be checked at a glance.

### How to find every change in the file

Each edit carries a dated comment on its own line:

```bash
grep -n "fix 2026-" src/js/core/technical-indicators.prods__Wang__2026.js
```

97 lines come back: the 70 described here, plus the 27 from the second pass named above.
Nothing in the file is changed without one of these comments.

### Rules followed for every edit

1. **No formula was changed.** Every weight, every exponent, every `(n-1)/(n+1)` is exactly as
   written. The changes are loop bounds, variable declarations, parameter names, a missing
   argument and two typos.
2. **Every edit is marked** with `fix YYYY-MM-DD` plus the reason, in the same comment style as
   the surrounding code.
3. **Nothing was deleted.** Where a line was replaced, the original intent is recorded in the
   comment next to it.
4. Each function was run on 400 test candles **before and after** the edit, to confirm the change
   does what the comment claims.

---

## Summary of the 70 edits

| # | Kind of problem | Sites | Functions | What the user saw |
|---|---|---|---|---|
| 1 | `min` computed with `Math.max` | 16 | 16 | both KD lines dead flat at 50.00 |
| 2 | Loop reads `.length` of a parameter the function never receives | 10 | 10 | nothing drawn at all (`ReferenceError`) |
| 3 | Accumulator bound `i<n` instead of `i<=n` | 15 | 10 | line drawn, but every value slightly wrong |
| 4 | Outer loop `i<K_close.length` | 8 | 1 | the most recent bar always blank |
| 5 | Variable undeclared, or declared `const` and then assigned | 5 | 4 | `NaN`, or a crash, or a leaked global |
| 6 | `i++` written inside the `for` initialiser | 1 | 1 | every second bar blank |
| 7 | Seed value never set, or set at an index the loop overwrites | 4 | 4 | the whole smoothed line `NaN` |
| 8 | `X=[n]=50;` — a syntax error | 2 | 1 | **the entire file fails to load** |
| 9 | A function returning an object, read as an array | 3 | 2 | every value `NaN` |
| 10 | Copy-paste: the previous indicator's array name left in | 2 | 2 | nothing drawn at all |
| 11 | A parameter missing from the signature | 1 | 1 | nothing drawn at all |
| 12 | Wrong start index for the KD window | 1 | 1 | blank line at larger `day` values |
| 13 | Values computed but not returned | 1 | 1 | two K-Line curves unreachable |
| 14 | Advisory comment only (no bug) | 1 | 1 | — |
| | **Total** | **70** | **33** | |

Patterns 1, 2, 3 and 8 are the ones worth guarding against, because each of them has now happened
in many separate functions. They are covered one at a time below.

---

## 1. `min` was computed with `Math.max` — 16 functions

The most common single mistake in the file. In every `*_Stochastic` / `*_KD` function the KD window
needs both ends of the range. The `max` line and the `min` line are nearly identical, and in 16
functions the `min` line was copied from the `max` line without changing `Math.max` to `Math.min`.

**Original:**

```js
for(let j=i-KD_num+2; j<=i; j++) {
  max=Math.max(max, VarRtMA_OneDayAgo[j]);
  min=Math.max(min, VarRtMA_OneDayAgo[j]);   // <-- Math.max
}
if(max===min) { RSV=50; }      // this branch now runs on EVERY bar
```

**Changed to:**

```js
for(let j=i-KD_num+2; j<=i; j++) {
  max=Math.max(max, VarRtMA_OneDayAgo[j]);
  min=Math.min(min, VarRtMA_OneDayAgo[j]);  //fix 2026-09-26: min用了Math.max，min永遠等於max，KD整條線平在50
}
```

**Why it is invisible until you look closely.** With `Math.max` on both lines, `min` and `max`
converge on the same number. `if(max===min) { RSV=50; }` is the safety branch for a zero
denominator, so it takes over completely: `RSV` is 50 on every bar, and the two smoothing passes
turn 50 into 50. The indicator draws two perfectly straight lines at 50.00 — it looks like a
working indicator on a quiet stock, not like a bug.

Measured on `DPO_Stochastic` before and after: before, `DPO_KD_K` was 50.00 on all 400 bars
(1 distinct value). After, 20.77 to 77.44 over 379 distinct values.

**All 16 sites:**

| Line | Function | Date |
|---|---|---|
| 10856 | `HighLowOsc_KDlization` | 09-19 |
| 10900 | `VariantRateMA_TwoDaysAgo_KD` | 09-19 |
| 10944 | `VariantRateMA_ThreeDaysAgo_KD` | 09-19 |
| 10998 | `VariantRateEMA_TwoDaysAgo_KD` | 09-19 |
| 11052 | `VariantRateEMA_ThreeDaysAgo_KD` | 09-19 |
| 11096 | `VariantRateMA_OneDayAgo_KD` | 09-26 |
| 11150 | `VariantRateEMA_OneDayAgo_KD` | 09-26 |
| 11243 | `VariantRateEMA_FourDaysAgo_KD` | 09-26 |
| 11298 | `VariantRateEMA_ThreeDaysAgo_KD_double` | 09-26 |
| 11360 | `VariantRateEMA_TwoDaysAgo_KD_double` | 09-26 |
| 11422 | `VariantRateEMA_OneDayAgo_KD_double` | 09-26 |
| 11490 | `VariantRateEMA_FourDaysAgo_KD_double` | 09-26 |
| 11664 | `HullMA_KD` | 09-26 |
| 11835 | `KST_Stochastic` | 09-26 |
| 11895 | `Acceleration_Stochastic` | 09-26 |
| 12107 | `DPO_Stochastic` | 10-03 |

`DEMA_KDlization` (line 10810) uses `if(DEMA[j]<min)` comparisons instead and is **correct**. A
reminder comment was added there, nothing more.

---

## 2. The loop read `.length` of a parameter the function never receives — 10 functions

**Original** (`DPO_Stochastic`):

```js
function DPO_Stochastic(STK_close, MA_day, esp, KD_num) {         // no STK_high parameter
  ...
  for(let i=KD_num+MA_day+lag_day-1; i<=STK_high.length; i++) {   // ReferenceError: STK_high is not defined
```

**Changed to:**

```js
  for(let i=KD_num+MA_day+lag_day-1; i<=STK_close.length; i++) {  //i=22 to 2000  (fix 2026-10-03: 本函式沒有這個參數)
```

**Why it matters more than the others.** `STK_high` is not declared anywhere in the function, so
the loop throws `ReferenceError` on the very first iteration. The function returns nothing and the
indicator is simply absent from the screen — no line, no error the user can see.

This happens when a function is copied from one that *does* take the high (`MoneyFlowIndex_Stochastic`
and `HighLowOsc_KDlization` both legitimately use `STK_high.length`), and the signature is shortened
but the loop bound is not.

**One variant of the same thing:** `ChaikinOSC_Stochastic` names its parameters `K_high, K_low,
K_close, K_vol`, but its KD loop read `STK_close.length` — a name from the neighbouring functions.
`VolumeOSC(STK_vol, short_day, long_day, esp)` read `STK_close.length` for the same reason.

**All 10 sites:**

| Line | Function | Read | Should read |
|---|---|---|---|
| 2123 | `VolumeOSC` | `STK_close.length` | `STK_vol.length` |
| 10895 | `VariantRateMA_TwoDaysAgo_KD` | `STK_high.length` | `STK_close.length` |
| 10939 | `VariantRateMA_ThreeDaysAgo_KD` | `STK_high.length` | `STK_close.length` |
| 11091 | `VariantRateMA_OneDayAgo_KD` | `STK_high.length` | `STK_close.length` |
| 11830 | `KST_Stochastic` | `STK_high.length` | `STK_close.length` |
| 11890 | `Acceleration_Stochastic` | `STK_high.length` | `STK_close.length` |
| 12102 | `DPO_Stochastic` | `STK_high.length` | `STK_close.length` |
| 12160 | `PriceVolumTrend_Stochastic` | `STK_high.length` | `STK_close.length` |
| 12231 | `MAPriceVolumTrend_Stochastic` | `STK_high.length` | `STK_close.length` |
| 12764 | `ChaikinOSC_Stochastic` | `STK_close.length` | `K_close.length` |

> At line 2123 the loop was left as `i<STK_vol.length` rather than `i<=`, because `VolumeOSC`
> indexes `shortMA[i]` and `longMA[i]` which are only filled to `length-1`. Only the array name
> was corrected there.

---

## 3. Accumulator bound `i<n` where the comment says `1 to n` — 15 sites

The seed average of a moving average, and the weight total of a weighted moving average, both need
`n` terms. `i<n` gives `n-1` terms and then divides by `n`.

**Original** (`BollingerBands`):

```js
for(let i=1; i<MA_day; i++) {   //i=1 to 10
  sum=sum+K_close[i];
}
MA[MA_day]=sum/MA_day;          // 9 closes divided by 10
```

**Changed to:**

```js
for(let i=1; i<=MA_day; i++) {   //i=1 to 10  (fix 2026-09-26: 原為 i<MA_day，只累加9筆卻除以10)
  sum=sum+K_close[i];
}
MA[MA_day]=sum/MA_day;
```

**Why it is easy to miss.** The comment on the line already says `i=1 to 10`, which is the correct
intent — only the code disagrees with it. The result is not blank and not flat; it is a line that
looks right and is wrong by about one bar's worth of price, which then propagates through every
exponential step after it. In `BollingerBands` the whole band sits slightly off; in `HullMA` the
weighted sum is short one weight, so the newest and heaviest-weighted close is the one dropped.

The same correction, applied to the weight loops of a Hull MA:

```js
// original
for(let i=1; i<half_day1; i++) { weight_total1=weight_total1+i; }
// changed
for(let i=1; i<=half_day1; i++) { weight_total1=weight_total1+i; }  // (fix 2026-09-26: was i<half_day1, missed the last weight)
```

And inside the weighted sum itself, where `j<i` dropped the newest close:

```js
// original
for(let j=i-half_day1+1; j<i; j++) {
// changed
for(let j=i-half_day1+1; j<=i; j++) {   // (fix 2026-09-26: was j<i, dropped the most recent close from the weighted sum)
```

**All 15 sites:**

| Line(s) | Function | Bound | Date |
|---|---|---|---|
| 1217 | `DEMA` | `i<esp` → `i<=esp` | 09-26 |
| 1343, 1366 | `IntradayMomentum` | `i<day1`, `i<day2` | 09-17 |
| 2144 | `SimpleMA_vol` | `i<day` → `i<=day` | 10-03 |
| 2858, 2875, 2897 | `HullMA` | `i<half_day`, `i<day`, `i<m` | 09-19 |
| 4714, 4734, 4758 | `ZeroLagHullMA` | `i<half_day1`, `i<day1`, `i<m1` | 09-26 |
| 4722 | `ZeroLagHullMA` | `j<i` → `j<=i` | 09-26 |
| 4802, 4824, 4848 | `ZeroLagHullMA` | `i<half_day2`, `i<day2`, `i<m2` | 09-26 |
| 13169 | `BollingerBands` | `i<MA_day` → `i<=MA_day` | 09-26 |

`DEMA` was cross-checked against Prof. Wang's own design file `Wang_design__HullMA _2026-01-18.js`,
which writes `i<=esp` for the same seed loop. The design file was taken as authoritative.

---

## 4. The outer loop stopped one bar early — `ZeroLagHullMA`, 8 sites

**Original:**

```js
for(let i=half_day1; i<K_close.length; i++) {   //i=5 to 2000
```

**Changed to:**

```js
for(let i=half_day1; i<=K_close.length; i++) {  //i=5 to 2000 (fix 2026-09-26: was i<K_close.length, dropped the most recent bar)
```

**Why.** The arrays in this file are 1-based: index 0 is unused and the last bar is at index
`length`. `i<K_close.length` therefore stops at `length-1`, one short, and the newest bar of every
line in the function stays empty. On a chart this is the single most visible defect — the lines
stop just short of today's candle and leave a gap next to the price.

All eight are in `ZeroLagHullMA`, which builds four moving averages in sequence, each with its own
loop: lines **4719, 4737, 4749, 4764, 4809, 4827, 4839, 4855**.

---

## 5. Variables undeclared, or `const` then assigned — 4 functions, 5 sites

### 5a. Only the second variable got the initial value

**Original** (`IntradayMomentum`):

```js
let Iup, Idn = 0;        // Idn is 0; Iup is undefined
...
Iup=Iup+(STK_close[i]-STK_open[i]);   // undefined + number = NaN
```

**Changed to:**

```js
let Iup = 0, Idn = 0;  //fix 2026-09-17: was "let Iup, Idn = 0;" (Iup undefined, IMI1 all NaN)
```

`= 0` in a `let` list applies only to the variable it is attached to. `Iup` started as `undefined`,
and `undefined + 5` is `NaN`, which then poisons `Iup/(Iup+Idn)*100` for the whole series.

### 5b. Missing `let` inside a loop body

**Original** (`VertHoriFilter`):

```js
max_close=STK_close[i];    // no declaration: becomes a global
min_close=STK_close[i];
```

**Changed to:**

```js
let max_close=STK_close[i];  //令第一筆為max (fix 2026-09-19: 加let)
let min_close=STK_close[i];  //令第一筆為min (fix 2026-09-19: 加let)
```

### 5c. Missing `let` on a computed limit

**Original** (`KST_Stochastic`):

```js
max_day=Math.max(day1,day2,day3,day4);   //設4個day最大值為30
```

**Changed to:**

```js
let max_day=Math.max(day1,day2,day3,day4);   //設4個day最大值為30  (fix 2026-09-26: 補上let，否則變成全域變數)
```

Without `let`, `max_day` is created on `window` and shared by every function in the page. Two
indicators drawn at the same time with different `day` values will overwrite each other's limit.

### 5d. `const` then assigned

**`HighLowOsc_KDlization`** declared `TR` with `const` and then assigned to it inside the loop,
which throws `TypeError: Assignment to constant variable`. Changed to `let TR=0;` (line 10836).

---

## 6. `i++` written inside the `for` initialiser — `VertHoriFilter`

**Original:**

```js
for(let i=1; i<STK_close.length-VHF_day+1; i++) {   // outer loop
  max_close=STK_close[i];
  min_close=STK_close[i];
  for(j=i++; j<=(i+VHF_day-1); j++) {               // <-- i++ here
    ...
  }
  VHF[i+VHF_day-1]=Math.abs(max_close-min_close)/sum;
  eVHF[i+VHF_day-1]=VHF[i+VHF_day-1];               // the eVHF seed
  if (i>1) {
    eVHF[i+VHF_day-1]=(esp-1)/(esp+1)*eVHF[i+VHF_day-2]+2/(esp+1)*VHF[i+VHF_day-1];
  }
```

**Changed to:**

```js
  //fix 2026-09-19: 原為 for(j=i++;...)，i++在迴圈內把i多加了1，
  //造成(a)外層每次跳2筆，VHF隔一筆就是空的；(b)第一圈i已變2使 if(i>1) 成立，eVHF第一筆種子被覆蓋成NaN。
  for(let j=i; j<=(i+VHF_day-1); j++) {   //例參數VHF_day=20，從2找到20
```

**Why one character caused two separate faults.** `j=i++` reads `i` into `j` and then increments
`i` itself. So:

- **(a)** `i` gains one extra step on every pass of the outer loop. The outer loop advances by 2
  instead of 1, so `VHF[20], VHF[22], VHF[24]…` are filled and every bar in between is left empty.
  The indicator drew as a dotted line.
- **(b)** On the very first pass `i` is already 2 by the time `if (i>1)` is reached, so the seed
  line `eVHF[…]=VHF[…]` is immediately overwritten by the smoothing formula, which reads
  `eVHF[i+VHF_day-2]` — a slot nothing has written yet. `eVHF` became `NaN` from the first value
  onward.

The fix is `j=i` with `let`. Nothing else in the function changed.

---

## 7. The seed value was never set, or was set where the loop overwrites it — 4 sites

### 7a. Never set at all — `VolRatio`

**Original:**

```js
VolRatio[day]=100;       //初值三個均設為第一天的成交量，此時初值VR=100。VR(20)=100
//第一輪先算第一個VR...
...
eVolRatio[day+1]=(esp-1)/(esp+1)*eVolRatio[day]+2/(esp+1)*VolRatio[day+1];   // eVolRatio[day] is undefined
```

**Changed to — one line added:**

```js
VolRatio[day]=100;       //初值三個均設為第一天的成交量，此時初值VR=100。VR(20)=100
eVolRatio[day]=100;      //eVR初值 = VR初值 = 100 (fix 2026-09-17: eVolRatio[day] was never set, so eVR was all NaN)
```

`VolRatio` got its seed of 100; `eVolRatio` did not. The first smoothing step read
`eVolRatio[day]` as `undefined`, producing `NaN`, and every later step carried the `NaN` forward —
`eVR` never drew anything. The value 100 is the one the comment on the line above already states.

### 7b. The seed branch could never be true — `EOM_EMV`

**Original:**

```js
for(let i=2; i<=STK_close.length; i++) {   // loop starts at 2
  ...
  if(i===1){                               // never true
    eEOM_EMV[2]=EOM_EMV[2]; }              // the seed
  else {
    eEOM_EMV[i]=(esp-1)/(esp+1)*eEOM_EMV[i-1]+2/(esp+1)*EOM_EMV[i];
  }
```

**Changed to:**

```js
  if(i===2){             //指數平滑移動平均 (fix 2026-09-17: was i===1, never true since the loop starts at 2)
```

The seed branch was written for `i===1`, but the loop starts at `i=2`, so it never ran. The `else`
branch ran on the first pass instead and read `eEOM_EMV[1]`, which nothing fills. The whole
`eEOM_EMV` line was `NaN`. Note that the seed line itself already writes to index `2` — the code
was right, only the test was off by one.

### 7c. The seed was placed on the loop's own first index — `VariantRateMA_OneDayAgo_KD`

**Original:**

```js
VarRtMA_OneDayAgo_KD_K[KD_num+MA_day]=50;      //初值[14]
VarRtMA_OneDayAgo_KD_D[KD_num+MA_day]=50;
...
for(let i=KD_num+MA_day; i<=STK_close.length; i++) {   // starts at 14 - the same index
```

**Changed to:**

```js
VarRtMA_OneDayAgo_KD_K[KD_num+MA_day-1]=50;  //初值[13]=50  (fix 2026-09-26: 初值索引原為[14]=迴圈起點，第一圈就被蓋掉)
VarRtMA_OneDayAgo_KD_D[KD_num+MA_day-1]=50;  //初值[13]=50  (fix 2026-09-26)
```

The seed sat at index 14 and the loop's first pass writes index 14, so the seed was destroyed
before it could be used — and that same first pass reads `_K[i-1]`, index 13, which was still
empty. Moving the seed one index back is what the sibling functions in the file already do
(`PVT_KD_K[KD_num-1]=50;` with a loop from `KD_num`).

---

## 8. `X=[n]=50;` — a syntax error that stops the entire file loading — `Flexible_KD`

**Original:**

```js
Flexible_KD_K=[KD_day-1]=50;   //_K[8]=50初值
Flexible_KD_D=[KD_day-1]=50;   //_D[8]=50初值
```

**Changed to:**

```js
Flexible_KD_K[KD_day-1]=50;  //_K[8]=50初值,if KD_day=9 (fix 2026-09-26, 第3次: =[...]= 是語法錯誤，整個檔案會載不起來)
Flexible_KD_D[KD_day-1]=50;  //_D[8]=50初值,if KD_day=9 (fix 2026-09-26)
```

One `=` too many. `Flexible_KD_K = [KD_day-1] = 50` is not valid JavaScript, so the browser cannot
parse the file at all.

**This is the only kind of error in the file with consequences beyond its own function.** The
other 69 changes affect one indicator each. This one is fatal to the whole file: when the parse
fails, **none** of the functions is defined, and all 109 of Prof. Wang's indicators disappear from
the menu at once. It looks like the application broke, not like one indicator broke.

It has now occurred three times — 2026-09-17, during the 09-20 batch, and again on 09-26 after the
function was rewritten. Two one-second checks catch it before it ever reaches the browser:

```bash
node --check src/js/core/technical-indicators.prods__Wang__2026.js
grep -n "^\s*[A-Za-z0-9_]*=\[" src/js/core/technical-indicators.prods__Wang__2026.js
```

The first prints nothing if the file parses, and the exact line and column if it does not. The
second finds this specific shape anywhere in the file.

---

## 9. A function returning an object, read as an array — 2 functions, 3 sites

Some helpers in the file return a bare array; others return an object with named arrays. When the
caller assumes the wrong one, nothing throws — the index just yields `undefined`.

### 9a. `ChaikinOSC_Stochastic`

**Original:**

```js
const ADLine = AccuDistLine(K_high, K_low, K_close, K_vol);        // returns { AccuDistLine, eAccuDistLine }
...
shortEMA_ADLine[i]=(short_day-1)/(short_day+1)*shortEMA_ADLine[i-1]+2/(short_day+1)*ADLine[i];
                                                                   // ADLine[i] is undefined -> NaN
```

**Changed to:**

```js
const ADLine = AccuDistLine(K_high, K_low, K_close, K_vol).AccuDistLine;  //取得ADLine值=1,2,...,2000.  //fix 2026-10-03: 少了 .AccuDistLine，這個函式回傳的是物件不是陣列(同行2205的寫法)
```

The existing `ChaikinOSC` at line 2205 already writes `.AccuDistLine` correctly; the new copy
dropped it. Every value downstream became `NaN`, so the function ran to completion and returned
two arrays full of `NaN` — no error anywhere, just an empty pane.

> **Also noticed, not changed:** the file declares `AccuDistLine` **twice** — at line 2164
> `AccuDistLine(K_high, K_low, K_close, K_vol)` returning `{ AccuDistLine }`, and at line 6343
> `AccuDistLine(STK_high, STK_low, STK_close, STK_vol, esp)` returning
> `{ AccuDistLine, eAccuDistLine }`. In JavaScript the later declaration wins, so **every caller
> reaches the one at 6343**, including the two at lines 2205 and 12728 that pass only four
> arguments. That happens to be harmless today: the first four parameters line up, so
> `.AccuDistLine` is correct, and `esp` arrives `undefined` which only affects `eAccuDistLine`,
> which nobody reads. It is fragile rather than broken, so nothing was touched — but if the one at
> 2164 is ever meant to be the live one, renaming one of the two would make that certain.

### 9b. `VolumeOSC`

**Original:**

```js
const shortMA = SimpleMA_vol(STK_vol, short_day);   //例如5天MA
const longMA = SimpleMA_vol(STK_vol, long_day);     //例如10天MA
```

**Changed to:**

```js
const shortMA = SimpleMA_vol(STK_vol, short_day).MA_vol;  //例如5天MA  (fix 2026-10-03: SimpleMA_vol回傳{MA_vol}物件，要取.MA_vol)
const longMA = SimpleMA_vol(STK_vol, long_day).MA_vol;    //例如10天MA  (fix 2026-10-03: 同上)
```

---

## 10. Copy-paste: the previous indicator's array name was left in — 2 functions

Both `PriceOSC_Stochastic` and `ChaikinOSC_Stochastic` were started from
`MoneyFlowIndex_Stochastic`. Each builds its own array correctly, then the entire KD block still
read `MFI[]`.

**Original** (`PriceOSC_Stochastic` — five consecutive lines):

```js
max=MFI[i-KD_num+1];
min=MFI[i-KD_num+1];
for(let j=i-KD_num+2; j<=i; j++) {
  max=Math.max(max, MFI[j]);
  min=Math.min(min, MFI[j]);
}
...
RSV=(MFI[i]-min)/(max-min)*100;
```

**Changed to:**

```js
max=PriceOSC[i-KD_num+1];  //max=Max([10]-->[18])  //fix 2026-10-03: 原為MFI[]，是從MFI Stochastic複製過來的
min=PriceOSC[i-KD_num+1];  //min=Min(同上)
for(let j=i-KD_num+2; j<=i; j++) {
  max=Math.max(max, PriceOSC[j]);
  min=Math.min(min, PriceOSC[j]);
}
...
RSV=(PriceOSC[i]-min)/(max-min)*100;
```

`ChaikinOSC_Stochastic` had the identical five lines, also on `MFI[]`, now on `ChaikinOSC[]`
(line 12765). `MFI` is not declared in either function, so both threw `ReferenceError` and drew
nothing.

---

## 11. A parameter missing from the signature — `MoneyFlowIndex_Stochastic`

**Original:**

```js
function MoneyFlowIndex_Stochastic(STK_high, STK_low, STK_close, day, esp, KD_num) {
  ...
  PMF=PMF+today_TpPrice*STK_vol[i];      // STK_vol used 6 times, never passed in
```

**Changed to:**

```js
function MoneyFlowIndex_Stochastic(STK_high,STK_low, STK_close, STK_vol, day, esp, KD_num) {  //fix 2026-10-03: 補上STK_vol參數，內文用了6次却沒有收到（原本MoneyFlowIndex也有同樣問題）
```

The body uses `STK_vol` six times, and Money Flow Index is *defined* on volume, so the function
cannot work without it. Volume was added as the **fourth** argument, which is the position the
other functions in the same batch already use (`EMAPriceVolumTrend(STK_high, STK_low, STK_close,
STK_vol, esp)`), so the call order stays consistent across the file.

> **The original `MoneyFlowIndex` (line 1932) had the identical bug, and has since been
> fixed.** It had the same six `STK_vol` references and the same missing argument, and would
> have thrown the moment anything called it. At the time this section was written it was
> unregistered, so nothing was broken and it was deliberately left untouched rather than
> changed without asking. A later pass on 2026-10-03 fixed it the same way - volume as the
> fourth argument - and registered it, so the two functions now agree:
>
> ```js
> function MoneyFlowIndex(STK_high,STK_low, STK_close, STK_vol, day, esp) {
> ```
>
> That pass also found two further faults, one of them shared by both functions, which this
> document had missed: the first loop ran `i<day` where its comment says `i=2 to 10`, and in
> the second loop `yesterday_TpPrice` was summed **without dividing by 3**, so yesterday's
> typical price came out three times too large and today's value could almost never exceed
> it. Positive money flow was therefore nearly always skipped. Both are written up as
> section 14a of `PROF-WANG-BUG-REPORT-2026-09-12.md`.

---

## 12. Wrong start index for the KD window — `HullMA_KD`

**Original:**

```js
let start=day+3;     //開始算HMA_KD[]的時間點, if day=10 then start=13
```

**Changed to:**

```js
let start=day+m-1;   //開始算HMA_KD[]的時間點, if day=10 then start=13  //fix 2026-09-26: HMA其實從day+m-1開始(m=ceil(sqrt(day)))，day+3只在day=10~16時才對，day>=18整條線會空白
```

`HMA[]` first has a value at `day+m-1`, where `m = ceil(sqrt(day))`. At the default `day=10`,
`m=4` and `day+m-1 = 13`, which is exactly what `day+3` gives — so the original is correct at the
default and the comment on the line is right. It stops being correct once `m` changes: at `day=18`,
`m=5`, the real start is 22 but `start` says 21, and the KD loop reads an `HMA[]` slot that is
still empty. The whole line goes blank for any `day` of 18 or more. Writing `day+m-1` makes it
follow `m` and keeps the `day=10` result identical.

---

## 13. Values computed but not returned — `HullMA_KD`

**Original:**

```js
  return { HMA_KD_K, HMA_KD_D };
  //Normally drawing the HMA[], eHMA[] figures in the K-Line area.
```

**Changed to:**

```js
  //fix 2026-09-26: 也回傳 HMA、eHMA。下面的註解說它們要畫在K線區，
  //但原本只回傳 K/D，外面拿不到這兩條線。多回傳兩個key不影響既有呼叫端。
  return { HMA_KD_K, HMA_KD_D, HMA, eHMA };
  //Normally drawing the HMA[], eHMA[] figures in the K-Line area.
```

The comment immediately below the `return` asks for `HMA[]` and `eHMA[]` to be drawn on the K-Line,
but only `K` and `D` were returned, so no caller could reach those two curves. Both arrays are
fully computed inside the function — only the `return` was short. Adding two keys to the returned
object cannot affect any existing caller, since the old two keys are unchanged.

**Side effect worth knowing about.** `esp` is used exactly once in this function, at line 2913,
and only to build `eHMA`:

```js
eHMA[i]=(esp-1)/(esp+1)*eHMA[i-1]+2/(esp+1)*HMA[i]; //自創
```

The `K`/`D` path is driven by `alpha`, not by `esp`:

```js
HMA_KD_K[i]=alpha*HMA_KD_K[i-1]+(1-alpha)*RSV;
HMA_KD_D[i]=alpha*HMA_KD_D[i-1]+(1-alpha)*HMA_KD_K[i];
```

So while `eHMA` was not returned, changing `esp` had no observable effect at all — it was the only
array `esp` touched, and nothing outside could see it. Now that `eHMA` is returned, `esp` controls
a visible curve. The app therefore labels the parameter `esp (K/D ignore it)`, so a user adjusting
it understands it moves `eHMA` on the K-Line and leaves `K`/`D` alone.

---

## 14. One comment added where there was no bug — `DEMA_KDlization`

Line 10810 only adds a reminder next to correct code, as a note for the next function copied from
this one:

```js
if(DEMA[j]>max) { max=DEMA[j]; }  //max=Max([2]-->[9])
if(DEMA[j]<min) { min=DEMA[j]; }  //min=Min([2]-->[9])
// 或：max=Math.max(max, DEMA[j]);  min=Math.min(min, DEMA[j]);  //注意min要用Math.min (fix 2026-09-19)
```

---

## Complete index — all 33 functions

| Function | Line(s) | Dates | Kind |
|---|---|---|---|
| `VertHoriFilter` | 1127, 1128, 1129 | 09-19 | 5b, 6 |
| `VolRatio` | 1167 | 09-17 | 7a |
| `DEMA` | 1217 | 09-26 | 3 |
| `IntradayMomentum` | 1342, 1343, 1366 | 09-17 | 5a, 3 |
| `EOM_EMV` | 1785 | 09-17 | 7b |
| `VolumeOSC` | 2121, 2122, 2123 | 10-03 | 9b, 2 |
| `SimpleMA_vol` | 2144 | 10-03 | 3 |
| `HullMA` | 2858, 2875, 2897 | 09-19 | 3 |
| `ZeroLagHullMA` | 4714–4855 (15) | 09-26 | 3, 4 |
| `Flexible_KD` | 10717, 10718 | 09-26 | 8 |
| `DEMA_KDlization` | 10810 | 09-19 | 14 (comment only) |
| `HighLowOsc_KDlization` | 10836, 10856 | 09-19 | 5d, 1 |
| `VariantRateMA_TwoDaysAgo_KD` | 10895, 10900 | 09-19 | 2, 1 |
| `VariantRateMA_ThreeDaysAgo_KD` | 10939, 10944 | 09-19 | 2, 1 |
| `VariantRateEMA_TwoDaysAgo_KD` | 10998 | 09-19 | 1 |
| `VariantRateEMA_ThreeDaysAgo_KD` | 11052 | 09-19 | 1 |
| `VariantRateMA_OneDayAgo_KD` | 11086, 11087, 11091, 11096 | 09-26 | 7c, 2, 1 |
| `VariantRateEMA_OneDayAgo_KD` | 11150 | 09-26 | 1 |
| `VariantRateEMA_FourDaysAgo_KD` | 11243 | 09-26 | 1 |
| `VariantRateEMA_ThreeDaysAgo_KD_double` | 11298 | 09-26 | 1 |
| `VariantRateEMA_TwoDaysAgo_KD_double` | 11360 | 09-26 | 1 |
| `VariantRateEMA_OneDayAgo_KD_double` | 11422 | 09-26 | 1 |
| `VariantRateEMA_FourDaysAgo_KD_double` | 11490 | 09-26 | 1 |
| `HullMA_KD` | 11652, 11664, 11681 | 09-26 | 12, 1, 13 |
| `KST_Stochastic` | 11808, 11830, 11835 | 09-26 | 5c, 2, 1 |
| `Acceleration_Stochastic` | 11890, 11895 | 09-26 | 2, 1 |
| `DPO_Stochastic` | 12102, 12107 | 10-03 | 2, 1 |
| `PriceVolumTrend_Stochastic` | 12160 | 10-03 | 2 |
| `MAPriceVolumTrend_Stochastic` | 12231 | 10-03 | 2 |
| `MoneyFlowIndex_Stochastic` | 12504 | 10-03 | 11 |
| `PriceOSC_Stochastic` | 12687 | 10-03 | 10 |
| `ChaikinOSC_Stochastic` | 12728, 12764, 12765 | 10-03 | 9a, 2, 10 |
| `BollingerBands` | 13169 | 09-26 | 3 |

Line numbers were re-checked against the file after the second pass of 2026-10-03 shifted them.
If they drift again, `grep -n "fix 2026-"` always gives the current ones.

---

## Three checks that would have caught most of this

| Check | Catches |
|---|---|
| `node --check <file>` | pattern 8 — the error that takes the whole file down. One second, no browser. |
| Read the `for` line whenever a function is copied | patterns 2, 3, 4 and 10 — 35 of the 70 sites. The signature gets shortened or the array renamed; the loop line keeps the old name. |
| Look at the two `min=` / `max=` lines together | pattern 1 — 16 sites, and the hardest to spot, because a flat line at 50.00 looks like a working indicator. |

---

## Appendix — changes outside Prof. Wang's file

Two fixes were needed on the application side, not in the indicator library. They are listed here
only so the record is complete.

**`src/js/core/multi-indicator-system.js` — `computeAlligatorIndicator`.** The app's three
Alligator loops read `src[i + 1]`, so on the newest bar they asked for `src[len]`, an index the
Wang function never fills, and the last bar of all three lines was always blank:

```js
// before
for (let i = 4; i < len; i++) { const w1 = srcLip[i + 1]; ... }
// after
for (let i = 4; i < len; i++) { const w1 = srcLip[i]; ... }
```

Prof. Wang's `Alligator` is correct; the app was reading it with an off-by-one shift. The same
mismatch had already been fixed in the app's `DoubleEMA` and `HullMA` readers.

**`src/js/indicators/defs/wang.js` and `multi-indicator-system.js`.** Registration entries for the
new indicators, plus a `placement` field so a line whose comment says *"drawing … in the K_Line
area"* is drawn on the price chart rather than in a pane. No calculation lives in these files.
