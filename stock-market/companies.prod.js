/* Companies page script - supports CSV import and local listing */
(function () {
  const LS_KEY_LOCAL = 'tl_local_candles';
  const tbody = document.getElementById('companies-table').querySelector('tbody');
  const refreshBtn = document.getElementById('refresh');
  const clearBtn = document.getElementById('clear-local');
  const fileInput = document.getElementById('file-input');
  const importBtn = document.getElementById('import');
  const loadSampleBtn = document.getElementById('load-sample');
  const fileNameEl = document.getElementById('file-name');
  const searchInput = document.getElementById('search-input');
  const LS_KEY_WATCHLIST = 'tl_watchlist';

  const COMPANY_NAMES = {
    AAPL: 'Apple Inc.',
    TSLA: 'Tesla, Inc.',
    NVDA: 'NVIDIA Corporation',
    MSFT: 'Microsoft Corporation',
    GOOGL: 'Alphabet Inc.',
    AMZN: 'Amazon.com, Inc.',
    META: 'Meta Platforms, Inc.',
    NFLX: 'Netflix, Inc.',
  };

  const SAMPLE_BASE_PRICE = { AAPL: 325, TSLA: 380, NVDA: 207, MSFT: 390 };

  let filterText = '';

  function loadLocal() {
    try {
      const s = localStorage.getItem(LS_KEY_LOCAL);
      return s ? JSON.parse(s) : {};
    } catch { return {}; }
  }
  function saveLocal(data) {
    try { localStorage.setItem(LS_KEY_LOCAL, JSON.stringify(data)); } catch {}
  }

  function fmtPrice(v) {
    if (!isFinite(v)) return '—';
    if (v >= 1000) return v.toFixed(2);
    if (v >= 1) return v.toFixed(3);
    if (v >= 0.1) return v.toFixed(4);
    return v.toFixed(6);
  }

  function emptyStateRow(title, desc, icon) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <div class="empty-title">${title}</div>
        <div class="empty-desc">${desc}</div>
      </div>
    `;
    tr.appendChild(td);
    return tr;
  }

  function renderFromLocal() {
    const local = loadLocal();
    const allSymbols = Object.keys(local).sort();
    tbody.innerHTML = '';

    const t = window.TradeFlowI18n ? window.TradeFlowI18n.t : (k) => k;

    if (!allSymbols.length) {
      tbody.appendChild(emptyStateRow(
        t('companies.noLocalDataTitle'),
        t('companies.noLocalDataDesc'),
        '📭'
      ));
      return;
    }

    const term = filterText.trim().toLowerCase();
    const symbols = term
      ? allSymbols.filter(sym => {
          const name = (COMPANY_NAMES[sym] || t('companies.localImport')).toLowerCase();
          return sym.toLowerCase().includes(term) || name.includes(term);
        })
      : allSymbols;

    if (!symbols.length) {
      tbody.appendChild(emptyStateRow(
        t('companies.noMatchesTitle', { query: filterText.trim() }),
        t('companies.noMatchesDesc'),
        '🔍'
      ));
      return;
    }

    for (const sym of symbols) {
      const arr = (local[sym] || []).slice().sort((a,b)=>a.time-b.time);
      const n = arr.length;
      const last = n ? arr[n-1].close : NaN;
      const prev = n>1 ? arr[n-2].close : last;
      const chg = (isFinite(last) && isFinite(prev) && prev) ? ((last - prev)/prev)*100 : NaN;
      const chgClass = !isFinite(chg) ? 'price-flat' : (chg >= 0 ? 'price-up' : 'price-down');
      const chgText = isFinite(chg) ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '—';
      const tr = document.createElement('tr');
      tr.dataset.sym = sym;
      tr.innerHTML = `
        <td class="sym">${sym}</td>
        <td>${COMPANY_NAMES[sym] || t('companies.localImport')}</td>
        <td>${fmtPrice(last)}</td>
        <td>${fmtPrice(prev)}</td>
        <td class="${chgClass}">${chgText}</td>
        <td class="actions-cell">
          <a href="./index.html?symbol=${encodeURIComponent(sym)}" class="secondary">${t('companies.open')}</a>
          <button class="remove" data-del="${sym}">${t('companies.delete')}</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  function detectDelimiter(text) {
    const first = (text.split(/\r?\n/)[0] || '');
    const counts = [',',';','\t'].map(d => ({ d, c: (first.match(new RegExp('\\' + d, 'g')) || []).length }));
    counts.sort((a,b)=>b.c-a.c);
    return (counts[0] && counts[0].c > 0) ? counts[0].d : ',';
  }

  function parseCSV(text, delimIn) {
    const delim = delimIn || detectDelimiter(text);
    const rows = [];
    let i = 0, field = '', row = [], inQuotes = false;
    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i+1] === '"') { field += '"'; i++; } else { inQuotes = false; }
        } else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === delim) { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* ignore */ }
        else { field += c; }
      }
      i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function toEpochSeconds(dateStr) {
    if (!dateStr) return NaN;
    const s = String(dateStr).trim();
    // Try native parse first
    let d = new Date(s);
    if (isNaN(d.getTime())) {
      // Common formats: MM/DD/YYYY, YYYY-MM-DD, DD-MMM-YYYY
      const mdy = s.match(/^([0-9]{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mdy) {
        const [_, m, d2, y] = mdy; // eslint-disable-line no-unused-vars
        d = new Date(`${y}-${String(m).padStart(2,'0')}-${String(d2).padStart(2,'0')}T16:00:00`);
      } else {
        // Fallback: append 16:00
        d = new Date(s + 'T16:00:00');
      }
    }
    return Math.floor(d.getTime() / 1000);
  }

  function normalizeHeader(h) {
    return String(h || '').toLowerCase().replace(/[^a-z]/g, '');
  }
  function findIndex(headers, candidates) {
    const set = headers.map(normalizeHeader);
    for (let i = 0; i < set.length; i++) {
      for (const cand of candidates) {
        if (set[i] === cand) return i;
      }
    }
    return -1;
  }
  function num(val) {
    if (val == null) return NaN;
    const s = String(val).replace(/[$,\s]/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  function importCSV(text, defaultSymbol) {
    const rows = parseCSV(text).filter(r => r.length && r.some(x=>x && String(x).trim()!==''));
    if (!rows.length) return { added: [], symbols: [] };
    const header = rows[0];
    const dataRows = rows.slice(1);
    // Map flexible headers
    const idx = {
      date: findIndex(header, ['date','timestamp']),
      open: findIndex(header, ['open']),
      high: findIndex(header, ['high']),
      low: findIndex(header, ['low']),
      close: findIndex(header, ['close','closelast','adjclose','adjustedclose']),
      volume: findIndex(header, ['volume']),
      symbol: findIndex(header, ['symbol','ticker'])
    };
    if (idx.date < 0 || idx.open < 0 || idx.high < 0 || idx.low < 0 || idx.close < 0) {
      const t = window.TradeFlowI18n ? window.TradeFlowI18n.t : (k) => k;
      throw new Error(t('companies.csvMissingColumns'));
    }
    const local = loadLocal();
    const added = [];
    for (const r of dataRows) {
      if (!r || r.length === 0) continue;
      const rawSym = idx.symbol >= 0 ? r[idx.symbol] : (defaultSymbol || '');
      const sym = String(rawSym || '').toUpperCase().trim();
      if (!sym) continue; // require symbol resolved one way or another
      const time = toEpochSeconds(r[idx.date]);
      const open = num(r[idx.open]);
      const high = num(r[idx.high]);
      const low = num(r[idx.low]);
      const close = num(r[idx.close]);
      const volume = idx.volume >= 0 ? num(r[idx.volume]) : 0;
      if (!isFinite(time) || !isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) continue;
      if (!local[sym]) local[sym] = [];
      local[sym].push({ time, open, high, low, close, volume });
      added.push(sym);
    }
    // Deduplicate by time per symbol and sort
    for (const sym of Object.keys(local)) {
      const map = new Map();
      for (const c of local[sym]) map.set(c.time, c);
      local[sym] = Array.from(map.values()).sort((a,b)=>a.time-b.time);
    }
    saveLocal(local);
    return { added, symbols: Object.keys(local) };
  }

  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => resolve(fr.result);
      fr.readAsArrayBuffer(file);
    });
  }
  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = () => reject(fr.error);
      fr.onload = () => resolve(fr.result);
      fr.readAsText(file);
    });
  }
  function excelToCSV(ab) {
    const wb = XLSX.read(ab, { type: 'array' });
    const sheetName = wb.SheetNames[0]; // use first sheet
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws);
    return csv;
  }

  fileInput.addEventListener('change', () => {
    const t = window.TradeFlowI18n ? window.TradeFlowI18n.t : (k) => k;
    const file = fileInput.files && fileInput.files[0];
    fileNameEl.textContent = file ? file.name : t('companies.noFileChosen');
  });

  importBtn.addEventListener('click', async () => {
    const t = window.TradeFlowI18n ? window.TradeFlowI18n.t : (k) => k;
    const file = fileInput.files && fileInput.files[0];
    if (!file) { alert(t('companies.chooseFileFirst')); return; }
    const name = file.name.toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || (file.type && file.type.includes('spreadsheet'));
    let text = '';
    try {
      if (isExcel) {
        const ab = await readAsArrayBuffer(file);
        text = excelToCSV(ab);
      } else {
        text = await readAsText(file);
      }
    } catch (e) {
      console.error(e);
      alert(t('companies.failedToReadFile', { error: e.message || e }));
      return;
    }

    const firstLine = (text.split(/\r?\n/)[0] || '');
    const hasSymbolColumn = /(^|,)\s*symbol\s*(,|$)/i.test(firstLine);
    let defaultSymbol = '';
    if (!hasSymbolColumn) {
      defaultSymbol = prompt(t('companies.promptSymbol'), '') || '';
      if (!defaultSymbol) { alert(t('companies.symbolRequired')); return; }
    }
    try {
      importCSV(text, defaultSymbol);
      renderFromLocal();
      alert(t('companies.importCompleted'));
    } catch (e) {
      console.error(e);
      alert(t('companies.importFailed', { error: e.message || e }));
    }
  });

  // Row-level delete action
  function deleteSymbol(sym) {
    const local = loadLocal();
    if (local[sym]) { delete local[sym]; saveLocal(local); }
    // Also remove from main app watchlist so it doesn't poll remote API
    try {
      const s = localStorage.getItem(LS_KEY_WATCHLIST);
      const wl = s ? JSON.parse(s) : [];
      const next = Array.isArray(wl) ? wl.filter(x => String(x).toUpperCase() !== String(sym).toUpperCase()) : wl;
      localStorage.setItem(LS_KEY_WATCHLIST, JSON.stringify(next));
    } catch {}
  }
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-del]');
    if (!btn) return;
    const sym = btn.getAttribute('data-del');
    if (!sym) return;
    const t = window.TradeFlowI18n ? window.TradeFlowI18n.t : (k) => k;
    if (!confirm(t('companies.confirmDeleteSymbol', { symbol: sym }))) return;
    deleteSymbol(sym);
    renderFromLocal();
  });

  refreshBtn.addEventListener('click', renderFromLocal);
  clearBtn.addEventListener('click', () => {
    const t = window.TradeFlowI18n ? window.TradeFlowI18n.t : (k) => k;
    if (!confirm(t('companies.confirmClearAll'))) return;
    saveLocal({});
    renderFromLocal();
  });

  // Sample data: generates a short mock OHLCV history per symbol using a simple
  // random walk, in the same shape importCSV() produces, for an instant preview.
  function generateSampleCandles(basePrice) {
    const now = Math.floor(Date.now() / 1000);
    const oneDay = 24 * 60 * 60;
    const candles = [];
    let price = basePrice;
    for (let i = 30; i >= 0; i--) {
      const time = now - i * oneDay;
      const volatility = basePrice * 0.03;
      const change = (Math.random() - 0.5) * volatility;
      const open = price;
      const high = price + Math.random() * volatility * 0.5;
      const low = price - Math.random() * volatility * 0.5;
      price = Math.max(low, Math.min(high, price + change));
      candles.push({
        time,
        open,
        high,
        low,
        close: price,
        volume: Math.floor(Math.random() * 10000000) + 1000000,
      });
    }
    return candles;
  }

  loadSampleBtn.addEventListener('click', () => {
    const local = loadLocal();
    for (const sym of Object.keys(SAMPLE_BASE_PRICE)) {
      local[sym] = generateSampleCandles(SAMPLE_BASE_PRICE[sym]);
    }
    saveLocal(local);
    renderFromLocal();
  });

  searchInput.addEventListener('input', () => {
    filterText = searchInput.value;
    renderFromLocal();
  });

  // Initial render - wait for language strings to land first (only matters
  // for the empty-state message; the file-picker/table-header labels are
  // handled separately by i18n.js's data-i18n static-markup pass).
  if (window.TradeFlowI18n) {
    window.TradeFlowI18n.ready(renderFromLocal);
  } else {
    renderFromLocal();
  }
})();
