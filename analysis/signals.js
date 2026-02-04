import { RSI_CONFIG } from '../config/settings.js';
import { calculateRSI, isOversold, isOverbought } from './rsi.js';

/**
 * Signal Types
 */
export const SIGNAL_TYPES = {
  OVERSOLD_ENTRY: 'OVERSOLD_ENTRY',    // RSI crosses below 30
  OVERBOUGHT_EXIT: 'OVERBOUGHT_EXIT',  // RSI crosses above 70
  NEUTRAL: 'NEUTRAL'
};

/**
 * Detect RSI crossover signals
 * @param {Array<{timestamp: number, close: number}>} ohlcv - OHLCV data
 * @param {number} period - RSI period
 * @returns {Array<{timestamp: number, close: number, rsi: number, signal: string, previousRsi: number}>}
 */
export function detectSignals(ohlcv, period = RSI_CONFIG.period) {
  const closes = ohlcv.map(c => c.close);
  const rsiValues = calculateRSI(closes, period);

  const signals = [];

  for (let i = 1; i < ohlcv.length; i++) {
    const currentRSI = rsiValues[i];
    const previousRSI = rsiValues[i - 1];

    if (currentRSI === null || previousRSI === null) {
      continue;
    }

    let signal = SIGNAL_TYPES.NEUTRAL;

    // Detect oversold crossover (RSI crosses below threshold)
    if (currentRSI < RSI_CONFIG.oversoldThreshold &&
        previousRSI >= RSI_CONFIG.oversoldThreshold) {
      signal = SIGNAL_TYPES.OVERSOLD_ENTRY;
    }

    // Detect overbought crossover (RSI crosses above threshold)
    if (currentRSI > RSI_CONFIG.overboughtThreshold &&
        previousRSI <= RSI_CONFIG.overboughtThreshold) {
      signal = SIGNAL_TYPES.OVERBOUGHT_EXIT;
    }

    if (signal !== SIGNAL_TYPES.NEUTRAL) {
      signals.push({
        timestamp: ohlcv[i].timestamp,
        date: new Date(ohlcv[i].timestamp).toISOString(),
        close: ohlcv[i].close,
        rsi: currentRSI,
        previousRsi: previousRSI,
        signal,
        index: i
      });
    }
  }

  return signals;
}

/**
 * Get only oversold entry signals (RSI < 30)
 * @param {Array} ohlcv - OHLCV data
 * @param {number} period - RSI period
 * @returns {Array} Oversold signals only
 */
export function getOversoldSignals(ohlcv, period = RSI_CONFIG.period) {
  const allSignals = detectSignals(ohlcv, period);
  return allSignals.filter(s => s.signal === SIGNAL_TYPES.OVERSOLD_ENTRY);
}

/**
 * Get only overbought exit signals (RSI > 70)
 * @param {Array} ohlcv - OHLCV data
 * @param {number} period - RSI period
 * @returns {Array} Overbought signals only
 */
export function getOverboughtSignals(ohlcv, period = RSI_CONFIG.period) {
  const allSignals = detectSignals(ohlcv, period);
  return allSignals.filter(s => s.signal === SIGNAL_TYPES.OVERBOUGHT_EXIT);
}

/**
 * Analyze current market state for a symbol
 * @param {Array} ohlcv - OHLCV data
 * @param {number} period - RSI period
 * @returns {Object} Current market analysis
 */
export function analyzeCurrentState(ohlcv, period = RSI_CONFIG.period) {
  if (!ohlcv || ohlcv.length < period + 1) {
    return {
      valid: false,
      reason: 'Insufficient data'
    };
  }

  const closes = ohlcv.map(c => c.close);
  const rsiValues = calculateRSI(closes, period);
  const currentRSI = rsiValues[rsiValues.length - 1];
  const previousRSI = rsiValues[rsiValues.length - 2];
  const latestCandle = ohlcv[ohlcv.length - 1];

  // Determine trend direction
  const rsiTrend = currentRSI > previousRSI ? 'rising' : 'falling';

  // Determine zone
  let zone = 'neutral';
  if (currentRSI < RSI_CONFIG.oversoldThreshold) {
    zone = 'oversold';
  } else if (currentRSI > RSI_CONFIG.overboughtThreshold) {
    zone = 'overbought';
  }

  // Check for active signal
  let activeSignal = null;
  if (currentRSI < RSI_CONFIG.oversoldThreshold &&
      previousRSI >= RSI_CONFIG.oversoldThreshold) {
    activeSignal = SIGNAL_TYPES.OVERSOLD_ENTRY;
  } else if (currentRSI > RSI_CONFIG.overboughtThreshold &&
             previousRSI <= RSI_CONFIG.overboughtThreshold) {
    activeSignal = SIGNAL_TYPES.OVERBOUGHT_EXIT;
  }

  return {
    valid: true,
    timestamp: latestCandle.timestamp,
    date: new Date(latestCandle.timestamp).toISOString(),
    price: latestCandle.close,
    rsi: currentRSI,
    previousRsi: previousRSI,
    rsiTrend,
    zone,
    isOversold: isOversold(currentRSI),
    isOverbought: isOverbought(currentRSI),
    activeSignal,
    distanceFromOversold: currentRSI - RSI_CONFIG.oversoldThreshold,
    distanceFromOverbought: RSI_CONFIG.overboughtThreshold - currentRSI
  };
}

/**
 * Scan multiple symbols for signals
 * @param {Map<string, Array>} ohlcvMap - Map of symbol to OHLCV data
 * @param {number} period - RSI period
 * @returns {Object} Scan results
 */
export function scanForSignals(ohlcvMap, period = RSI_CONFIG.period) {
  const results = {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    totalScanned: ohlcvMap.size,
    oversoldSignals: [],
    overboughtSignals: [],
    currentlyOversold: [],
    currentlyOverbought: [],
    errors: []
  };

  for (const [symbol, ohlcv] of ohlcvMap) {
    try {
      const analysis = analyzeCurrentState(ohlcv, period);

      if (!analysis.valid) {
        results.errors.push({ symbol, reason: analysis.reason });
        continue;
      }

      // Check for new signals
      if (analysis.activeSignal === SIGNAL_TYPES.OVERSOLD_ENTRY) {
        results.oversoldSignals.push({
          symbol,
          ...analysis
        });
      } else if (analysis.activeSignal === SIGNAL_TYPES.OVERBOUGHT_EXIT) {
        results.overboughtSignals.push({
          symbol,
          ...analysis
        });
      }

      // Track all currently oversold/overbought
      if (analysis.isOversold) {
        results.currentlyOversold.push({
          symbol,
          rsi: analysis.rsi,
          price: analysis.price
        });
      } else if (analysis.isOverbought) {
        results.currentlyOverbought.push({
          symbol,
          rsi: analysis.rsi,
          price: analysis.price
        });
      }
    } catch (error) {
      results.errors.push({ symbol, reason: error.message });
    }
  }

  // Sort by RSI (lowest first for oversold)
  results.currentlyOversold.sort((a, b) => a.rsi - b.rsi);
  results.currentlyOverbought.sort((a, b) => b.rsi - a.rsi);

  return results;
}

/**
 * Format signal for display
 * @param {Object} signal - Signal object
 * @returns {string} Formatted signal string
 */
export function formatSignal(signal) {
  const icon = signal.signal === SIGNAL_TYPES.OVERSOLD_ENTRY ? '🟢' : '🔴';
  const action = signal.signal === SIGNAL_TYPES.OVERSOLD_ENTRY ? 'BUY' : 'SELL';
  return `${icon} ${signal.symbol || 'N/A'} | ${action} | RSI: ${signal.rsi?.toFixed(2)} | Price: $${signal.price?.toFixed(4)}`;
}

export default {
  SIGNAL_TYPES,
  detectSignals,
  getOversoldSignals,
  getOverboughtSignals,
  analyzeCurrentState,
  scanForSignals,
  formatSignal
};
