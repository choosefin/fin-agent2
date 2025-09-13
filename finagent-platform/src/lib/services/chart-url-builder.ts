// Chart URL Builder Service
export interface ChartOptions {
  interval?: string;
  theme?: 'light' | 'dark';
  fullscreen?: boolean;
  studies?: string[];
  toolbar?: boolean;
  dateRanges?: boolean;
  hideSideToolbar?: boolean;
  allowSymbolChange?: boolean;
  saveImage?: boolean;
  containerId?: string;
  width?: number;
  height?: number;
  customParams?: Record<string, string>;
}

export class ChartUrlBuilder {
  private baseUrl: string;

  constructor(baseUrl: string = '/chart') {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a chart URL with query parameters
   */
  generateChartUrl(symbol: string, options: ChartOptions = {}): string {
    const params = new URLSearchParams({
      symbol: symbol,
      interval: options.interval || '1D',
      theme: options.theme || 'light',
      fullscreen: String(options.fullscreen || false),
      ...(options.studies && { studies: options.studies.join(',') }),
      ...(options.customParams || {}),
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Generate an embed URL for iframe integration
   */
  generateEmbedUrl(symbol: string, options: ChartOptions = {}): string {
    const params = new URLSearchParams({
      symbol: symbol,
      interval: options.interval || '1D',
      theme: options.theme || 'light',
      toolbar: String(options.toolbar !== false),
      withdateranges: String(options.dateRanges !== false),
      hide_side_toolbar: String(options.hideSideToolbar || false),
      allow_symbol_change: String(options.allowSymbolChange !== false),
      save_image: String(options.saveImage || false),
      container_id: options.containerId || 'tradingview_chart',
      ...(options.width && { width: String(options.width) }),
      ...(options.height && { height: String(options.height) }),
    });

    return `${this.baseUrl}/embed?${params.toString()}`;
  }

  /**
   * Generate a shareable chart link
   */
  generateShareableUrl(symbol: string, options: ChartOptions = {}): string {
    const baseShareUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseShareUrl}${this.generateChartUrl(symbol, options)}`;
  }

  /**
   * Generate TradingView native URL (external)
   */
  generateTradingViewUrl(symbol: string, interval: string = '1D'): string {
    const cleanSymbol = symbol.replace(':', '-');
    return `https://www.tradingview.com/chart/?symbol=${cleanSymbol}&interval=${interval}`;
  }

  /**
   * Parse chart URL to extract parameters
   */
  parseChartUrl(url: string): { symbol?: string; options: ChartOptions } {
    const urlObj = new URL(url, 'http://localhost');
    const params = urlObj.searchParams;

    const symbol = params.get('symbol') || undefined;
    const options: ChartOptions = {
      interval: params.get('interval') || undefined,
      theme: (params.get('theme') as 'light' | 'dark') || undefined,
      fullscreen: params.get('fullscreen') === 'true',
      toolbar: params.get('toolbar') !== 'false',
      dateRanges: params.get('withdateranges') !== 'false',
      hideSideToolbar: params.get('hide_side_toolbar') === 'true',
      allowSymbolChange: params.get('allow_symbol_change') !== 'false',
      saveImage: params.get('save_image') === 'true',
      containerId: params.get('container_id') || undefined,
      width: params.get('width') ? parseInt(params.get('width')!) : undefined,
      height: params.get('height') ? parseInt(params.get('height')!) : undefined,
    };

    // Parse studies if present
    const studies = params.get('studies');
    if (studies) {
      options.studies = studies.split(',');
    }

    return { symbol, options };
  }

  /**
   * Build chart configuration object for TradingView widget
   */
  buildChartConfig(symbol: string, options: ChartOptions = {}): Record<string, any> {
    return {
      symbol: symbol,
      interval: options.interval || '1D',
      theme: options.theme || 'light',
      style: '1', // Candlestick
      locale: 'en',
      toolbar_bg: options.theme === 'dark' ? '#1a1a1a' : '#f1f3f6',
      enable_publishing: false,
      allow_symbol_change: options.allowSymbolChange !== false,
      container_id: options.containerId || 'tradingview_chart',
      hideideas: true,
      hide_side_toolbar: options.hideSideToolbar || false,
      studies: options.studies || [],
      show_popup_button: true,
      popup_width: '1000',
      popup_height: '650',
      ...(options.width && { width: options.width }),
      ...(options.height && { height: options.height }),
    };
  }
}