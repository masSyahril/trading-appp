/*
 * CSV loader for daily OHLCV data. Accepts the common export shapes:
 *   - English headers: date, open, high, low, close, volume (any case; also
 *     "Adj Close" is ignored in favour of close)
 *   - TWSE-style Chinese headers: 日期, 開盤價, 最高價, 最低價, 收盤價, 成交股數
 *   - ROC (Minguo) dates like 114/09/01, and numbers with thousands commas
 * One file per stock (symbol = file name), or one file with a symbol column
 * (symbol / code / ticker / 證券代號 / 股票代號), which is split per stock.
 */

const fs = require('fs');
const path = require('path');

const HEADER_ALIASES = {
  date: ['date', 'time', 'datetime', '日期', '交易日期'],
  open: ['open', '開盤價', '開盤'],
  high: ['high', '最高價', '最高'],
  low: ['low', '最低價', '最低'],
  close: ['close', '收盤價', '收盤'],
  volume: ['volume', 'vol', '成交股數', '成交量'],
  symbol: ['symbol', 'code', 'ticker', 'stock_id', '證券代號', '股票代號'],
};

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseDate(raw) {
  const s = raw.trim();
  const roc = s.match(/^(\d{2,3})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (roc) {
    const y = Number(roc[1]) + 1911;
    return `${y}-${roc[2].padStart(2, '0')}-${roc[3].padStart(2, '0')}`;
  }
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const num = s => Number(String(s).replace(/,/g, ''));

function parseCsv(text, fallbackSymbol) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  const header = splitCsvLine(lines[0]).map(h => h.toLowerCase());
  const idx = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    idx[key] = header.findIndex(h => aliases.includes(h));
  }
  for (const key of ['date', 'open', 'high', 'low', 'close']) {
    if (idx[key] < 0) {
      throw new Error(`missing a "${key}" column (headers found: ${header.join(', ')})`);
    }
  }

  const bySymbol = new Map();
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line);
    const time = parseDate(f[idx.date] || '');
    const c = {
      time,
      open: num(f[idx.open]),
      high: num(f[idx.high]),
      low: num(f[idx.low]),
      close: num(f[idx.close]),
      volume: idx.volume >= 0 ? num(f[idx.volume]) : 0,
    };
    // Suspended days (TWSE prints "--") and blank rows are dropped, not zero-filled.
    if (!time || ![c.open, c.high, c.low, c.close].every(v => Number.isFinite(v) && v > 0)) {
      skipped++;
      continue;
    }
    const sym = idx.symbol >= 0 ? f[idx.symbol] : fallbackSymbol;
    if (!bySymbol.has(sym)) bySymbol.set(sym, []);
    bySymbol.get(sym).push(c);
  }

  for (const candles of bySymbol.values()) {
    candles.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    // Keep the last row for any duplicated date.
    for (let i = candles.length - 1; i > 0; i--) {
      if (candles[i].time === candles[i - 1].time) candles.splice(i - 1, 1);
    }
  }
  return { bySymbol, skipped };
}

/** Load every .csv under `target` (a file or a directory). */
function loadData(target) {
  const stat = fs.statSync(target);
  const files = stat.isDirectory()
    ? fs.readdirSync(target).filter(f => f.toLowerCase().endsWith('.csv')).map(f => path.join(target, f))
    : [target];

  const all = new Map();
  const warnings = [];
  for (const file of files) {
    try {
      const { bySymbol, skipped } = parseCsv(fs.readFileSync(file, 'utf8'), path.basename(file, path.extname(file)));
      if (skipped) warnings.push(`${path.basename(file)}: skipped ${skipped} unusable row(s)`);
      for (const [sym, candles] of bySymbol) all.set(sym, candles);
    } catch (e) {
      warnings.push(`${path.basename(file)}: ${e.message}`);
    }
  }
  return { data: all, warnings };
}

module.exports = { loadData, parseCsv, parseDate };
