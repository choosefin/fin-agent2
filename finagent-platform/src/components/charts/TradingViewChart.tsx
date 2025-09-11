'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { ServerDatafeedAdapter } from '@/lib/tradingview/server-datafeed';
import ErrorBoundary from '@/components/error/ErrorBoundary';
import ChartErrorFallback from '@/components/error/ChartErrorFallback';
import { trackChartError, trackChartLoad } from '@/lib/monitoring/error-tracking';

declare global {
  interface Window {
    TradingView: any;
    ServerDatafeedAdapter: typeof ServerDatafeedAdapter;
  }
}

interface TradingViewChartProps {
  symbol: string;
  theme?: 'light' | 'dark';
  height?: number;
  interval?: string;
  containerId?: string;
  showToolbar?: boolean;
  allowSymbolChange?: boolean;
  studies?: string[];
}

const TradingViewChart: React.FC<TradingViewChartProps> = ({
  symbol,
  theme = 'light',
  height = 600,
  interval = '1D',
  containerId = 'tradingview_chart',
  showToolbar = true,
  allowSymbolChange = true,
  studies = [],
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [loadStartTime] = useState(Date.now());

  useEffect(() => {
    // Make ServerDatafeedAdapter available globally
    window.ServerDatafeedAdapter = ServerDatafeedAdapter;

    const loadChart = async () => {
      if (!chartContainerRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        // Check if TradingView library is already loaded
        if (!window.TradingView) {
          // In production, you would load the actual TradingView library
          // For now, we'll create a placeholder
          console.warn('TradingView library not loaded. Using placeholder.');
          setIsLoading(false);
          return;
        }

        // Initialize TradingView widget with memoized configuration
        widgetRef.current = new window.TradingView.widget({
          ...widgetConfig,
          container: chartContainerRef.current,
        });

        // Add initial studies if specified
        if (widgetRef.current && studies.length > 0) {
          widgetRef.current.onChartReady(() => {
            const chart = widgetRef.current.activeChart();
            studies.forEach((study) => {
              chart.createStudy(study, false, false);
            });
          });
        }

        setIsLoading(false);
        
        // Track successful chart load
        const loadTime = Date.now() - loadStartTime;
        trackChartLoad(symbol, loadTime);
      } catch (err) {
        console.error('Failed to initialize TradingView chart:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load chart. Please try again.';
        setError(errorMessage);
        setIsLoading(false);
        
        // Track chart error
        if (err instanceof Error) {
          trackChartError(err, symbol, 'chart_initialization');
        }
        
        // Optional: Auto-retry logic for transient errors
        if (retryCount < 2 && err instanceof Error) {
          const isTransientError = err.message.includes('Network') || 
                                   err.message.includes('timeout') || 
                                   err.message.includes('fetch');
          
          if (isTransientError) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              setError(null);
            }, 2000 * (retryCount + 1)); // Exponential backoff
          }
        }
      }
    };

    loadChart();

    // Cleanup
    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch (err) {
          console.error('Error removing widget:', err);
        }
      }
    };
  }, [widgetConfig, studies, retryCount]);

  const handleRetry = useCallback(() => {
    setError(null);
    setRetryCount(prev => prev + 1);
  }, []);

  // Memoize the datafeed adapter to avoid recreating it
  const datafeedAdapter = useMemo(() => {
    return new ServerDatafeedAdapter();
  }, []);

  // Memoize widget configuration to prevent unnecessary re-renders
  const widgetConfig = useMemo(() => ({
    library_path: '/charting_library/',
    locale: 'en',
    disabled_features: ['use_localstorage_for_settings'],
    enabled_features: ['study_templates'],
    charts_storage_url: 'https://saveload.tradingview.com',
    charts_storage_api_version: '1.1',
    client_id: 'finagent-platform',
    user_id: 'public_user',
    fullscreen: false,
    autosize: true,
    symbol: symbol,
    interval: interval,
    datafeed: datafeedAdapter,
    theme: theme,
    style: '1',
    toolbar_bg: theme === 'dark' ? '#1a1a1a' : '#f1f3f6',
    loading_screen: { 
      backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
      foregroundColor: theme === 'dark' ? '#ffffff' : '#000000',
    },
    overrides: theme === 'dark' ? {
      'paneProperties.background': '#1a1a1a',
      'paneProperties.vertGridProperties.color': '#2a2a2a',
      'paneProperties.horzGridProperties.color': '#2a2a2a',
      'symbolWatermarkProperties.transparency': 90,
      'scalesProperties.textColor': '#AAA',
      'mainSeriesProperties.candleStyle.wickUpColor': '#26a69a',
      'mainSeriesProperties.candleStyle.wickDownColor': '#ef5350',
    } : {},
    studies_overrides: {},
    time_frames: [
      { text: '1D', resolution: '1', description: '1 Day' },
      { text: '5D', resolution: '5', description: '5 Days' },
      { text: '1M', resolution: '60', description: '1 Month' },
      { text: '3M', resolution: '1D', description: '3 Months' },
      { text: '6M', resolution: '1D', description: '6 Months' },
      { text: '1Y', resolution: '1W', description: '1 Year' },
      { text: '5Y', resolution: '1M', description: '5 Years' },
    ],
    hide_side_toolbar: !showToolbar,
    allow_symbol_change: allowSymbolChange,
  }), [symbol, interval, datafeedAdapter, theme, showToolbar, allowSymbolChange]);

  // Memoize placeholder UI to prevent unnecessary re-renders
  const renderPlaceholder = useMemo(() => (
    <div className={`flex flex-col items-center justify-center h-full rounded-lg border ${
      theme === 'dark' 
        ? 'bg-gray-900 border-gray-700 text-white' 
        : 'bg-gray-50 border-gray-200 text-gray-900'
    }`}>
      <svg
        className="w-16 h-16 mb-4 text-gray-400"
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
      <h3 className="text-xl font-semibold mb-2">{symbol} Chart</h3>
      <p className="text-sm text-gray-500">
        Interactive chart powered by TradingView
      </p>
      <div className="mt-4 flex gap-2">
        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
          {interval}
        </span>
        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs">
          Live Data
        </span>
      </div>
    </div>
  ), [symbol, interval, theme]);

  return (
    <ErrorBoundary 
      fallback={<ChartErrorFallback symbol={symbol} />}
      onError={(error, errorInfo) => {
        console.error('TradingViewChart Error Boundary:', error, errorInfo);
        trackChartError(error, symbol, 'error_boundary');
      }}
    >
      <div className="relative w-full" style={{ height: `${height}px` }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" role="status" aria-label="Loading chart"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading chart...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 z-10">
            <ChartErrorFallback 
              error={new Error(error)} 
              reset={handleRetry}
              symbol={symbol}
            />
          </div>
        )}

        <div
          ref={chartContainerRef}
          id={containerId}
          className="w-full h-full"
        >
          {!window.TradingView && renderPlaceholder()}
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Wrap with React.memo for performance optimization
export default React.memo(TradingViewChart);