'use client';

import React, { useState, useEffect } from 'react';
import TradingViewChart from '../charts/TradingViewChart';
import { ChartAgent } from '@/lib/agents/chart-agent';
import { FinancialDebateWorkflow } from '@/lib/workflows/debate-workflow';
import { AgentType } from '@/lib/agents/financial-agents';

interface ComparisonAsset {
  symbol: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  marketCap?: number;
}

interface ComparisonMetrics {
  performance: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  technical: {
    rsi: number;
    macd: string;
    movingAverage: string;
    support: number;
    resistance: number;
  };
  fundamental: {
    pe: number;
    eps: number;
    marketCap: number;
    volume: number;
    beta: number;
  };
  risk: {
    volatility: number;
    sharpe: number;
    maxDrawdown: number;
  };
}

interface AssetComparisonProps {
  symbols?: string[];
  theme?: 'light' | 'dark';
  userId?: string;
}

const AssetComparison: React.FC<AssetComparisonProps> = ({
  symbols: initialSymbols = [],
  theme = 'light',
  userId = 'anonymous',
}) => {
  const [assets, setAssets] = useState<ComparisonAsset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>(initialSymbols);
  const [comparisonData, setComparisonData] = useState<Map<string, ComparisonMetrics>>(new Map());
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'charts' | 'metrics' | 'analysis'>('charts');
  const [chartInterval, setChartInterval] = useState('1D');
  const [syncedTimeRange, setSyncedTimeRange] = useState<[number, number] | null>(null);

  // Load asset data
  useEffect(() => {
    if (selectedAssets.length > 0) {
      loadAssetData();
    }
  }, [selectedAssets]);

  const loadAssetData = async () => {
    setLoading(true);
    try {
      // Fetch asset data for each symbol
      const assetPromises = selectedAssets.map(async (symbol) => {
        const response = await fetch(`/api/chart/symbol/${symbol}`);
        const data = await response.json();
        return {
          symbol,
          ...data,
        };
      });

      const assetData = await Promise.all(assetPromises);
      setAssets(assetData);

      // Load comparison metrics
      await loadComparisonMetrics(selectedAssets);
    } catch (error) {
      console.error('Failed to load asset data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComparisonMetrics = async (symbols: string[]) => {
    const metrics = new Map<string, ComparisonMetrics>();
    
    // Mock metrics - in production, fetch from API
    symbols.forEach(symbol => {
      metrics.set(symbol, {
        performance: {
          daily: Math.random() * 10 - 5,
          weekly: Math.random() * 20 - 10,
          monthly: Math.random() * 30 - 15,
          yearly: Math.random() * 100 - 50,
        },
        technical: {
          rsi: Math.floor(Math.random() * 100),
          macd: Math.random() > 0.5 ? 'Bullish' : 'Bearish',
          movingAverage: Math.random() > 0.5 ? 'Above' : 'Below',
          support: Math.random() * 100 + 50,
          resistance: Math.random() * 100 + 100,
        },
        fundamental: {
          pe: Math.random() * 50 + 10,
          eps: Math.random() * 10,
          marketCap: Math.random() * 1000000000000,
          volume: Math.random() * 100000000,
          beta: Math.random() * 2,
        },
        risk: {
          volatility: Math.random() * 50,
          sharpe: Math.random() * 3 - 1,
          maxDrawdown: Math.random() * 30,
        },
      });
    });

    setComparisonData(metrics);
  };

  const runAIComparison = async () => {
    if (selectedAssets.length < 2) {
      alert('Please select at least 2 assets to compare');
      return;
    }

    setLoading(true);
    try {
      const workflow = new FinancialDebateWorkflow();
      const result = await workflow.execute({
        query: `Compare ${selectedAssets.join(' vs ')} across performance, technicals, fundamentals, and risk`,
        assistantType: AgentType.ANALYST,
        symbols: selectedAssets,
        userId,
        maxRounds: 3,
        requireConsensus: false,
      });

      setAiAnalysis(result);
      setActiveTab('analysis');
    } catch (error) {
      console.error('AI comparison failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const addAsset = (symbol: string) => {
    if (!selectedAssets.includes(symbol) && selectedAssets.length < 4) {
      setSelectedAssets([...selectedAssets, symbol.toUpperCase()]);
    }
  };

  const removeAsset = (symbol: string) => {
    setSelectedAssets(selectedAssets.filter(s => s !== symbol));
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const getColorForValue = (value: number, inverse: boolean = false): string => {
    if (inverse) value = -value;
    if (value > 0) return theme === 'dark' ? 'text-green-400' : 'text-green-600';
    if (value < 0) return theme === 'dark' ? 'text-red-400' : 'text-red-600';
    return theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  };

  return (
    <div className={`asset-comparison ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} rounded-lg shadow-lg`}>
      {/* Header */}
      <div className={`p-6 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h2 className={`text-2xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Asset Comparison
        </h2>
        
        {/* Asset Selector */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Add symbol (e.g., AAPL)"
            className={`px-4 py-2 rounded-lg border ${
              theme === 'dark' 
                ? 'bg-gray-800 border-gray-600 text-white' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addAsset((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
          <button
            onClick={runAIComparison}
            disabled={selectedAssets.length < 2 || loading}
            className={`px-4 py-2 rounded-lg font-medium ${
              selectedAssets.length >= 2 && !loading
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Analyzing...' : 'AI Compare'}
          </button>
        </div>

        {/* Selected Assets */}
        <div className="flex flex-wrap gap-2">
          {selectedAssets.map(symbol => (
            <div
              key={symbol}
              className={`px-3 py-1 rounded-full flex items-center gap-2 ${
                theme === 'dark' 
                  ? 'bg-gray-700 text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <span>{symbol}</span>
              <button
                onClick={() => removeAsset(symbol)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={`flex border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        {['charts', 'metrics', 'analysis'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-3 font-medium capitalize ${
              activeTab === tab
                ? theme === 'dark'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-blue-600 border-b-2 border-blue-600'
                : theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'charts' && (
          <div>
            {/* Chart Controls */}
            <div className="flex justify-between items-center mb-4">
              <select
                value={chartInterval}
                onChange={(e) => setChartInterval(e.target.value)}
                className={`px-3 py-1 rounded border ${
                  theme === 'dark'
                    ? 'bg-gray-800 border-gray-600 text-white'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="1">1 Min</option>
                <option value="5">5 Min</option>
                <option value="15">15 Min</option>
                <option value="60">1 Hour</option>
                <option value="1D">1 Day</option>
                <option value="1W">1 Week</option>
                <option value="1M">1 Month</option>
              </select>
              
              <button
                className={`px-4 py-2 rounded ${
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                Sync Charts
              </button>
            </div>

            {/* Chart Grid */}
            <div className={`grid ${selectedAssets.length <= 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-2'} gap-4`}>
              {selectedAssets.map(symbol => (
                <div key={symbol} className={`border rounded-lg ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <div className={`p-2 border-b ${
                    theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {symbol}
                    </h3>
                  </div>
                  <TradingViewChart
                    symbol={symbol}
                    theme={theme}
                    interval={chartInterval}
                    height={300}
                    showToolbar={false}
                    allowSymbolChange={false}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="overflow-x-auto">
            <table className={`w-full ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              <thead>
                <tr className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className="text-left py-2">Metric</th>
                  {selectedAssets.map(symbol => (
                    <th key={symbol} className="text-center py-2">{symbol}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Performance Metrics */}
                <tr className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  <td colSpan={selectedAssets.length + 1} className="py-2 font-semibold">
                    Performance
                  </td>
                </tr>
                {['daily', 'weekly', 'monthly', 'yearly'].map(period => (
                  <tr key={period} className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                    <td className="py-2 pl-4 capitalize">{period}</td>
                    {selectedAssets.map(symbol => {
                      const metrics = comparisonData.get(symbol);
                      const value = metrics?.performance[period as keyof typeof metrics.performance] || 0;
                      return (
                        <td key={symbol} className={`text-center py-2 ${getColorForValue(value)}`}>
                          {value > 0 ? '+' : ''}{value.toFixed(2)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Technical Indicators */}
                <tr className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  <td colSpan={selectedAssets.length + 1} className="py-2 font-semibold">
                    Technical
                  </td>
                </tr>
                {['rsi', 'macd', 'movingAverage'].map(indicator => (
                  <tr key={indicator} className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                    <td className="py-2 pl-4 capitalize">{indicator}</td>
                    {selectedAssets.map(symbol => {
                      const metrics = comparisonData.get(symbol);
                      const value = metrics?.technical[indicator as keyof typeof metrics.technical];
                      return (
                        <td key={symbol} className="text-center py-2">
                          {typeof value === 'number' ? value.toFixed(0) : value}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Risk Metrics */}
                <tr className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  <td colSpan={selectedAssets.length + 1} className="py-2 font-semibold">
                    Risk
                  </td>
                </tr>
                {['volatility', 'sharpe', 'maxDrawdown'].map(risk => (
                  <tr key={risk} className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                    <td className="py-2 pl-4 capitalize">{risk}</td>
                    {selectedAssets.map(symbol => {
                      const metrics = comparisonData.get(symbol);
                      const value = metrics?.risk[risk as keyof typeof metrics.risk] || 0;
                      return (
                        <td key={symbol} className="text-center py-2">
                          {value.toFixed(2)}{risk === 'volatility' || risk === 'maxDrawdown' ? '%' : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div>
            {aiAnalysis ? (
              <div className={`space-y-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                  <h3 className="font-semibold mb-2">AI Consensus</h3>
                  <p>{aiAnalysis.recommendation?.summary}</p>
                  <div className="mt-2">
                    <span className="text-sm">Confidence: </span>
                    <span className={`font-medium ${
                      aiAnalysis.confidence > 0.7 ? 'text-green-500' : 'text-yellow-500'
                    }`}>
                      {(aiAnalysis.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {aiAnalysis.recommendation?.keyPoints && (
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <h3 className="font-semibold mb-2">Key Points</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {aiAnalysis.recommendation.keyPoints.map((point: string, index: number) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiAnalysis.recommendation?.considerations && (
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <h3 className="font-semibold mb-2">Considerations</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {aiAnalysis.recommendation.considerations.map((consideration: string, index: number) => (
                        <li key={index}>{consideration}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                <p>Run AI comparison to see analysis</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetComparison;