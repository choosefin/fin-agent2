import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TradingViewChart from '../TradingViewChart';

// Mock the ServerDatafeedAdapter
jest.mock('@/lib/tradingview/server-datafeed', () => ({
  ServerDatafeedAdapter: jest.fn().mockImplementation(() => ({
    onReady: jest.fn(),
    searchSymbols: jest.fn(),
    resolveSymbol: jest.fn(),
    getBars: jest.fn(),
  })),
}));

describe('TradingViewChart', () => {
  const defaultProps = {
    symbol: 'AAPL',
  };

  beforeEach(() => {
    // Clear any global TradingView mock
    delete (global as any).window;
    Object.defineProperty(global, 'window', {
      value: {
        TradingView: null,
        ServerDatafeedAdapter: jest.fn(),
      },
      writable: true,
    });
  });

  it('should render placeholder when TradingView library is not loaded', () => {
    render(<TradingViewChart {...defaultProps} />);
    
    expect(screen.getByText('AAPL Chart')).toBeInTheDocument();
    expect(screen.getByText('Interactive chart powered by TradingView')).toBeInTheDocument();
    expect(screen.getByText('1D')).toBeInTheDocument();
    expect(screen.getByText('Live Data')).toBeInTheDocument();
  });

  it('should display loading state initially', () => {
    render(<TradingViewChart {...defaultProps} />);
    
    expect(screen.getByText('Loading chart...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('should apply dark theme styles', () => {
    render(<TradingViewChart {...defaultProps} theme="dark" />);
    
    const placeholder = screen.getByText('AAPL Chart').closest('div');
    expect(placeholder).toHaveClass('bg-gray-900', 'border-gray-700', 'text-white');
  });

  it('should apply light theme styles', () => {
    render(<TradingViewChart {...defaultProps} theme="light" />);
    
    const placeholder = screen.getByText('AAPL Chart').closest('div');
    expect(placeholder).toHaveClass('bg-gray-50', 'border-gray-200', 'text-gray-900');
  });

  it('should display custom height', () => {
    render(<TradingViewChart {...defaultProps} height={800} />);
    
    const container = screen.getByText('AAPL Chart').closest('.relative');
    expect(container).toHaveStyle('height: 800px');
  });

  it('should display custom interval in placeholder', () => {
    render(<TradingViewChart {...defaultProps} interval="5" />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should handle error state correctly', async () => {
    // Mock TradingView to exist but throw an error
    Object.defineProperty(global.window, 'TradingView', {
      value: {
        widget: jest.fn().mockImplementation(() => {
          throw new Error('Failed to create widget');
        }),
      },
      writable: true,
    });

    render(<TradingViewChart {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load chart. Please try again.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });
  });

  it('should initialize TradingView widget when library is available', async () => {
    const mockWidget = {
      onChartReady: jest.fn(),
      remove: jest.fn(),
    };
    
    const mockTradingViewWidget = jest.fn().mockReturnValue(mockWidget);
    
    Object.defineProperty(global.window, 'TradingView', {
      value: {
        widget: mockTradingViewWidget,
      },
      writable: true,
    });

    render(<TradingViewChart {...defaultProps} />);

    await waitFor(() => {
      expect(mockTradingViewWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'AAPL',
          interval: '1D',
          theme: 'light',
        })
      );
    });
  });

  it('should add studies when specified', async () => {
    const mockChart = {
      createStudy: jest.fn(),
    };
    
    const mockWidget = {
      onChartReady: jest.fn((callback) => {
        // Simulate chart ready
        callback();
      }),
      activeChart: jest.fn().mockReturnValue(mockChart),
      remove: jest.fn(),
    };
    
    Object.defineProperty(global.window, 'TradingView', {
      value: {
        widget: jest.fn().mockReturnValue(mockWidget),
      },
      writable: true,
    });

    render(<TradingViewChart {...defaultProps} studies={['RSI', 'MACD']} />);

    await waitFor(() => {
      expect(mockChart.createStudy).toHaveBeenCalledWith('RSI', false, false);
      expect(mockChart.createStudy).toHaveBeenCalledWith('MACD', false, false);
    });
  });

  it('should cleanup widget on unmount', async () => {
    const mockWidget = {
      onChartReady: jest.fn(),
      remove: jest.fn(),
    };
    
    Object.defineProperty(global.window, 'TradingView', {
      value: {
        widget: jest.fn().mockReturnValue(mockWidget),
      },
      writable: true,
    });

    const { unmount } = render(<TradingViewChart {...defaultProps} />);
    
    await waitFor(() => {
      expect(global.window.TradingView.widget).toHaveBeenCalled();
    });

    unmount();

    expect(mockWidget.remove).toHaveBeenCalled();
  });

  it('should handle widget removal errors gracefully', async () => {
    const mockWidget = {
      onChartReady: jest.fn(),
      remove: jest.fn().mockImplementation(() => {
        throw new Error('Failed to remove widget');
      }),
    };
    
    Object.defineProperty(global.window, 'TradingView', {
      value: {
        widget: jest.fn().mockReturnValue(mockWidget),
      },
      writable: true,
    });

    // Mock console.error to avoid cluttering test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = render(<TradingViewChart {...defaultProps} />);
    
    await waitFor(() => {
      expect(global.window.TradingView.widget).toHaveBeenCalled();
    });

    unmount();

    expect(consoleSpy).toHaveBeenCalledWith('Error removing widget:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });

  it('should use custom container ID when provided', async () => {
    const customId = 'custom-chart-container';
    render(<TradingViewChart {...defaultProps} containerId={customId} />);
    
    const container = document.getElementById(customId);
    expect(container).toBeInTheDocument();
  });

  it('should configure toolbar visibility', async () => {
    const mockWidget = {
      onChartReady: jest.fn(),
      remove: jest.fn(),
    };
    
    Object.defineProperty(global.window, 'TradingView', {
      value: {
        widget: jest.fn().mockReturnValue(mockWidget),
      },
      writable: true,
    });

    render(<TradingViewChart {...defaultProps} showToolbar={false} />);

    await waitFor(() => {
      expect(global.window.TradingView.widget).toHaveBeenCalledWith(
        expect.objectContaining({
          hide_side_toolbar: true,
        })
      );
    });
  });
});