// Vercel Serverless Function: Health Check
import { testConnection } from './lib/ccxt-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const connectionTest = await testConnection();

    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      exchange: connectionTest,
      config: {
        rsiPeriod: 14,
        oversoldThreshold: 30,
        overboughtThreshold: 70,
        takeProfitPercent: 5,
        stopLossPercent: 10
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
}
