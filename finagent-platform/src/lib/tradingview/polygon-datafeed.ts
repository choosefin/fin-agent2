// Polygon.io Data Feed Adapter for TradingView
import axios from 'axios';

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SymbolInfo {
  ticker: string;
  name: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  supported_resolutions: string[];
  volume_precision: number;
  data_status: string;
}

interface SearchSymbolResult {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  type: string;
}

export class PolygonDatafeedAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://api.polygon.io';
  private supportedResolutions: string[] = ['1', '5', '15', '30', '60', '1D', '1W', '1M'];
  private wsConnection: WebSocket | null = null;
  private subscriptions: Map<string, (bar: Bar) => void> = new Map();

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // TradingView Datafeed Interface Methods
  onReady(callback: (configuration: any) => void): void {
    setTimeout(() => {
      callback({
        supported_resolutions: this.supportedResolutions,
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        exchanges: [
          { value: 'NASDAQ', name: 'NASDAQ', desc: 'NASDAQ Exchange' },
          { value: 'NYSE', name: 'NYSE', desc: 'New York Stock Exchange' },
          { value: 'CRYPTO', name: 'CRYPTO', desc: 'Cryptocurrency' },
        ],
        symbols_types: [
          { name: 'Stock', value: 'stock' },
          { name: 'Crypto', value: 'crypto' },
          { name: 'Forex', value: 'forex' },
        ],
      });
    }, 0);
  }

  async searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: (results: SearchSymbolResult[]) => void
  ): Promise<void> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v3/reference/tickers`,
        {
          params: {
            search: userInput,
            type: symbolType,
            exchange: exchange,
            apikey: this.apiKey,
            limit: 30,
          },
        }
      );

      const results: SearchSymbolResult[] = response.data.results?.map((item: any) => ({
        symbol: item.ticker,
        full_name: `${item.primary_exchange}:${item.ticker}`,
        description: item.name || item.ticker,
        exchange: item.primary_exchange || 'UNKNOWN',
        type: item.type || 'stock',
      })) || [];

      onResultReadyCallback(results);
    } catch (error) {
      console.error('Symbol search error:', error);
      onResultReadyCallback([]);
    }
  }

  resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: SymbolInfo) => void,
    onResolveErrorCallback: (reason: string) => void
  ): void {
    const [exchange, ticker] = symbolName.includes(':') 
      ? symbolName.split(':') 
      : ['', symbolName];

    axios
      .get(`${this.baseUrl}/v3/reference/tickers/${ticker || symbolName}`, {
        params: { apikey: this.apiKey },
      })
      .then((response) => {
        const data = response.data.results;
        if (!data) {
          onResolveErrorCallback('Symbol not found');
          return;
        }

        const symbolInfo: SymbolInfo = {
          ticker: data.ticker,
          name: data.ticker,
          description: data.name || data.ticker,
          type: data.type || 'stock',
          session: '0930-1600',
          timezone: 'America/New_York',
          exchange: data.primary_exchange || 'UNKNOWN',
          minmov: 1,
          pricescale: 100,
          has_intraday: true,
          supported_resolutions: this.supportedResolutions,
          volume_precision: 0,
          data_status: 'streaming',
        };

        onSymbolResolvedCallback(symbolInfo);
      })
      .catch((error) => {
        console.error('Symbol resolution error:', error);
        onResolveErrorCallback('Symbol resolution failed');
      });
  }

  async getBars(
    symbolInfo: SymbolInfo,
    resolution: string,
    periodParams: { from: number; to: number; firstDataRequest: boolean },
    onHistoryCallback: (bars: Bar[], meta?: { noData: boolean }) => void,
    onErrorCallback: (reason: string) => void
  ): Promise<void> {
    try {
      const { from, to } = periodParams;
      const multiplier = this.getMultiplier(resolution);
      const timespan = this.getTimespan(resolution);

      const response = await axios.get(
        `${this.baseUrl}/v2/aggs/ticker/${symbolInfo.ticker}/range/${multiplier}/${timespan}/${from * 1000}/${to * 1000}`,
        {
          params: {
            apikey: this.apiKey,
            sort: 'asc',
            limit: 50000,
          },
        }
      );

      if (!response.data.results || response.data.results.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      const bars: Bar[] = response.data.results.map((bar: any) => ({
        time: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v || 0,
      }));

      onHistoryCallback(bars);
    } catch (error) {
      console.error('Get bars error:', error);
      onErrorCallback('Failed to load historical data');
    }
  }

  subscribeBars(
    symbolInfo: SymbolInfo,
    resolution: string,
    onRealtimeCallback: (bar: Bar) => void,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ): void {
    this.subscriptions.set(subscriberUID, onRealtimeCallback);
    
    if (!this.wsConnection) {
      this.connectWebSocket();
    }

    // Subscribe to the symbol via WebSocket
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(
        JSON.stringify({
          action: 'subscribe',
          params: `T.${symbolInfo.ticker}`,
        })
      );
    }
  }

  unsubscribeBars(subscriberUID: string): void {
    this.subscriptions.delete(subscriberUID);
    
    if (this.subscriptions.size === 0 && this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  private connectWebSocket(): void {
    const wsUrl = `wss://socket.polygon.io/stocks`;
    
    this.wsConnection = new WebSocket(wsUrl);

    this.wsConnection.onopen = () => {
      // Authenticate
      this.wsConnection?.send(
        JSON.stringify({
          action: 'auth',
          params: this.apiKey,
        })
      );
    };

    this.wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (Array.isArray(data)) {
          data.forEach((message) => {
            if (message.ev === 'T') {
              // Trade message
              const bar: Bar = {
                time: message.t,
                open: message.p,
                high: message.p,
                low: message.p,
                close: message.p,
                volume: message.s || 0,
              };

              // Notify all subscribers
              this.subscriptions.forEach((callback) => {
                callback(bar);
              });
            }
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    this.wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.wsConnection.onclose = () => {
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (this.subscriptions.size > 0) {
          this.connectWebSocket();
        }
      }, 5000);
    };
  }

  private getMultiplier(resolution: string): number {
    const match = resolution.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 1;
  }

  private getTimespan(resolution: string): string {
    if (resolution.includes('D')) return 'day';
    if (resolution.includes('W')) return 'week';
    if (resolution.includes('M')) return 'month';
    return 'minute';
  }
}