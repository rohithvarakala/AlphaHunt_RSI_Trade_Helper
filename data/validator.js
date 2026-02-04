import { RSI_CONFIG } from '../config/settings.js';

/**
 * Data Quality Validator for OHLCV and RSI data
 */

/**
 * Validate OHLCV data quality
 * @param {Array<{timestamp: number, open: number, high: number, low: number, close: number, volume: number}>} ohlcv
 * @param {string} symbol - Symbol for logging
 * @returns {{valid: boolean, data: Array, issues: string[]}}
 */
export function validateOHLCV(ohlcv, symbol = 'unknown') {
  const issues = [];

  if (!ohlcv || !Array.isArray(ohlcv)) {
    return { valid: false, data: [], issues: ['No data provided'] };
  }

  if (ohlcv.length === 0) {
    return { valid: false, data: [], issues: ['Empty dataset'] };
  }

  // Check minimum history requirement
  if (ohlcv.length < RSI_CONFIG.minHistoryDays) {
    issues.push(
      `Insufficient history: ${ohlcv.length} days (minimum: ${RSI_CONFIG.minHistoryDays})`
    );
  }

  // Validate individual candles
  const validatedData = [];
  let gapCount = 0;
  let anomalyCount = 0;

  for (let i = 0; i < ohlcv.length; i++) {
    const candle = ohlcv[i];
    const validated = validateCandle(candle, i);

    if (validated.hasGap) gapCount++;
    if (validated.hasAnomaly) anomalyCount++;

    validatedData.push(validated.candle);

    // Check for time gaps (more than 2x expected interval for daily data)
    if (i > 0) {
      const expectedInterval = 24 * 60 * 60 * 1000; // 1 day in ms
      const actualInterval = candle.timestamp - ohlcv[i - 1].timestamp;
      if (actualInterval > expectedInterval * 2) {
        gapCount++;
      }
    }
  }

  if (gapCount > 0) {
    issues.push(`Found ${gapCount} data gaps`);
  }

  if (anomalyCount > 0) {
    issues.push(`Found ${anomalyCount} price anomalies`);
  }

  // Check for chronological order
  const isChronological = checkChronologicalOrder(ohlcv);
  if (!isChronological) {
    issues.push('Data is not in chronological order');
  }

  return {
    valid: issues.length === 0 || (issues.length === 1 && gapCount <= 5),
    data: validatedData,
    issues,
    stats: {
      totalCandles: ohlcv.length,
      gaps: gapCount,
      anomalies: anomalyCount,
      startDate: new Date(ohlcv[0]?.timestamp).toISOString(),
      endDate: new Date(ohlcv[ohlcv.length - 1]?.timestamp).toISOString()
    }
  };
}

/**
 * Validate individual candle data
 * @param {Object} candle - OHLCV candle
 * @param {number} index - Candle index
 * @returns {{candle: Object, hasGap: boolean, hasAnomaly: boolean}}
 */
export function validateCandle(candle, index) {
  let hasAnomaly = false;
  const validated = { ...candle };

  // Check for missing values
  if (!candle.close || !candle.open || !candle.high || !candle.low) {
    hasAnomaly = true;
  }

  // Check for negative prices
  if (candle.close < 0 || candle.open < 0 || candle.high < 0 || candle.low < 0) {
    hasAnomaly = true;
  }

  // Check for OHLC consistency (high should be highest, low should be lowest)
  if (candle.high < candle.low ||
      candle.high < candle.open ||
      candle.high < candle.close ||
      candle.low > candle.open ||
      candle.low > candle.close) {
    hasAnomaly = true;
  }

  // Check for extreme price movements (>50% in single candle)
  if (candle.open > 0) {
    const changePercent = Math.abs((candle.close - candle.open) / candle.open) * 100;
    if (changePercent > 50) {
      hasAnomaly = true;
    }
  }

  return {
    candle: validated,
    hasGap: false,
    hasAnomaly
  };
}

/**
 * Check if data is in chronological order
 * @param {Array} ohlcv - OHLCV data array
 * @returns {boolean} True if chronological
 */
export function checkChronologicalOrder(ohlcv) {
  for (let i = 1; i < ohlcv.length; i++) {
    if (ohlcv[i].timestamp <= ohlcv[i - 1].timestamp) {
      return false;
    }
  }
  return true;
}

/**
 * Fill data gaps with interpolated values
 * @param {Array} ohlcv - OHLCV data with gaps
 * @param {number} intervalMs - Expected interval in milliseconds
 * @returns {Array} OHLCV data with gaps filled
 */
export function fillGaps(ohlcv, intervalMs = 24 * 60 * 60 * 1000) {
  if (ohlcv.length < 2) return ohlcv;

  const filled = [ohlcv[0]];

  for (let i = 1; i < ohlcv.length; i++) {
    const prevCandle = ohlcv[i - 1];
    const currCandle = ohlcv[i];
    const gap = currCandle.timestamp - prevCandle.timestamp;

    // If gap is larger than 1.5x expected interval, fill it
    if (gap > intervalMs * 1.5) {
      const missingPeriods = Math.floor(gap / intervalMs) - 1;
      for (let j = 1; j <= missingPeriods; j++) {
        // Use previous close as the interpolated value
        filled.push({
          timestamp: prevCandle.timestamp + (intervalMs * j),
          open: prevCandle.close,
          high: prevCandle.close,
          low: prevCandle.close,
          close: prevCandle.close,
          volume: 0,
          interpolated: true
        });
      }
    }

    filled.push(currCandle);
  }

  return filled;
}

/**
 * Validate RSI value
 * @param {number} rsi - RSI value
 * @returns {{valid: boolean, value: number|null, reason: string|null}}
 */
export function validateRSIValue(rsi) {
  if (rsi === null || rsi === undefined) {
    return { valid: false, value: null, reason: 'RSI is null or undefined' };
  }

  if (typeof rsi !== 'number' || isNaN(rsi)) {
    return { valid: false, value: null, reason: 'RSI is not a valid number' };
  }

  if (rsi < RSI_CONFIG.validRange.min || rsi > RSI_CONFIG.validRange.max) {
    return {
      valid: false,
      value: null,
      reason: `RSI ${rsi} outside valid range [${RSI_CONFIG.validRange.min}, ${RSI_CONFIG.validRange.max}]`
    };
  }

  return { valid: true, value: rsi, reason: null };
}

/**
 * Generate data quality report
 * @param {Map<string, Object>} validationResults - Map of symbol to validation results
 * @returns {Object} Quality report
 */
export function generateQualityReport(validationResults) {
  const report = {
    totalSymbols: validationResults.size,
    validSymbols: 0,
    invalidSymbols: 0,
    symbolsWithIssues: [],
    commonIssues: {}
  };

  for (const [symbol, result] of validationResults) {
    if (result.valid) {
      report.validSymbols++;
    } else {
      report.invalidSymbols++;
      report.symbolsWithIssues.push({
        symbol,
        issues: result.issues
      });
    }

    // Track common issues
    for (const issue of result.issues) {
      report.commonIssues[issue] = (report.commonIssues[issue] || 0) + 1;
    }
  }

  return report;
}

export default {
  validateOHLCV,
  validateCandle,
  checkChronologicalOrder,
  fillGaps,
  validateRSIValue,
  generateQualityReport
};
