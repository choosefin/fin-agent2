import { ChartUrlBuilder } from '../chart-url-builder';

describe('ChartUrlBuilder', () => {
  let builder: ChartUrlBuilder;

  beforeEach(() => {
    builder = new ChartUrlBuilder('/chart');
  });

  describe('generateChartUrl', () => {
    it('should generate basic chart URL with symbol', () => {
      const url = builder.generateChartUrl('AAPL');
      
      expect(url).toContain('/chart?');
      expect(url).toContain('symbol=AAPL');
      expect(url).toContain('interval=1D');
      expect(url).toContain('theme=light');
      expect(url).toContain('fullscreen=false');
    });

    it('should include custom options in URL', () => {
      const url = builder.generateChartUrl('MSFT', {
        interval: '1H',
        theme: 'dark',
        fullscreen: true,
        studies: ['RSI', 'MACD'],
      });
      
      expect(url).toContain('symbol=MSFT');
      expect(url).toContain('interval=1H');
      expect(url).toContain('theme=dark');
      expect(url).toContain('fullscreen=true');
      expect(url).toContain('studies=RSI%2CMACD');
    });

    it('should handle custom parameters', () => {
      const url = builder.generateChartUrl('GOOGL', {
        customParams: {
          customKey: 'customValue',
          anotherKey: 'anotherValue',
        },
      });
      
      expect(url).toContain('customKey=customValue');
      expect(url).toContain('anotherKey=anotherValue');
    });
  });

  describe('generateEmbedUrl', () => {
    it('should generate embed URL with default options', () => {
      const url = builder.generateEmbedUrl('TSLA');
      
      expect(url).toContain('/chart/embed?');
      expect(url).toContain('symbol=TSLA');
      expect(url).toContain('toolbar=true');
      expect(url).toContain('withdateranges=true');
      expect(url).toContain('allow_symbol_change=true');
    });

    it('should include dimensions in embed URL', () => {
      const url = builder.generateEmbedUrl('NVDA', {
        width: 800,
        height: 600,
      });
      
      expect(url).toContain('width=800');
      expect(url).toContain('height=600');
    });
  });

  describe('parseChartUrl', () => {
    it('should parse basic chart URL', () => {
      const url = '/chart?symbol=AAPL&interval=1D&theme=dark';
      const { symbol, options } = builder.parseChartUrl(url);
      
      expect(symbol).toBe('AAPL');
      expect(options.interval).toBe('1D');
      expect(options.theme).toBe('dark');
    });

    it('should parse complex chart URL with studies', () => {
      const url = '/chart?symbol=MSFT&interval=1H&theme=light&studies=RSI,MACD,BB&fullscreen=true';
      const { symbol, options } = builder.parseChartUrl(url);
      
      expect(symbol).toBe('MSFT');
      expect(options.studies).toEqual(['RSI', 'MACD', 'BB']);
      expect(options.fullscreen).toBe(true);
    });

    it('should handle missing parameters', () => {
      const url = '/chart';
      const { symbol, options } = builder.parseChartUrl(url);
      
      expect(symbol).toBeUndefined();
      expect(options).toBeDefined();
    });
  });

  describe('buildChartConfig', () => {
    it('should build chart configuration object', () => {
      const config = builder.buildChartConfig('AAPL', {
        theme: 'dark',
        interval: '1H',
        width: 1200,
        height: 800,
      });
      
      expect(config.symbol).toBe('AAPL');
      expect(config.theme).toBe('dark');
      expect(config.interval).toBe('1H');
      expect(config.width).toBe(1200);
      expect(config.height).toBe(800);
      expect(config.style).toBe('1'); // Candlestick
      expect(config.locale).toBe('en');
    });

    it('should use default values when options not provided', () => {
      const config = builder.buildChartConfig('GOOGL');
      
      expect(config.symbol).toBe('GOOGL');
      expect(config.theme).toBe('light');
      expect(config.interval).toBe('1D');
      expect(config.allow_symbol_change).toBe(true);
    });
  });

  describe('generateTradingViewUrl', () => {
    it('should generate TradingView native URL', () => {
      const url = builder.generateTradingViewUrl('NASDAQ:AAPL', '1D');
      
      expect(url).toBe('https://www.tradingview.com/chart/?symbol=NASDAQ-AAPL&interval=1D');
    });

    it('should handle symbols without exchange', () => {
      const url = builder.generateTradingViewUrl('MSFT', '1W');
      
      expect(url).toBe('https://www.tradingview.com/chart/?symbol=MSFT&interval=1W');
    });
  });
});