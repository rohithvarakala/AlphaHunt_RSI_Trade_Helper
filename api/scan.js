// Vercel Serverless Function: RSI Scanner
import { getTopCoinsByVolume, fetchMultipleOHLCV } from './lib/ccxt-client.js';
import { analyzeCurrentState, RSI_CONFIG } from './lib/rsi.js';

export const config = {
  maxDuration: 60 // 60 seconds timeout for scanning
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
    const limit = parseInt(req.query.limit) || 50;

    console.log(`Starting RSI scan for top ${limit} coins...`);

    // Get top coins by volume
    const topCoins = await getTopCoinsByVolume(limit);

    if (topCoins.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch coins from MEXC' });
    }

    // Fetch OHLCV data for all coins
    const symbols = topCoins.map(c => c.symbol);
    const ohlcvMap = await fetchMultipleOHLCV(symbols, '1d', 50);

    // Analyze each coin
    const results = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      totalScanned: topCoins.length,
      oversoldSignals: [],
      currentlyOversold: [],
      currentlyOverbought: [],
      allCoins: []
    };

    for (const coin of topCoins) {
      const ohlcv = ohlcvMap.get(coin.symbol);

      if (!ohlcv || ohlcv.length < RSI_CONFIG.period + 1) {
        continue;
      }

      const analysis = analyzeCurrentState(ohlcv);

      if (!analysis.valid) continue;

      const coinData = {
        symbol: coin.symbol,
        baseAsset: coin.baseAsset,
        price: analysis.price,
        rsi: analysis.rsi,
        rsiTrend: analysis.rsiTrend,
        zone: analysis.zone,
        volume24h: coin.volume,
        change24h: coin.change
      };

      results.allCoins.push(coinData);

      if (analysis.activeSignal === 'OVERSOLD_ENTRY') {
        results.oversoldSignals.push({
          ...coinData,
          signal: 'OVERSOLD_ENTRY',
          previousRsi: analysis.previousRsi
        });
      }

      if (analysis.isOversold) {
        results.currentlyOversold.push(coinData);
      } else if (analysis.isOverbought) {
        results.currentlyOverbought.push(coinData);
      }
    }

    // Sort by RSI
    results.currentlyOversold.sort((a, b) => a.rsi - b.rsi);
    results.currentlyOverbought.sort((a, b) => b.rsi - a.rsi);
    results.allCoins.sort((a, b) => a.rsi - b.rsi);

    console.log(`Scan complete: ${results.oversoldSignals.length} new signals, ${results.currentlyOversold.length} oversold`);

    return res.status(200).json(results);
  } catch (error) {
    console.error('Scan error:', error);
    return res.status(500).json({ error: error.message });
  }
}
