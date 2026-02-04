import { BACKTEST_CONFIG, RISK_CONFIG } from '../config/settings.js';
import { getOversoldSignals, SIGNAL_TYPES } from './signals.js';

/**
 * Backtesting Engine for RSI Strategy
 *
 * Calculates forward returns after RSI oversold signals
 * and computes win rates for different time horizons.
 */

/**
 * Calculate forward returns for a single signal
 * @param {Object} signal - Signal object with index
 * @param {Array} ohlcv - Full OHLCV data
 * @returns {Object} Forward returns at different horizons
 */
export function calculateForwardReturns(signal, ohlcv) {
  const entryIndex = signal.index;
  const entryPrice = signal.close;
  const returns = {};

  for (const [horizon, days] of Object.entries(BACKTEST_CONFIG.forwardReturns)) {
    const exitIndex = entryIndex + days;

    if (exitIndex < ohlcv.length) {
      const exitPrice = ohlcv[exitIndex].close;
      const returnPercent = ((exitPrice - entryPrice) / entryPrice) * 100;

      returns[horizon] = {
        days,
        exitIndex,
        exitPrice,
        exitDate: new Date(ohlcv[exitIndex].timestamp).toISOString(),
        returnPercent: Math.round(returnPercent * 100) / 100,
        isWin: returnPercent > 0
      };
    } else {
      returns[horizon] = null; // Insufficient forward data
    }
  }

  return returns;
}

/**
 * Simulate a trade with take profit and stop loss
 * @param {Object} signal - Entry signal
 * @param {Array} ohlcv - Full OHLCV data
 * @param {number} takeProfitPercent - Take profit percentage
 * @param {number} stopLossPercent - Stop loss percentage
 * @param {number} maxHoldingDays - Maximum days to hold position
 * @returns {Object} Trade result
 */
export function simulateTrade(
  signal,
  ohlcv,
  takeProfitPercent = RISK_CONFIG.takeProfitPercent,
  stopLossPercent = RISK_CONFIG.stopLossPercent,
  maxHoldingDays = BACKTEST_CONFIG.forwardReturns['1M']
) {
  const entryIndex = signal.index;
  const entryPrice = signal.close;
  const takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
  const stopLossPrice = entryPrice * (1 - stopLossPercent / 100);

  let exitReason = null;
  let exitPrice = null;
  let exitIndex = null;
  let holdingDays = 0;

  // Simulate day by day
  for (let i = entryIndex + 1; i < ohlcv.length && i <= entryIndex + maxHoldingDays; i++) {
    const candle = ohlcv[i];
    holdingDays = i - entryIndex;

    // Check stop loss (using low price)
    if (candle.low <= stopLossPrice) {
      exitReason = 'STOP_LOSS';
      exitPrice = stopLossPrice;
      exitIndex = i;
      break;
    }

    // Check take profit (using high price)
    if (candle.high >= takeProfitPrice) {
      exitReason = 'TAKE_PROFIT';
      exitPrice = takeProfitPrice;
      exitIndex = i;
      break;
    }
  }

  // If no exit triggered, use last available price
  if (!exitReason) {
    const lastIndex = Math.min(entryIndex + maxHoldingDays, ohlcv.length - 1);
    exitReason = 'MAX_HOLDING';
    exitPrice = ohlcv[lastIndex].close;
    exitIndex = lastIndex;
    holdingDays = lastIndex - entryIndex;
  }

  const returnPercent = ((exitPrice - entryPrice) / entryPrice) * 100;

  return {
    entryDate: new Date(signal.timestamp).toISOString(),
    entryPrice,
    entryRsi: signal.rsi,
    exitDate: new Date(ohlcv[exitIndex].timestamp).toISOString(),
    exitPrice,
    exitReason,
    holdingDays,
    returnPercent: Math.round(returnPercent * 100) / 100,
    isWin: returnPercent > 0,
    takeProfitTarget: takeProfitPrice,
    stopLossTarget: stopLossPrice
  };
}

/**
 * Run full backtest on OHLCV data
 * @param {Array} ohlcv - OHLCV data
 * @param {Object} options - Backtest options
 * @returns {Object} Backtest results
 */
export function runBacktest(ohlcv, options = {}) {
  const {
    takeProfitPercent = RISK_CONFIG.takeProfitPercent,
    stopLossPercent = RISK_CONFIG.stopLossPercent,
    leverage = 1
  } = options;

  // Get all oversold signals
  const signals = getOversoldSignals(ohlcv);

  if (signals.length === 0) {
    return {
      valid: false,
      reason: 'No oversold signals found',
      signals: []
    };
  }

  const trades = [];
  const forwardReturnsData = {
    '1D': { wins: 0, losses: 0, returns: [] },
    '1W': { wins: 0, losses: 0, returns: [] },
    '2W': { wins: 0, losses: 0, returns: [] },
    '1M': { wins: 0, losses: 0, returns: [] }
  };

  for (const signal of signals) {
    // Calculate forward returns
    const forwardReturns = calculateForwardReturns(signal, ohlcv);

    // Track forward returns statistics
    for (const [horizon, data] of Object.entries(forwardReturns)) {
      if (data && forwardReturnsData[horizon]) {
        forwardReturnsData[horizon].returns.push(data.returnPercent);
        if (data.isWin) {
          forwardReturnsData[horizon].wins++;
        } else {
          forwardReturnsData[horizon].losses++;
        }
      }
    }

    // Simulate actual trade with TP/SL
    const trade = simulateTrade(signal, ohlcv, takeProfitPercent, stopLossPercent);
    trade.forwardReturns = forwardReturns;
    trade.leveragedReturn = trade.returnPercent * leverage;
    trades.push(trade);
  }

  // Calculate statistics
  const stats = calculateBacktestStats(trades, forwardReturnsData);

  return {
    valid: true,
    totalSignals: signals.length,
    totalTrades: trades.length,
    trades,
    forwardReturns: forwardReturnsData,
    stats,
    config: {
      takeProfitPercent,
      stopLossPercent,
      leverage
    }
  };
}

/**
 * Calculate backtest statistics
 * @param {Array} trades - Array of trade results
 * @param {Object} forwardReturnsData - Forward returns data
 * @returns {Object} Statistics
 */
export function calculateBacktestStats(trades, forwardReturnsData) {
  // Trade-level stats
  const wins = trades.filter(t => t.isWin).length;
  const losses = trades.length - wins;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  const returns = trades.map(t => t.returnPercent);
  const avgReturn = returns.length > 0
    ? returns.reduce((a, b) => a + b, 0) / returns.length
    : 0;

  const takeProfitHits = trades.filter(t => t.exitReason === 'TAKE_PROFIT').length;
  const stopLossHits = trades.filter(t => t.exitReason === 'STOP_LOSS').length;
  const maxHoldingHits = trades.filter(t => t.exitReason === 'MAX_HOLDING').length;

  const avgHoldingDays = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
    : 0;

  // Forward return stats
  const forwardStats = {};
  for (const [horizon, data] of Object.entries(forwardReturnsData)) {
    const total = data.wins + data.losses;
    forwardStats[horizon] = {
      totalSignals: total,
      wins: data.wins,
      losses: data.losses,
      winRate: total > 0 ? Math.round((data.wins / total) * 100 * 100) / 100 : 0,
      avgReturn: data.returns.length > 0
        ? Math.round((data.returns.reduce((a, b) => a + b, 0) / data.returns.length) * 100) / 100
        : 0,
      maxReturn: data.returns.length > 0 ? Math.max(...data.returns) : 0,
      minReturn: data.returns.length > 0 ? Math.min(...data.returns) : 0
    };
  }

  return {
    tradeStats: {
      totalTrades: trades.length,
      wins,
      losses,
      winRate: Math.round(winRate * 100) / 100,
      avgReturn: Math.round(avgReturn * 100) / 100,
      avgHoldingDays: Math.round(avgHoldingDays * 10) / 10,
      exitReasons: {
        takeProfit: takeProfitHits,
        stopLoss: stopLossHits,
        maxHolding: maxHoldingHits
      }
    },
    forwardReturns: forwardStats
  };
}

/**
 * Run backtest on multiple symbols
 * @param {Map<string, Array>} ohlcvMap - Map of symbol to OHLCV data
 * @param {Object} options - Backtest options
 * @returns {Object} Multi-symbol backtest results
 */
export function runMultiSymbolBacktest(ohlcvMap, options = {}) {
  const results = {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    totalSymbols: ohlcvMap.size,
    symbolResults: {},
    aggregateStats: {
      totalSignals: 0,
      totalTrades: 0,
      totalWins: 0,
      totalLosses: 0,
      allReturns: []
    }
  };

  for (const [symbol, ohlcv] of ohlcvMap) {
    const backtest = runBacktest(ohlcv, options);

    results.symbolResults[symbol] = {
      valid: backtest.valid,
      totalSignals: backtest.totalSignals || 0,
      stats: backtest.stats || null
    };

    if (backtest.valid) {
      results.aggregateStats.totalSignals += backtest.totalSignals;
      results.aggregateStats.totalTrades += backtest.totalTrades;
      results.aggregateStats.totalWins += backtest.stats.tradeStats.wins;
      results.aggregateStats.totalLosses += backtest.stats.tradeStats.losses;
      results.aggregateStats.allReturns.push(
        ...backtest.trades.map(t => t.returnPercent)
      );
    }
  }

  // Calculate aggregate win rate
  const { totalWins, totalLosses, allReturns } = results.aggregateStats;
  const totalTrades = totalWins + totalLosses;
  results.aggregateStats.winRate = totalTrades > 0
    ? Math.round((totalWins / totalTrades) * 100 * 100) / 100
    : 0;
  results.aggregateStats.avgReturn = allReturns.length > 0
    ? Math.round((allReturns.reduce((a, b) => a + b, 0) / allReturns.length) * 100) / 100
    : 0;

  return results;
}

/**
 * Format backtest results for display
 * @param {Object} results - Backtest results
 * @returns {string} Formatted string
 */
export function formatBacktestResults(results) {
  if (!results.valid) {
    return `Backtest invalid: ${results.reason}`;
  }

  const { tradeStats, forwardReturns } = results.stats;

  let output = `
=== BACKTEST RESULTS ===
Total Signals: ${results.totalSignals}
Total Trades: ${tradeStats.totalTrades}
Win Rate: ${tradeStats.winRate}%
Avg Return: ${tradeStats.avgReturn}%
Avg Holding: ${tradeStats.avgHoldingDays} days

Exit Reasons:
  Take Profit: ${tradeStats.exitReasons.takeProfit}
  Stop Loss: ${tradeStats.exitReasons.stopLoss}
  Max Holding: ${tradeStats.exitReasons.maxHolding}

Forward Returns Win Rates:
`;

  for (const [horizon, stats] of Object.entries(forwardReturns)) {
    output += `  ${horizon}: ${stats.winRate}% (${stats.wins}/${stats.totalSignals}) | Avg: ${stats.avgReturn}%\n`;
  }

  return output;
}

export default {
  calculateForwardReturns,
  simulateTrade,
  runBacktest,
  calculateBacktestStats,
  runMultiSymbolBacktest,
  formatBacktestResults
};
