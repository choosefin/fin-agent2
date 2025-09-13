'use client';

import React from 'react';

interface ChartLinkProps {
  symbol: string;
  resolvedSymbol: string;
  chartUrl: string;
  embedUrl?: string;
  tradingViewUrl?: string;
  description: string;
  theme?: 'light' | 'dark';
  onOpenChart?: (url: string) => void;
}

const ChartLink: React.FC<ChartLinkProps> = ({
  symbol,
  resolvedSymbol,
  chartUrl,
  embedUrl,
  tradingViewUrl,
  description,
  theme = 'light',
  onOpenChart,
}) => {
  const handleChartClick = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    
    if (onOpenChart) {
      onOpenChart(url);
    } else {
      // Open in new window with specific dimensions
      window.open(url, '_blank', 'width=1200,height=800,toolbar=no,menubar=no');
    }
  };

  const handleTradingViewClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (tradingViewUrl) {
      window.open(tradingViewUrl, '_blank');
    }
  };

  return (
    <div className={`chart-link-container rounded-lg border transition-all hover:shadow-lg ${
      theme === 'dark'
        ? 'bg-gray-800 border-gray-700 hover:border-blue-500'
        : 'bg-white border-gray-200 hover:border-blue-400'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'
            }`}>
              <svg
                className={`w-6 h-6 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {symbol}
              </h3>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {description}
              </p>
            </div>
          </div>
          
          {resolvedSymbol.includes(':') && (
            <span className={`px-2 py-1 text-xs rounded-full ${
              theme === 'dark'
                ? 'bg-gray-700 text-gray-300'
                : 'bg-gray-100 text-gray-700'
            }`}>
              {resolvedSymbol.split(':')[0]}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => handleChartClick(e, chartUrl)}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            aria-label={`Open chart for ${symbol}`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              View Chart
            </span>
          </button>

          {embedUrl && (
            <button
              onClick={(e) => handleChartClick(e, embedUrl)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
              aria-label={`Embed chart for ${symbol}`}
              title="Open embedded view"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </button>
          )}

          {tradingViewUrl && (
            <button
              onClick={handleTradingViewClick}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}
              aria-label={`Open ${symbol} on TradingView`}
              title="Open on TradingView"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChartLink;