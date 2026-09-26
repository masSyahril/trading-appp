/*
 * Loads Prof. Wang's indicator functions exactly as the app runs them: the
 * same browser scripts, in the same order as test/run-indicator-tests.js
 * (which mirrors stock-market/index.html), with `window` pointed at the Node
 * global so their `window.X = X` assignments become callable globals.
 */

const path = require('path');

let loaded = false;

function loadWang() {
  if (!loaded) {
    global.window = global;
    global.document = global.document || { addEventListener() {} };
    const core = (...p) => path.join(__dirname, '..', 'src', 'js', 'core', ...p);
    const utils = (...p) => path.join(__dirname, '..', 'src', 'js', 'utils', ...p);
    [
      core('utils.js'),
      utils('indicators.js'),
      core('technical-indicators.js'),
      core('Wang_design__HullMA _2026-01-18.js'),
      core('technical-indicators-wang.js'),
      core('multi-indicator-system.js'),
      core('technical-indicators.prods__Wang__2026.js'),
    ].forEach(f => require(f));
    loaded = true;
  }
  return global.window;
}

module.exports = { loadWang };
