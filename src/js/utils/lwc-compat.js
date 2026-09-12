/*
 * lightweight-charts v5 compatibility shim - TEMPORARY (indicator system v2,
 * phase 1; removed in phase 4 once everything calls addSeries directly).
 *
 * v5 replaced chart.addLineSeries(options) and friends with
 * chart.addSeries(LineSeries, options, paneIndex), and it only treats a data
 * point as blank when `value` is undefined - the v3.8-era code here pads
 * series with `{ time, value: null }`, which v5 would take as a real point.
 * Loaded right after the library, this gives every chart the old per-type
 * methods again and turns null/NaN values back into blank points, so the
 * existing app code runs unchanged on v5.
 */
(function () {
  'use strict';
  const LWC = window.LightweightCharts;
  if (!LWC || typeof LWC.createChart !== 'function' || !LWC.LineSeries) return;

  const SERIES_METHODS = {
    addLineSeries: LWC.LineSeries,
    addAreaSeries: LWC.AreaSeries,
    addBarSeries: LWC.BarSeries,
    addBaselineSeries: LWC.BaselineSeries,
    addCandlestickSeries: LWC.CandlestickSeries,
    addHistogramSeries: LWC.HistogramSeries,
  };
  const SINGLE_VALUE = new Set([LWC.LineSeries, LWC.AreaSeries, LWC.BaselineSeries, LWC.HistogramSeries]);

  // { time, value: null | NaN } -> { time }: a blank point, as v3.8 drew it.
  const toWhitespace = (item) =>
    (item && typeof item === 'object' && 'value' in item && !Number.isFinite(item.value))
      ? { time: item.time }
      : item;

  function wrapSeries(series, definition) {
    if (!SINGLE_VALUE.has(definition)) return series;
    const setData = series.setData.bind(series);
    const update = series.update.bind(series);
    series.setData = (data) => setData(Array.isArray(data) ? data.map(toWhitespace) : data);
    series.update = (bar, ...rest) => update(toWhitespace(bar), ...rest);
    return series;
  }

  const createChart = LWC.createChart;
  function createChartCompat(container, options) {
    const chart = createChart(container, options);
    Object.entries(SERIES_METHODS).forEach(([method, definition]) => {
      if (definition && typeof chart[method] !== 'function') {
        chart[method] = (seriesOptions) => wrapSeries(chart.addSeries(definition, seriesOptions), definition);
      }
    });
    return chart;
  }

  // The library's export object is frozen, so publish a copy with the wrapper.
  window.LightweightCharts = Object.freeze(Object.assign({}, LWC, { createChart: createChartCompat }));
})();
