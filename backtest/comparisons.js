/*
 * Each comparison pits Prof. Wang's version of an indicator against the
 * textbook version under the SAME trading rule, so any difference in the
 * results comes from the indicator math, not the rule.
 *
 * The trading rules here are generic assumptions (line/signal crossover,
 * 25/75 PSY bands), NOT Prof. Wang's own rules. If he trades his indicators
 * differently, add his rule as another variant rather than changing these -
 * the standard version should always be run through the same rule.
 *
 * `baseline` names the textbook variant every other variant is scored against.
 * Every variant: (candles, lib) => wantLong[] where lib.wang holds his
 * functions (window.* from the prods bundle) and lib.std the textbook ones.
 */

const { crossoverSignal, bandSignal } = require('./engine');

const col = (candles, key) => candles.map(c => c[key]);

module.exports = {
  TRIX: {
    description: 'Long while TRIX is above its signal line.',
    baseline: 'Standard TRIX(9) x signal(9)',
    variants: {
      'Wang TRIX(9) x eTRIX(9)': (c, { wang }) => {
        const r = wang.TRIX(col(c, 'close'), 9);
        return crossoverSignal(r.TRIX, r.eTRIX, c.length);
      },
      'Standard TRIX(9) x signal(9)': (c, { std }) => {
        const r = std.trix(col(c, 'close'), 9, 9);
        return crossoverSignal(r.line, r.signal, c.length);
      },
      'Textbook TRIX(15) x signal(9)': (c, { std }) => {
        const r = std.trix(col(c, 'close'), 15, 9);
        return crossoverSignal(r.line, r.signal, c.length);
      },
    },
  },

  PSY: {
    description: 'Buy when the line drops below 25, sell when it rises above 75 (crossover variant: long while PSY > ePSY).',
    baseline: 'Standard PSY(10) band 25/75',
    variants: {
      'Standard PSY(10) band 25/75': (c, { std }) =>
        bandSignal(std.psy(col(c, 'close'), 10), 25, 75, c.length),
      'Wang ePSY(10,9) band 25/75': (c, { wang }) =>
        bandSignal(wang.PSY(col(c, 'close'), 10, 9).ePSY, 25, 75, c.length),
      'Wang PSY x ePSY crossover': (c, { wang }) => {
        const r = wang.PSY(col(c, 'close'), 10, 9);
        return crossoverSignal(r.PSY, r.ePSY, c.length);
      },
    },
  },
};
