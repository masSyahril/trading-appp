# Backtest: Prof. Wang vs textbook indicators

Answers one question: **does Prof. Wang's version of an indicator trade better
than the standard version, on the same stocks, with the same rule, after
Taiwan trading costs?**

## Run it

1. Put daily price history in `backtest/data/`, one CSV per stock (the file
   name becomes the symbol, e.g. `2330.csv`), or one CSV with a symbol column.
   The folder is git-ignored so licensed data never gets committed.
2. `npm run backtest` (or `node backtest/run.js path/to/csvs`)

Useful options: `--indicator TRIX`, `--from 2015-01-01`, `--to 2025-12-31`,
`--tax 0.001` (ETFs), `--out report.csv` (one row per stock and variant).
`node backtest/run.js --help` lists them all.

### Accepted CSV formats

- English headers: `date, open, high, low, close, volume`
- TWSE download headers: `日期, 開盤價, 最高價, 最低價, 收盤價, 成交股數`
- ROC dates (`114/09/01`), `YYYYMMDD`, or ISO dates; thousands commas are fine
- Suspended days (`--`) are dropped, not filled with zeros

**Use split- and dividend-adjusted prices** if you have them. Unadjusted
prices show fake crashes on ex-dividend days, and Taiwan stocks pay large
dividends.

## What it does

- Long-only, all in or all out, no leverage.
- Signal on the close, trade at the **next open**, so it never looks ahead.
- Costs on every trade: 0.1425% commission each side, 0.3% transaction tax
  on sells, 0.05% slippage each side.
- Reports the median result across stocks, both halves of the period
  separately, and how many stocks each variant beat the textbook version on.

## Current comparisons (`comparisons.js`)

| Indicator | Prof. Wang | Textbook baseline | Rule |
|---|---|---|---|
| TRIX | `TRIX()` from the prods bundle, with his eTRIX | TA-Lib-style TRIX(9) + 9 signal, and TRIX(15) | long while line > signal |
| PSY | `PSY()` with his EMA-smoothed ePSY | PSY(10) | buy below 25, sell above 75; also PSY x ePSY crossover |

The rules are **generic assumptions, not Prof. Wang's own**. If he uses his
indicators differently, add his rule as a new variant and run the textbook
indicator through the same rule.

## How to read the results

- "beats baseline" near half the stocks means no real difference.
- A variant that only wins in one half of the period was probably lucky.
- Fewer than 30 trades in total (marked `(!)`) is too few to tell skill from luck.
- Delisted stocks are usually missing from free data, which makes every
  strategy look better than it was (survivorship bias).
- A good backtest is necessary, not sufficient. It is not proof of future
  returns and not something to show customers as a promise.
