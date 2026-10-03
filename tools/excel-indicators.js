#!/usr/bin/env node
/*
 * Excel in -> indicators -> Excel out (Prof. Wang's note of 2026-09-27, item 4).
 *
 * Reads OHLCV candles from the first sheet of an .xlsx file, runs indicators
 * through the same registry the chart uses (so the numbers match what is drawn,
 * Prof. Wang's functions included), and writes a new .xlsx with the original
 * columns plus one column per indicator line.
 *
 * Usage:
 *   node tools/excel-indicators.js <input.xlsx> <id>[,<id>...] [name=value ...] [--out <file.xlsx>]
 *   node tools/excel-indicators.js --list            all indicator ids, names and inputs
 *
 * Examples:
 *   node tools/excel-indicators.js data/2330.xlsx PositiveVolIndex,NegativeVolIndex
 *   node tools/excel-indicators.js data/2330.xlsx MoneyFlowIndex day=14 esp=9 --out mfi.xlsx
 *   node tools/excel-indicators.js data/2330.xlsx DPO MA_day=20 esp=9
 *
 * The input sheet needs a header row. Columns are matched by name, in English
 * or Chinese: Date/日期, Open/開盤, High/最高, Low/最低, Close/收盤, Volume/成交量.
 * Rows are taken oldest first, as in the chart. name=value inputs apply to every
 * listed indicator that has an input of that name; the rest use their defaults.
 * The inputs actually used are written to a second sheet, "Inputs".
 */
const path = require('path');
const ExcelJS = require('exceljs');

const ROOT = path.join(__dirname, '..');

// Same scripts, same order, as the pages (and test/run-registry-tests.js).
function loadIndicators() {
  global.window = global;
  global.document = { addEventListener() {}, createElement() { return {}; } };
  const core = (f) => path.join(ROOT, 'src', 'js', 'core', f);
  const tfi = (...f) => path.join(ROOT, 'src', 'js', 'indicators', ...f);
  const scripts = [
    core('utils.js'),
    path.join(ROOT, 'src', 'js', 'utils', 'indicators.js'),
    core('technical-indicators.js'),
    core('Wang_design__HullMA _2026-01-18.js'),
    core('technical-indicators-wang.js'),
    core('multi-indicator-system.js'),
    core('technical-indicators.prods__Wang__2026.js'),
    tfi('registry.js'),
    tfi('defs', 'overlays.js'),
    tfi('defs', 'wang.js'),
    tfi('defs', 'trend.js'),
    tfi('defs', 'momentum.js'),
    tfi('defs', 'oscillators.js'),
    tfi('defs', 'volume.js'),
    tfi('defs', 'volatility.js'),
    tfi('defs', 'legacy.js'),
  ];
  // The indicator code logs a lot; keep the terminal readable.
  const { log, warn } = console;
  console.log = () => {};
  console.warn = () => {};
  try { scripts.forEach(f => require(f)); } finally { console.log = log; console.warn = warn; }
  return window.TFIndicators.registry;
}

const HEADERS = {
  time: ['date', 'time', 'datetime', '日期', '時間', '时间'],
  open: ['open', 'o', '開盤', '开盘', '開盤價', '开盘价'],
  high: ['high', 'h', '最高', '最高價', '最高价'],
  low: ['low', 'l', '最低', '最低價', '最低价'],
  close: ['close', 'c', '收盤', '收盘', '收盤價', '收盘价'],
  volume: ['volume', 'vol', 'v', '成交量'],
};

// A cell's plain value: formulas give their cached result, rich text its text.
function cellValue(cell) {
  const v = cell.value;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('result' in v) return v.result;
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
  }
  return v;
}

function readCandles(sheet) {
  const header = sheet.getRow(1);
  const columns = {};
  header.eachCell((cell, col) => {
    const name = String(cellValue(cell) ?? '').trim().toLowerCase();
    for (const [field, names] of Object.entries(HEADERS)) {
      if (names.includes(name) && !columns[field]) columns[field] = col;
    }
  });
  if (!columns.close) {
    throw new Error('No Close column found in row 1 (expected one of: ' + HEADERS.close.join(', ') + ')');
  }
  const candles = [];
  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (field) => (columns[field] ? cellValue(row.getCell(columns[field])) : undefined);
    const close = Number(get('close'));
    if (!Number.isFinite(close)) continue; // blank or text row
    const num = (field, fallback) => {
      const v = Number(get(field));
      return Number.isFinite(v) ? v : fallback;
    };
    const t = get('time');
    candles.push({
      time: t instanceof Date ? Math.floor(t.getTime() / 1000) : candles.length,
      open: num('open', close),
      high: num('high', close),
      low: num('low', close),
      close,
      volume: num('volume', 0),
    });
    rows.push(r);
  }
  return { candles, rows, columns };
}

function parseArgs(argv) {
  const args = { files: [], params: {}, out: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') args.list = true;
    else if (a === '--out') args.out = argv[++i];
    else if (/^[^=]+=.+$/.test(a)) {
      const [k, v] = a.split('=');
      args.params[k] = Number(v);
    } else args.files.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registry = loadIndicators();

  if (args.list) {
    registry.all()
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach(def => {
        const inputs = def.params.map(p => `${p.key}=${p.default}`).join(' ');
        console.log(`${def.id.padEnd(32)} ${def.name}${inputs ? '   [' + inputs + ']' : ''}`);
      });
    return;
  }

  const [input, idList] = args.files;
  if (!input || !idList) {
    console.log('Usage: node tools/excel-indicators.js <input.xlsx> <id>[,<id>...] [name=value ...] [--out <file.xlsx>]');
    console.log('       node tools/excel-indicators.js --list');
    process.exit(1);
  }
  const defs = idList.split(',').map(id => {
    const def = registry.get(id.trim());
    if (!def) throw new Error(`Unknown indicator "${id}". Run with --list to see the ids.`);
    return def;
  });

  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(input);
  const sheet = book.worksheets[0];
  const { candles, rows } = readCandles(sheet);
  if (!candles.length) throw new Error('No data rows with a numeric Close were found.');

  let col = sheet.columnCount + 1;
  const used = [];
  defs.forEach(def => {
    const params = registry.defaultParams(def);
    Object.keys(params).forEach(k => { if (args.params[k] != null) params[k] = args.params[k]; });
    const { series } = registry.evaluate(def, candles, params);
    def.outputs.forEach(o => {
      sheet.getRow(1).getCell(col).value = def.outputs.length > 1 ? `${def.id}.${o.key}` : def.id;
      sheet.getRow(1).getCell(col).font = { bold: true };
      (series[o.key] || []).forEach((v, i) => {
        if (v != null) sheet.getRow(rows[i]).getCell(col).value = v;
      });
      sheet.getColumn(col).width = Math.max(12, String(sheet.getRow(1).getCell(col).value).length + 2);
      col++;
    });
    used.push([def.id, def.name, Object.entries(params).map(([k, v]) => `${k}=${v}`).join(', ')]);
  });

  const info = book.getWorksheet('Inputs') || book.addWorksheet('Inputs');
  info.addRow(['Indicator', 'Name', 'Inputs used', 'Run at (UTC)']).font = { bold: true };
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  used.forEach(u => info.addRow([...u, stamp]));
  info.columns.forEach(c => { c.width = 28; });

  const out = args.out || input.replace(/\.xlsx$/i, '') + '_results.xlsx';
  await book.xlsx.writeFile(out);
  console.log(`${candles.length} candles, ${defs.length} indicator(s) -> ${out}`);
}

main().catch(err => {
  console.error('Error: ' + err.message);
  process.exit(1);
});
