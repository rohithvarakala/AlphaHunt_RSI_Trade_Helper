import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle, Search, Filter } from 'lucide-react';
import CoinTable from '../components/CoinTable';

function Scanner() {
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, oversold, overbought, neutral
  const [searchTerm, setSearchTerm] = useState('');

  const fetchScanData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scan?limit=50');
      if (!response.ok) throw new Error('Failed to fetch scan data');
      const data = await response.json();
      setScanData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScanData();
  }, []);

  const filteredCoins = scanData?.allCoins?.filter(coin => {
    // Search filter
    if (searchTerm && !coin.baseAsset.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Zone filter
    if (filter === 'oversold' && coin.zone !== 'oversold') return false;
    if (filter === 'overbought' && coin.zone !== 'overbought') return false;
    if (filter === 'neutral' && coin.zone !== 'neutral') return false;

    return true;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">RSI Scanner</h1>
          <p className="text-slate-400 mt-1">
            Real-time RSI analysis for all MEXC futures
          </p>
        </div>
        <button
          onClick={fetchScanData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-400">{error}</p>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search coins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Zone Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
          >
            <option value="all">All Coins</option>
            <option value="oversold">Oversold (RSI &lt; 30)</option>
            <option value="overbought">Overbought (RSI &gt; 70)</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <p className="text-slate-400">
        Showing {filteredCoins.length} of {scanData?.allCoins?.length || 0} coins
      </p>

      {/* Coin Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner" />
        </div>
      ) : (
        <CoinTable
          coins={filteredCoins}
          title={`All Coins (Sorted by RSI)`}
        />
      )}

      {/* Strategy Info */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Trading Strategy</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="text-emerald-400 font-medium">Entry Signal</p>
            <p className="text-slate-300 mt-1">RSI crosses below 30</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="text-sky-400 font-medium">Take Profit</p>
            <p className="text-slate-300 mt-1">+5% from entry</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <p className="text-red-400 font-medium">Stop Loss</p>
            <p className="text-slate-300 mt-1">-10% from entry</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Scanner;
