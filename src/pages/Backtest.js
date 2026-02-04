import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle, TrendingUp, BarChart3, Target, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import StatCard from '../components/StatCard';

function Backtest() {
  const [backtestData, setBacktestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBacktestData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/backtest?limit=20&days=365');
      if (!response.ok) throw new Error('Failed to fetch backtest data');
      const data = await response.json();
      setBacktestData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBacktestData();
  }, []);

  const forwardReturnsChartData = backtestData?.aggregate?.forwardReturns
    ? Object.entries(backtestData.aggregate.forwardReturns).map(([horizon, data]) => ({
        name: horizon,
        winRate: data.winRate,
        trades: data.total
      }))
    : [];

  const symbolChartData = backtestData?.symbolResults?.slice(0, 10).map(s => ({
    name: s.baseAsset,
    winRate: s.winRate,
    signals: s.totalSignals
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Backtest Results</h1>
          <p className="text-slate-400 mt-1">
            Historical performance analysis of RSI strategy
          </p>
        </div>
        <button
          onClick={fetchBacktestData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running...' : 'Run Backtest'}
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

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="spinner" />
          <p className="text-slate-400">Running backtest on historical data...</p>
        </div>
      ) : backtestData && (
        <>
          {/* Aggregate Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Signals"
              value={backtestData.aggregate?.totalSignals || 0}
              subtitle="RSI oversold events"
              icon={Target}
              color="sky"
            />
            <StatCard
              title="Overall Win Rate"
              value={`${backtestData.aggregate?.winRate || 0}%`}
              subtitle={`${backtestData.aggregate?.totalWins || 0} wins / ${backtestData.aggregate?.totalLosses || 0} losses`}
              icon={TrendingUp}
              color={backtestData.aggregate?.winRate > 50 ? 'green' : 'red'}
            />
            <StatCard
              title="Avg Return"
              value={`${backtestData.aggregate?.avgReturn > 0 ? '+' : ''}${backtestData.aggregate?.avgReturn || 0}%`}
              subtitle="Per trade"
              icon={BarChart3}
              color={backtestData.aggregate?.avgReturn > 0 ? 'green' : 'red'}
            />
            <StatCard
              title="Symbols Tested"
              value={backtestData.totalSymbols || 0}
              subtitle="Top coins by volume"
              icon={Clock}
              color="purple"
            />
          </div>

          {/* Forward Returns Chart */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Forward Returns Win Rate by Horizon</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forwardReturnsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f8fafc' }}
                  />
                  <Bar dataKey="winRate" name="Win Rate" radius={[4, 4, 0, 0]}>
                    {forwardReturnsChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.winRate >= 50 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-4 mt-4">
              {forwardReturnsChartData.map(item => (
                <div key={item.name} className="text-center">
                  <p className="text-slate-400 text-sm">{item.name}</p>
                  <p className={`text-lg font-bold ${item.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {item.winRate}%
                  </p>
                  <p className="text-slate-500 text-xs">{item.trades} trades</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top Performing Symbols */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Top Performing Symbols</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symbolChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" width={60} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    labelStyle={{ color: '#f8fafc' }}
                  />
                  <Bar dataKey="winRate" name="Win Rate" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Symbol Results Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">All Symbol Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Symbol</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Signals</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Win Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Avg Return</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">1W Win%</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">1M Win%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {backtestData.symbolResults?.map((result, index) => (
                    <tr key={index} className="hover:bg-slate-700/50">
                      <td className="px-6 py-4 font-medium text-white">{result.baseAsset}</td>
                      <td className="px-6 py-4 text-right text-slate-300">{result.totalSignals}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={result.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
                          {result.winRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={result.avgReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {result.avgReturn > 0 ? '+' : ''}{result.avgReturn}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        {result.forwardReturns?.['1W']?.winRate || '-'}%
                      </td>
                      <td className="px-6 py-4 text-right text-slate-300">
                        {result.forwardReturns?.['1M']?.winRate || '-'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Backtest;
