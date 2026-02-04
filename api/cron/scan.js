// Vercel Cron Job: Scheduled RSI Scanner
// Runs every 4 hours to scan and store signals
import { getTopCoinsByVolume, fetchMultipleOHLCV } from '../lib/ccxt-client.js';
import { analyzeCurrentState, RSI_CONFIG } from '../lib/rsi.js';

export const config = {
  maxDuration: 60
};

export default async function handler(req, res) {
  // Verify cron secret for security
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Cron job: Starting scheduled RSI scan...');

    const topCoins = await getTopCoinsByVolume(50);
    const symbols = topCoins.map(c => c.symbol);
    const ohlcvMap = await fetchMultipleOHLCV(symbols, '1d', 50);

    const signals = [];

    for (const coin of topCoins) {
      const ohlcv = ohlcvMap.get(coin.symbol);
      if (!ohlcv || ohlcv.length < RSI_CONFIG.period + 1) continue;

      const analysis = analyzeCurrentState(ohlcv);
      if (!analysis.valid) continue;

      if (analysis.activeSignal === 'OVERSOLD_ENTRY') {
        signals.push({
          symbol: coin.symbol,
          baseAsset: coin.baseAsset,
          price: analysis.price,
          rsi: analysis.rsi,
          signal: 'OVERSOLD_ENTRY',
          timestamp: Date.now()
        });
      }
    }

    console.log(`Cron scan complete: ${signals.length} new oversold signals`);

    // Here you could store signals to Firebase or send notifications
    // For now, just return the results

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      signalsFound: signals.length,
      signals
    });
  } catch (error) {
    console.error('Cron scan error:', error);
    return res.status(500).json({ error: error.message });
  }
}
