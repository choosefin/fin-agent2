'use client';

import React from 'react';

interface ChartErrorFallbackProps {
  error?: Error;
  reset?: () => void;
  symbol?: string;
}

const ChartErrorFallback: React.FC<ChartErrorFallbackProps> = ({ 
  error, 
  reset, 
  symbol = 'Chart' 
}) => {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="text-center">
        {/* Chart error icon */}
        <svg
          className="w-16 h-16 mx-auto mb-4 text-orange-500"
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01"
          />
        </svg>
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Failed to Load {symbol} Chart
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          We couldn't load the chart data. This might be due to network issues or invalid symbol information.
        </p>

        {/* Error message for development */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 max-w-md">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Error:</strong> {error.message}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          {reset && (
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Retry Chart
            </button>
          )}
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Refresh Page
          </button>
        </div>

        {/* Alternative actions */}
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <p>
            You can try:{' '}
            <a
              href={`/?symbol=${encodeURIComponent(symbol)}`}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              searching for a different symbol
            </a>{' '}
            or{' '}
            <a
              href="/help"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              getting help
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChartErrorFallback;