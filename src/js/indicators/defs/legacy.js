/*
 * Older indicators from MultiIndicatorSystem (multi-indicator-system.js) that
 * have no declarative entry yet, registered as-is: their own compute() and
 * render() run unchanged, with render() drawing into a pane of the main chart
 * through the adapter in manager.js (_legacyChart).
 *
 * Every definition there has an entry now (defs/wang.js and the category
 * files), so this only picks up definitions added to multi-indicator-system.js
 * later: they work straight away, and `npm test` lists them as "still legacy"
 * until they get an entry. Load it after all the other defs files.
 */
(function () {
  'use strict';
  const NS = window.TFIndicators;
  const system = NS.util.math();
  if (!system) {
    console.warn('TFIndicators: MultiIndicatorSystem is not loaded - the classic pane indicators are unavailable');
    return;
  }
  const CATEGORY = { trend: 'Trend', momentum: 'Momentum', oscillator: 'Oscillators', volume: 'Volume', volatility: 'Volatility' };

  Object.entries(system.indicatorDefinitions).forEach(([id, def]) => {
    if (NS.registry.has(id) || typeof def.compute !== 'function' || typeof def.render !== 'function') return;
    const labels = def.paramLabels || {};
    NS.registry.register({
      id,
      name: String(def.name || id).trim(),
      category: CATEGORY[def.type] || 'Other',
      placement: 'pane',
      params: Object.entries(def.defaultParams || {}).map(([key, value]) => ({ key, label: labels[key] || key, default: value })),
      editable: def.editable !== false,
      minBars: def.minPeriod || 1,
      legacy: { system, def },
    });
  });

  NS.legacySystem = system;
})();
