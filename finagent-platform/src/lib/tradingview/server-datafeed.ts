// Server-side datafeed adapter for TradingView charts
// This replaces the client-side Polygon datafeed to avoid API key exposure

export interface ServerDatafeedConfig {
  baseUrl?: string;
}

export class ServerDatafeedAdapter {
  private baseUrl: string;

  constructor(config: ServerDatafeedConfig = {}) {
    this.baseUrl = config.baseUrl || '/api/polygon';
  }

  onReady(callback: (configurationData: any) => void) {
    const configuration = {
      supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
      supports_group_request: false,
      supports_marks: false,
      supports_search: true,
      supports_timescale_marks: false,
      exchanges: [
        { value: 'NASDAQ', name: 'NASDAQ', desc: 'NASDAQ' },
        { value: 'NYSE', name: 'NYSE', desc: 'New York Stock Exchange' },
      ],
      symbols_types: [
        { name: 'All types', value: '' },
        { name: 'Stock', value: 'stock' },
        { name: 'Index', value: 'index' },
      ],
    };

    setTimeout(() => callback(configuration), 0);
  }

  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: (symbols: any[]) => void
  ) {
    fetch(`${this.baseUrl}/search?query=${encodeURIComponent(userInput)}&limit=20`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.data.results) {
          const symbols = data.data.results.map((item: any) => ({
            symbol: item.ticker,
            full_name: `${item.primary_exchange}:${item.ticker}`,
            description: item.name || item.ticker,
            exchange: item.primary_exchange,
            ticker: item.ticker,
            type: item.type || 'stock',
          }));
          onResultReadyCallback(symbols);
        } else {
          onResultReadyCallback([]);
        }
      })
      .catch(error => {
        console.error('Symbol search failed:', error);
        onResultReadyCallback([]);
      });
  }

  resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: any) => void,
    onResolveErrorCallback: (reason: string) => void
  ) {
    const symbol = symbolName.split(':').pop() || symbolName;
    
    fetch(`${this.baseUrl}/ticker/${symbol}`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.data.results) {
          const symbolInfo = {
            ticker: data.data.results.ticker,
            name: data.data.results.ticker,
            description: data.data.results.name || data.data.results.ticker,
            type: data.data.results.type || 'stock',
            session: '0930-1600',
            timezone: 'America/New_York',
            exchange: data.data.results.primary_exchange || 'NASDAQ',
            minmov: 1,
            pricescale: 100,
            has_intraday: true,
            has_no_volume: false,
            has_weekly_and_monthly: true,
            supported_resolutions: ['1', '5', '15', '30', '60', '240', '1D', '1W', '1M'],
            volume_precision: 0,
            data_status: 'streaming',
          };
          onSymbolResolvedCallback(symbolInfo);
        } else {
          onResolveErrorCallback('Symbol not found');
        }
      })
      .catch(error => {
        console.error('Symbol resolution failed:', error);
        onResolveErrorCallback('Failed to resolve symbol');
      });
  }

  getBars(
    symbolInfo: any,
    resolution: string,
    periodParams: any,
    onHistoryCallback: (bars: any[], meta: any) => void,
    onErrorCallback: (error: string) => void
  ) {
    const { from, to, firstDataRequest } = periodParams;
    const fromDate = new Date(from * 1000).toISOString().split('T')[0];
    const toDate = new Date(to * 1000).toISOString().split('T')[0];

    // Convert TradingView resolution to Polygon format
    const getPolygonTimespan = (resolution: string) => {
      if (resolution.includes('D')) return 'day';
      if (resolution.includes('W')) return 'week';
      if (resolution.includes('M')) return 'month';
      const numericRes = parseInt(resolution);
      if (numericRes >= 60) return 'hour';
      return 'minute';
    };

    const getMultiplier = (resolution: string) => {
      if (resolution.includes('D')) return parseInt(resolution) || 1;
      if (resolution.includes('W')) return 1;
      if (resolution.includes('M')) return 1;
      const numericRes = parseInt(resolution);
      if (numericRes >= 60) return numericRes / 60;
      return numericRes;
    };

    const timespan = getPolygonTimespan(resolution);
    const multiplier = getMultiplier(resolution);

    const url = `${this.baseUrl}/bars?ticker=${symbolInfo.ticker}&multiplier=${multiplier}&timespan=${timespan}&from=${fromDate}&to=${toDate}&limit=1000`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.data.results) {
          const bars = data.data.results.map((bar: any) => ({
            time: bar.t,
            low: bar.l,
            high: bar.h,
            open: bar.o,
            close: bar.c,
            volume: bar.v,
          }));

          onHistoryCallback(bars, { noData: bars.length === 0 });
        } else {
          onHistoryCallback([], { noData: true });
        }
      })
      .catch(error => {
        console.error('Failed to fetch bars:', error);
        onErrorCallback('Failed to fetch historical data');
      });
  }

  subscribeBars() {
    // Real-time data subscription would be implemented here
    // For now, we'll skip real-time updates
  }

  unsubscribeBars() {
    // Unsubscribe from real-time updates
  }
}