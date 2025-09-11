'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PolygonDatafeedAdapter } from '@/lib/tradingview/polygon-datafeed';

declare global {
  interface Window {
    TradingView: any;
    PolygonDatafeedAdapter: typeof PolygonDatafeedAdapter;
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

  useEffect(() => {
    // Make PolygonDatafeedAdapter available globally
    window.PolygonDatafeedAdapter = PolygonDatafeedAdapter;

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

        // Create datafeed instance
        const datafeed = new PolygonDatafeedAdapter(
          process.env.NEXT_PUBLIC_POLYGON_API_KEY || ''
        );

        // Initialize TradingView widget
        widgetRef.current = new window.TradingView.widget({
          container: chartContainerRef.current,
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
          datafeed: datafeed,
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
      } catch (err) {
        console.error('Failed to initialize TradingView chart:', err);
        setError('Failed to load chart. Please try again.');
        setIsLoading(false);
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
  }, [symbol, theme, interval, showToolbar, allowSymbolChange, studies]);

  // Placeholder UI when TradingView library is not available
  const renderPlaceholder = () => (
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
  );

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading chart...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-10">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
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
  );
};

export default TradingViewChart;