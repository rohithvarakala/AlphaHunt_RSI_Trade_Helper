import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function CoinTable({ coins, title, showSignal = false }) {
  if (!coins || coins.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-slate-400 text-center py-8">No data available</p>
      </div>
    );
  }

  const getRSIColor = (rsi) => {
    if (rsi < 30) return 'text-emerald-400';
    if (rsi > 70) return 'text-red-400';
    return 'text-slate-300';
  };

  const getRSIBg = (rsi) => {
    if (rsi < 30) return 'bg-emerald-500/20';
    if (rsi > 70) return 'bg-red-500/20';
    return 'bg-slate-600/20';
  };

  const formatPrice = (price) => {
    if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatVolume = (vol) => {
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(2)}K`;
    return `$${vol.toFixed(2)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-700">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Coin
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                RSI
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Trend
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Volume 24h
              </th>
              {showSignal && (
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Signal
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {coins.map((coin, index) => (
              <motion.tr
                key={coin.symbol || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-slate-700/50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium text-white">{coin.baseAsset}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-300">
                  {formatPrice(coin.price)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className={`px-2 py-1 rounded ${getRSIBg(coin.rsi)} ${getRSIColor(coin.rsi)} font-mono`}>
                    {coin.rsi?.toFixed(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {coin.rsiTrend === 'rising' ? (
                    <TrendingUp className="w-4 h-4 text-emerald-400 inline" />
                  ) : coin.rsiTrend === 'falling' ? (
                    <TrendingDown className="w-4 h-4 text-red-400 inline" />
                  ) : (
                    <Minus className="w-4 h-4 text-slate-400 inline" />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-slate-400">
                  {formatVolume(coin.volume24h)}
                </td>
                {showSignal && (
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                      BUY SIGNAL
                    </span>
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

export default CoinTable;
