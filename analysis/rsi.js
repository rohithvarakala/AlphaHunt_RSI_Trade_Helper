import { RSI_CONFIG } from '../config/settings.js';

/**
 * Wilder's Smoothed RSI Calculator (1978 methodology)
 *
 * Wilder's RSI uses a specific smoothing method:
 * - First Average: Simple Moving Average (SMA) of gains/losses
 * - Subsequent Averages: Wilder's Smoothing Method
 *   AvgGain = (PrevAvgGain × (period - 1) + CurrentGain) / period
 *   AvgLoss = (PrevAvgLoss × (period - 1) + CurrentLoss) / period
 */

/**
 * Calculate price changes from closing prices
 * @param {number[]} closes - Array of closing prices
 * @returns {number[]} Array of price changes (gains positive, losses negative)
 */
export function calculatePriceChanges(closes) {
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  return changes;
}

/**
 * Separate gains and losses from price changes
 * @param {number[]} changes - Array of price changes
 * @returns {{ gains: number[], losses: number[] }} Separated gains and losses (losses as positive values)
 */
export function separateGainsLosses(changes) {
  const gains = [];
  const losses = [];

  for (const change of changes) {
    if (change > 0) {
      gains.push(change);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(change));
    }
  }

  return { gains, losses };
}

/**
 * Calculate Simple Moving Average for initial RSI value
 * @param {number[]} values - Array of values
 * @param {number} period - Period for SMA
 * @returns {number} SMA value
 */
export function calculateSMA(values, period) {
  if (values.length < period) {
    return null;
  }
  const sum = values.slice(0, period).reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Calculate Wilder's Smoothed RSI
 * @param {number[]} closes - Array of closing prices (oldest to newest)
 * @param {number} period - RSI period (default: 14)
 * @returns {number[]} Array of RSI values (null for insufficient data points)
 */
export function calculateRSI(closes, period = RSI_CONFIG.period) {
  if (!closes || closes.length < period + 1) {
    return [];
  }

  const changes = calculatePriceChanges(closes);
  const { gains, losses } = separateGainsLosses(changes);

  const rsiValues = new Array(period).fill(null);

  // First RSI calculation uses SMA
  let avgGain = calculateSMA(gains, period);
  let avgLoss = calculateSMA(losses, period);

  // Calculate first RSI
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  rsiValues.push(validateRSI(rsi));

  // Subsequent RSI values use Wilder's smoothing
  for (let i = period; i < changes.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    rsiValues.push(validateRSI(rsi));
  }

  return rsiValues;
}

/**
 * Validate RSI value and flag anomalies
 * @param {number} rsi - RSI value to validate
 * @returns {number|null} Validated RSI or null if anomaly
 */
export function validateRSI(rsi) {
  if (rsi === null || rsi === undefined || isNaN(rsi)) {
    return null;
  }

  // Flag values outside valid range as anomalies
  if (rsi < RSI_CONFIG.validRange.min || rsi > RSI_CONFIG.validRange.max) {
    return null;
  }

  return Math.round(rsi * 100) / 100; // Round to 2 decimal places
}

/**
 * Get the most recent RSI value
 * @param {number[]} closes - Array of closing prices
 * @param {number} period - RSI period
 * @returns {number|null} Most recent RSI value
 */
export function getCurrentRSI(closes, period = RSI_CONFIG.period) {
  const rsiValues = calculateRSI(closes, period);
  if (rsiValues.length === 0) {
    return null;
  }
  return rsiValues[rsiValues.length - 1];
}

/**
 * Check if RSI indicates oversold condition
 * @param {number} rsi - RSI value
 * @param {number} threshold - Oversold threshold (default: 30)
 * @returns {boolean} True if oversold
 */
export function isOversold(rsi, threshold = RSI_CONFIG.oversoldThreshold) {
  return rsi !== null && rsi < threshold;
}

/**
 * Check if RSI indicates overbought condition
 * @param {number} rsi - RSI value
 * @param {number} threshold - Overbought threshold (default: 70)
 * @returns {boolean} True if overbought
 */
export function isOverbought(rsi, threshold = RSI_CONFIG.overboughtThreshold) {
  return rsi !== null && rsi > threshold;
}

/**
 * Calculate RSI with full data for analysis
 * @param {Array<{timestamp: number, close: number}>} ohlcv - OHLCV data
 * @param {number} period - RSI period
 * @returns {Array<{timestamp: number, close: number, rsi: number|null}>} Data with RSI values
 */
export function calculateRSIWithTimestamps(ohlcv, period = RSI_CONFIG.period) {
  const closes = ohlcv.map(candle => candle.close);
  const rsiValues = calculateRSI(closes, period);

  return ohlcv.map((candle, index) => ({
    timestamp: candle.timestamp,
    close: candle.close,
    rsi: rsiValues[index] || null
  }));
}

export default {
  calculateRSI,
  getCurrentRSI,
  isOversold,
  isOverbought,
  validateRSI,
  calculateRSIWithTimestamps,
  calculatePriceChanges,
  separateGainsLosses,
  calculateSMA
};
