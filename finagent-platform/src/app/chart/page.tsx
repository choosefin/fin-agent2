'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TradingViewChart from '@/components/charts/TradingViewChart';

function ChartContent() {
  const searchParams = useSearchParams();
  const [chartConfig, setChartConfig] = useState({
    symbol: 'NASDAQ:AAPL',
    interval: '1D',
    theme: 'light' as 'light' | 'dark',
    fullscreen: false,
  });

  useEffect(() => {
    const symbol = searchParams.get('symbol') || 'NASDAQ:AAPL';
    const interval = searchParams.get('interval') || '1D';
    const theme = (searchParams.get('theme') as 'light' | 'dark') || 'light';
    const fullscreen = searchParams.get('fullscreen') === 'true';

    setChartConfig({ symbol, interval, theme, fullscreen });

    // Apply theme to body
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [searchParams]);

  return (
    <div className={`min-h-screen ${
      chartConfig.theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
    }`}>
      {!chartConfig.fullscreen && (
        <header className={`border-b ${
          chartConfig.theme === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <h1 className={`text-xl font-bold ${
                  chartConfig.theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  FinAgent Charts
                </h1>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  chartConfig.theme === 'dark'
                    ? 'bg-blue-900/30 text-blue-400'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {chartConfig.symbol}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <select
                  value={chartConfig.interval}
                  onChange={(e) => {
                    const newInterval = e.target.value;
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('interval', newInterval);
                    window.history.replaceState(null, '', `?${params.toString()}`);
                    setChartConfig(prev => ({ ...prev, interval: newInterval }));
                  }}
                  className={`px-3 py-1 rounded border ${
                    chartConfig.theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="1">1 Minute</option>
                  <option value="5">5 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                  <option value="1D">1 Day</option>
                  <option value="1W">1 Week</option>
                  <option value="1M">1 Month</option>
                </select>

                <button
                  onClick={() => {
                    const newTheme = chartConfig.theme === 'dark' ? 'light' : 'dark';
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('theme', newTheme);
                    window.history.replaceState(null, '', `?${params.toString()}`);
                    setChartConfig(prev => ({ ...prev, theme: newTheme }));
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    chartConfig.theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  aria-label="Toggle theme"
                >
                  {chartConfig.theme === 'dark' ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('fullscreen', 'true');
                    window.history.replaceState(null, '', `?${params.toString()}`);
                    setChartConfig(prev => ({ ...prev, fullscreen: true }));
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    chartConfig.theme === 'dark'
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  aria-label="Fullscreen"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className={chartConfig.fullscreen ? 'h-screen' : 'container mx-auto px-4 py-8'}>
        <TradingViewChart
          symbol={chartConfig.symbol}
          theme={chartConfig.theme}
          interval={chartConfig.interval}
          height={chartConfig.fullscreen ? window.innerHeight : 600}
          showToolbar={true}
          allowSymbolChange={true}
        />
      </main>

      {chartConfig.fullscreen && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('fullscreen');
            window.history.replaceState(null, '', `?${params.toString()}`);
            setChartConfig(prev => ({ ...prev, fullscreen: false }));
          }}
          className="fixed top-4 right-4 z-50 p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
          aria-label="Exit fullscreen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function ChartPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <ChartContent />
    </Suspense>
  );
}