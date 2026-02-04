// Vercel Serverless Function: Backtesting
import { getTopCoinsByVolume, fetchMultipleOHLCV } from './lib/ccxt-client.js';
import { runBacktest } from './lib/backtest.js';

export const config = {
  maxDuration: 120 // 2 minutes for backtesting
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = parseInt(req.query.limit) || 20;
    const days = parseInt(req.query.days) || 365;

    console.log(`Starting backtest for top ${limit} coins over ${days} days...`);

    // Get top coins
    const topCoins = await getTopCoinsByVolume(limit);

    if (topCoins.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch coins from MEXC' });
    }

    // Fetch historical OHLCV data
    const symbols = topCoins.map(c => c.symbol);
    const ohlcvMap = await fetchMultipleOHLCV(symbols, '1d', days);

    // Run backtest on each symbol
    const results = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      totalSymbols: topCoins.length,
      symbolResults: [],
      aggregate: {
        totalSignals: 0,
        totalWins: 0,
        totalLosses: 0,
        allReturns: []
      }
    };

    for (const coin of topCoins) {
      const ohlcv = ohlcvMap.get(coin.symbol);

      if (!ohlcv || ohlcv.length < 100) {
        continue;
      }

      const backtest = runBacktest(ohlcv);

      if (backtest.valid) {
        results.symbolResults.push({
          symbol: coin.symbol,
          baseAsset: coin.baseAsset,
          totalSignals: backtest.totalSignals,
          winRate: backtest.stats.winRate,
          avgReturn: backtest.stats.avgReturn,
          forwardReturns: backtest.forwardReturns
        });

        results.aggregate.totalSignals += backtest.totalSignals;
        results.aggregate.totalWins += backtest.stats.wins;
        results.aggregate.totalLosses += backtest.stats.losses;
        results.aggregate.allReturns.push(...backtest.trades.map(t => t.returnPercent));
      }
    }

    // Calculate aggregate stats
    const { totalWins, totalLosses, allReturns } = results.aggregate;
    const totalTrades = totalWins + totalLosses;

    results.aggregate.winRate = totalTrades > 0
      ? Math.round((totalWins / totalTrades) * 100 * 100) / 100
      : 0;

    results.aggregate.avgReturn = allReturns.length > 0
      ? Math.round((allReturns.reduce((a, b) => a + b, 0) / allReturns.length) * 100) / 100
      : 0;

    // Calculate forward returns aggregate
    const forwardAgg = { '1D': { wins: 0, total: 0 }, '1W': { wins: 0, total: 0 }, '2W': { wins: 0, total: 0 }, '1M': { wins: 0, total: 0 } };

    for (const result of results.symbolResults) {
      for (const [horizon, data] of Object.entries(result.forwardReturns)) {
        if (forwardAgg[horizon]) {
          forwardAgg[horizon].wins += data.wins;
          forwardAgg[horizon].total += data.totalSignals;
        }
      }
    }

    results.aggregate.forwardReturns = {};
    for (const [horizon, data] of Object.entries(forwardAgg)) {
      results.aggregate.forwardReturns[horizon] = {
        winRate: data.total > 0 ? Math.round((data.wins / data.total) * 100 * 100) / 100 : 0,
        wins: data.wins,
        total: data.total
      };
    }

    // Sort by win rate
    results.symbolResults.sort((a, b) => b.winRate - a.winRate);

    // Remove raw returns array to reduce payload
    delete results.aggregate.allReturns;

    console.log(`Backtest complete: ${results.aggregate.totalSignals} signals, ${results.aggregate.winRate}% win rate`);

    return res.status(200).json(results);
  } catch (error) {
    console.error('Backtest error:', error);
    return res.status(500).json({ error: error.message });
  }
}
