import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle, TrendingDown, TrendingUp, Activity, Target } from 'lucide-react';
import StatCard from '../components/StatCard';
import CoinTable from '../components/CoinTable';

function Dashboard() {
  const [scanData, setScanData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchScanData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/scan?limit=50');
      if (!response.ok) throw new Error('Failed to fetch scan data');
      const data = await response.json();
      setScanData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScanData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            RSI Scanner for MEXC Futures - Top 50 Coins
          </p>
        </div>
        <button
          onClick={fetchScanData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Scanning...' : 'Refresh'}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Coins Scanned"
          value={scanData?.totalScanned || '-'}
          subtitle="USDT Perpetuals"
          icon={Activity}
          color="sky"
        />
        <StatCard
          title="New Signals"
          value={scanData?.oversoldSignals?.length || 0}
          subtitle="RSI crossed below 30"
          icon={Target}
          color="green"
        />
        <StatCard
          title="Currently Oversold"
          value={scanData?.currentlyOversold?.length || 0}
          subtitle="RSI < 30"
          icon={TrendingDown}
          color="green"
        />
        <StatCard
          title="Currently Overbought"
          value={scanData?.currentlyOverbought?.length || 0}
          subtitle="RSI > 70"
          icon={TrendingUp}
          color="red"
        />
      </div>

      {/* New Signals */}
      {scanData?.oversoldSignals?.length > 0 && (
        <CoinTable
          coins={scanData.oversoldSignals}
          title="New Oversold Signals (Entry Opportunities)"
          showSignal={true}
        />
      )}

      {/* Currently Oversold */}
      <CoinTable
        coins={scanData?.currentlyOversold?.slice(0, 10)}
        title="Currently Oversold (RSI < 30)"
      />

      {/* Currently Overbought */}
      {scanData?.currentlyOverbought?.length > 0 && (
        <CoinTable
          coins={scanData?.currentlyOverbought?.slice(0, 5)}
          title="Currently Overbought (RSI > 70)"
        />
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <p className="text-center text-slate-500 text-sm">
          Last updated: {lastUpdated.toLocaleString()}
        </p>
      )}
    </div>
  );
}

export default Dashboard;
