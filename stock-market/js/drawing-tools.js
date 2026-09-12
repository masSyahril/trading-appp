/*
 * TradeFlow custom drawing-tool overlay for the main chart.
 * Talks to stock-app.prod.js only through the window.TradeFlowChart seam
 * (chart/candleSeries/chartData are private to that file's own IIFE).
 */
(function () {
  const STORAGE_PREFIX = 'stock_drawings_';
  const HIT_THRESHOLD = 6; // px
  const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

  let chart = null;
  let canvas = null;
  let ctx = null;
  let chartEl = null;

  let activeTool = 'crosshair';
  let currentSymbol = null;
  let drawings = [];

  let pendingPoint = null;   // first click of a two-point tool
  let previewPoint = null;   // live cursor position while placing the second point
  let measureStart = null;   // click-drag measurement anchor
  let measureCurrent = null;
  let dragging = null;       // { index, handle: 'start'|'end'|'whole', startX, startY, orig }
  let saveTimer = null;
  let redrawScheduled = false;

  waitForSeam(init);

  function waitForSeam(cb) {
    let attempts = 0;
    const iv = setInterval(() => {
      attempts++;
      if (window.TradeFlowChart) {
        clearInterval(iv);
        cb();
      } else if (attempts > 100) {
        clearInterval(iv);
        console.error('drawing-tools: window.TradeFlowChart seam never appeared');
      }
    }, 100);
  }

  function init() {
    chart = window.TradeFlowChart.getChart();
    canvas = document.getElementById('drawing-overlay');
    chartEl = document.getElementById('chart');
    if (!chart || !canvas || !chartEl) {
      console.error('drawing-tools: missing chart, canvas, or #chart element');
      return;
    }
    ctx = canvas.getContext('2d');

    currentSymbol = window.TradeFlowChart.getCurrentSymbol();
    loadDrawings();
    resizeCanvas();

    window.TradeFlowChart.onResize(() => { resizeCanvas(); redrawAll(); });
    window.TradeFlowChart.onSymbolChange((sym) => {
      currentSymbol = sym;
      cancelPending();
      loadDrawings();
      redrawAll();
    });

    try {
      chart.timeScale().subscribeVisibleLogicalRangeChange(() => redrawAllThrottled());
    } catch (e) {}

    setupToolbar();
    setupInteraction();
    redrawAll();
  }

  // ─── Series/coordinate helpers (always fetch the series live — it gets
  // swapped out on Candles/Line/Area changes in stock-app.prod.js) ─────────
  function getSeries() {
    return window.TradeFlowChart.getCandleSeries();
  }
  // Time coordinates start at the plot area's left edge, which moves right
  // while any indicator pane shows a left price scale (all panes share the
  // left axis column). The canvas starts at the chart's edge.
  function plotLeft() {
    try {
      const row = chart.panes()[0].getHTMLElement();
      const plot = row && row.children.length === 3 ? row.children[1] : null;
      return plot ? plot.getBoundingClientRect().left - canvas.getBoundingClientRect().left : 0;
    } catch (e) { return 0; }
  }
  function timeToX(time) {
    try {
      const x = chart.timeScale().timeToCoordinate(time);
      return x == null ? null : x + plotLeft();
    } catch (e) { return null; }
  }
  function xToTime(x) {
    try { return chart.timeScale().coordinateToTime(x - plotLeft()); } catch (e) { return null; }
  }
  function priceToY(price) {
    const s = getSeries();
    if (!s) return null;
    try { return s.priceToCoordinate(price); } catch (e) { return null; }
  }
  function yToPrice(y) {
    const s = getSeries();
    if (!s) return null;
    try { return s.coordinateToPrice(y); } catch (e) { return null; }
  }

  // ─── Canvas sizing ────────────────────────────────────────────────────────
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    // Cover only the price pane - indicator panes sit below it inside the same chart element.
    const paneHeight = window.TradeFlowChart.getMainPaneHeight ? window.TradeFlowChart.getMainPaneHeight() : null;
    const height = paneHeight > 0 ? Math.min(rect.height, paneHeight) : rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = rect.width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ─── Persistence ──────────────────────────────────────────────────────────
  function storageKey() { return STORAGE_PREFIX + currentSymbol; }

  function loadDrawings() {
    try {
      const raw = localStorage.getItem(storageKey());
      drawings = raw ? JSON.parse(raw) : [];
    } catch (e) {
      drawings = [];
    }
  }

  function saveDrawingsDebounced() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(storageKey(), JSON.stringify(drawings)); } catch (e) {}
    }, 300);
  }

  // ─── Toolbar ──────────────────────────────────────────────────────────────
  function setupToolbar() {
    document.querySelectorAll('.draw-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
    });
    document.getElementById('draw-clear-btn')?.addEventListener('click', () => {
      if (!drawings.length) return;
      if (!confirm(`Clear all drawings for ${currentSymbol}?`)) return;
      drawings = [];
      saveDrawingsDebounced();
      redrawAll();
    });
  }

  function setActiveTool(tool) {
    activeTool = tool;
    window.TradeFlowActiveDrawTool = tool; // read by price-alerts.js so a trendline/measure click isn't also treated as an alert
    cancelPending();
    document.querySelectorAll('.draw-tool-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    chartEl.style.cursor = tool === 'crosshair' ? '' : 'crosshair';
    redrawAllThrottled();
  }

  function cancelPending() {
    pendingPoint = null;
    previewPoint = null;
    measureStart = null;
    measureCurrent = null;
    dragging = null;
  }

  // ─── Mouse interaction ────────────────────────────────────────────────────
  // Listeners live on `document` in the CAPTURE phase so we can fully suppress
  // the chart's own pan/zoom (via stopPropagation) when we choose to intercept,
  // while leaving every other click in the app (RR modal, watchlist, etc.)
  // completely untouched whenever the event target isn't inside #chart.
  function setupInteraction() {
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('mousemove', onDocMouseMove, true);
    document.addEventListener('mouseup', onDocMouseUp, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (pendingPoint || measureStart)) {
        cancelPending();
        setActiveTool('crosshair');
      }
    });
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (y < 0 || y > rect.height) return null; // below the price pane: an indicator pane
    const time = xToTime(x);
    const price = yToPrice(y);
    if (time == null || price == null) return null;
    return { x, y, time, price };
  }

  function onDocMouseDown(e) {
    if (!chartEl.contains(e.target)) return;
    const pos = getCanvasPos(e);
    if (!pos) return;

    if (activeTool === 'trendline' || activeTool === 'fibonacci' || activeTool === 'ray') {
      e.preventDefault(); e.stopPropagation();
      if (!pendingPoint) {
        pendingPoint = pos;
        previewPoint = pos;
      } else {
        finalizeTwoPointShape(activeTool, pendingPoint, pos);
        setActiveTool('crosshair');
      }
      redrawAllThrottled();
      return;
    }

    if (activeTool === 'text') {
      e.preventDefault(); e.stopPropagation();
      const text = prompt('Annotation text:');
      if (text && text.trim()) {
        drawings.push({ type: 'text', time: pos.time, price: pos.price, text: text.trim() });
        saveDrawingsDebounced();
      }
      setActiveTool('crosshair');
      redrawAllThrottled();
      return;
    }

    if (activeTool === 'measure') {
      e.preventDefault(); e.stopPropagation();
      measureStart = pos;
      measureCurrent = pos;
      redrawAllThrottled();
      return;
    }

    // crosshair/default: only intercept if we're actually grabbing a shape
    const hit = hitTest(pos);
    if (hit) {
      e.preventDefault(); e.stopPropagation();
      const shape = drawings[hit.index];
      dragging = {
        index: hit.index,
        handle: hit.handle,
        startX: pos.x,
        startY: pos.y,
        orig: { time1: shape.time1, price1: shape.price1, time2: shape.time2, price2: shape.price2 },
      };
    }
    // else: let the chart handle its own pan/zoom start
  }

  function onDocMouseMove(e) {
    if (dragging) {
      e.preventDefault(); e.stopPropagation();
      const pos = getCanvasPos(e);
      if (pos) updateDrag(pos);
      redrawAllThrottled();
      return;
    }
    if (pendingPoint) {
      previewPoint = getCanvasPos(e) || previewPoint;
      redrawAllThrottled();
      return;
    }
    if (measureStart) {
      measureCurrent = getCanvasPos(e) || measureCurrent;
      redrawAllThrottled();
      return;
    }

    if (!chartEl.contains(e.target)) return;
    if (activeTool !== 'crosshair') return;

    const pos = getCanvasPos(e);
    if (!pos) { chartEl.style.cursor = ''; return; }
    const hit = hitTest(pos);
    chartEl.style.cursor = hit ? 'pointer' : '';
  }

  function onDocMouseUp(e) {
    if (measureStart) {
      e.preventDefault(); e.stopPropagation();
      measureStart = null;
      measureCurrent = null;
      redrawAllThrottled();
      return;
    }
    if (dragging) {
      e.preventDefault(); e.stopPropagation();
      dragging = null;
      saveDrawingsDebounced();
    }
  }

  function finalizeTwoPointShape(tool, p1, p2) {
    const type = tool === 'fibonacci' ? 'fib' : tool === 'ray' ? 'ray' : 'trendline';
    drawings.push({ type, time1: p1.time, price1: p1.price, time2: p2.time, price2: p2.price });
    saveDrawingsDebounced();
  }

  function updateDrag(pos) {
    const shape = drawings[dragging.index];
    if (!shape) return;

    if (shape.type === 'text' && dragging.handle === 'whole') {
      shape.time = pos.time;
      shape.price = pos.price;
      return;
    }
    if (dragging.handle === 'start') {
      shape.time1 = pos.time; shape.price1 = pos.price;
      return;
    }
    if (dragging.handle === 'end') {
      shape.time2 = pos.time; shape.price2 = pos.price;
      return;
    }
    if (dragging.handle === 'whole') {
      const dx = pos.x - dragging.startX;
      const dy = pos.y - dragging.startY;
      const x1 = timeToX(dragging.orig.time1), y1 = priceToY(dragging.orig.price1);
      const x2 = timeToX(dragging.orig.time2), y2 = priceToY(dragging.orig.price2);
      if (x1 == null || y1 == null || x2 == null || y2 == null) return;
      const t1 = xToTime(x1 + dx), p1 = yToPrice(y1 + dy);
      const t2 = xToTime(x2 + dx), p2 = yToPrice(y2 + dy);
      if (t1 != null && p1 != null) { shape.time1 = t1; shape.price1 = p1; }
      if (t2 != null && p2 != null) { shape.time2 = t2; shape.price2 = p2; }
    }
  }

  // ─── Hit-testing ──────────────────────────────────────────────────────────
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return dist(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return dist(px, py, x1 + t * dx, y1 + t * dy);
  }

  function hitTest(pos) {
    for (let i = drawings.length - 1; i >= 0; i--) {
      const shape = drawings[i];
      if (shape.type === 'trendline' || shape.type === 'fib' || shape.type === 'ray') {
        const x1 = timeToX(shape.time1), y1 = priceToY(shape.price1);
        const x2 = timeToX(shape.time2), y2 = priceToY(shape.price2);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;
        if (dist(pos.x, pos.y, x1, y1) <= HIT_THRESHOLD) return { index: i, handle: 'start' };
        if (dist(pos.x, pos.y, x2, y2) <= HIT_THRESHOLD) return { index: i, handle: 'end' };
        if (shape.type === 'trendline' && distToSegment(pos.x, pos.y, x1, y1, x2, y2) <= HIT_THRESHOLD) {
          return { index: i, handle: 'whole' };
        }
        if (shape.type === 'fib') {
          if (distToSegment(pos.x, pos.y, x1, y1, x2, y1) <= HIT_THRESHOLD ||
              distToSegment(pos.x, pos.y, x1, y2, x2, y2) <= HIT_THRESHOLD) {
            return { index: i, handle: 'whole' };
          }
        }
        if (shape.type === 'ray') {
          const [ex, ey] = rayEndpoint(x1, y1, x2, y2);
          if (distToSegment(pos.x, pos.y, x1, y1, ex, ey) <= HIT_THRESHOLD) {
            return { index: i, handle: 'whole' };
          }
        }
      } else if (shape.type === 'text') {
        const x = timeToX(shape.time), y = priceToY(shape.price);
        if (x == null || y == null) continue;
        ctx.font = '12px sans-serif';
        const w = ctx.measureText(shape.text).width;
        if (pos.x >= x - 4 && pos.x <= x + w + 4 && pos.y >= y - 14 && pos.y <= y + 4) {
          return { index: i, handle: 'whole' };
        }
      }
    }
    return null;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────
  function redrawAllThrottled() {
    if (redrawScheduled) return;
    redrawScheduled = true;
    requestAnimationFrame(() => { redrawScheduled = false; redrawAll(); });
  }

  function redrawAll() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    drawings.forEach((shape, i) => drawShape(shape, { active: !!dragging && dragging.index === i }));
    if (pendingPoint && previewPoint) drawPreviewLine();
    if (measureStart && measureCurrent) drawMeasurement();
  }

  function drawHandle(x, y, color) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawShape(shape, opts) {
    if (shape.type === 'trendline') drawTrendline(shape, opts);
    else if (shape.type === 'ray') drawRay(shape, opts);
    else if (shape.type === 'fib') drawFibonacci(shape, opts);
    else if (shape.type === 'text') drawText(shape, opts);
  }

  // Extend the line from (x1,y1) through (x2,y2) far past the canvas edge;
  // the 2D context clips automatically so we don't need edge-intersection math.
  function rayEndpoint(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const extend = (canvas.clientWidth + canvas.clientHeight) * 2;
    return [x2 + (dx / len) * extend, y2 + (dy / len) * extend];
  }

  function drawRay(shape, opts) {
    const x1 = timeToX(shape.time1), y1 = priceToY(shape.price1);
    const x2 = timeToX(shape.time2), y2 = priceToY(shape.price2);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    const color = opts && opts.active ? '#2962ff' : '#d1d4dc';
    const [ex, ey] = rayEndpoint(x1, y1, x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    drawHandle(x1, y1, color);
    drawHandle(x2, y2, color);
  }

  function drawTrendline(shape, opts) {
    const x1 = timeToX(shape.time1), y1 = priceToY(shape.price1);
    const x2 = timeToX(shape.time2), y2 = priceToY(shape.price2);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    const color = opts && opts.active ? '#2962ff' : '#d1d4dc';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    drawHandle(x1, y1, color);
    drawHandle(x2, y2, color);
  }

  function drawFibonacci(shape, opts) {
    const x1 = timeToX(shape.time1), x2 = timeToX(shape.time2);
    if (x1 == null || x2 == null) return;
    const left = Math.min(x1, x2), right = Math.max(x1, x2);
    const color = opts && opts.active ? '#2962ff' : '#787b86';
    FIB_LEVELS.forEach(level => {
      const price = shape.price1 + (shape.price2 - shape.price1) * level;
      const y = priceToY(price);
      if (y == null) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = '10px monospace';
      ctx.fillText(`${(level * 100).toFixed(1)}%  ${price.toFixed(2)}`, right + 4, y + 3);
    });
    const y1 = priceToY(shape.price1), y2 = priceToY(shape.price2);
    if (y1 != null) drawHandle(x1, y1, color);
    if (y2 != null) drawHandle(x2, y2, color);
  }

  function drawText(shape, opts) {
    const x = timeToX(shape.time), y = priceToY(shape.price);
    if (x == null || y == null) return;
    ctx.fillStyle = opts && opts.active ? '#2962ff' : '#d1d4dc';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(shape.text, x, y);
  }

  function drawPreviewLine() {
    ctx.strokeStyle = 'rgba(120, 123, 134, 0.9)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pendingPoint.x, pendingPoint.y);
    ctx.lineTo(previewPoint.x, previewPoint.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawMeasurement() {
    const x1 = measureStart.x, y1 = measureStart.y;
    const x2 = measureCurrent.x, y2 = measureCurrent.y;
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(41, 98, 255, 0.9)';
    ctx.fillStyle = 'rgba(41, 98, 255, 0.12)';
    ctx.lineWidth = 1;
    const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    const priceDelta = measureCurrent.price - measureStart.price;
    const pct = measureStart.price ? (priceDelta / measureStart.price) * 100 : 0;
    const label = `${priceDelta >= 0 ? '+' : ''}${priceDelta.toFixed(2)} (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`;
    ctx.fillStyle = priceDelta >= 0 ? '#26a69a' : '#ef5350';
    ctx.font = 'bold 12px "Consolas", "Monaco", monospace';
    ctx.fillText(label, (x1 + x2) / 2, ry - 6);
  }
})();
