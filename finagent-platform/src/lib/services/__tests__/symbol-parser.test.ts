import { SymbolParserService } from '../symbol-parser';

describe('SymbolParserService', () => {
  let parser: SymbolParserService;

  beforeEach(() => {
    parser = new SymbolParserService('test_api_key');
  });

  describe('extractSymbols', () => {
    it('should extract valid stock symbols from text', () => {
      const query = 'I want to compare AAPL and MSFT performance';
      const symbols = parser.extractSymbols(query);
      
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('MSFT');
    });

    it('should handle multiple symbols in different cases', () => {
      const query = 'Compare apple (aapl) with Microsoft (MSFT) and GOOGL';
      const symbols = parser.extractSymbols(query);
      
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('MSFT');
      expect(symbols).toContain('GOOGL');
    });

    it('should filter out common words that match pattern', () => {
      const query = 'I want to invest in TSLA for the long term';
      const symbols = parser.extractSymbols(query);
      
      expect(symbols).toContain('TSLA');
      expect(symbols).not.toContain('I');
      expect(symbols).not.toContain('FOR');
      expect(symbols).not.toContain('THE');
    });

    it('should return empty array for text without symbols', () => {
      const query = 'What is the best investment strategy?';
      const symbols = parser.extractSymbols(query);
      
      expect(symbols).toEqual([]);
    });
  });

  describe('validateSymbolFormat', () => {
    it('should validate correct symbol formats', () => {
      expect(parser.validateSymbolFormat('AAPL')).toBe(true);
      expect(parser.validateSymbolFormat('MSFT')).toBe(true);
      expect(parser.validateSymbolFormat('A')).toBe(true);
      expect(parser.validateSymbolFormat('GOOGL')).toBe(true);
    });

    it('should reject invalid symbol formats', () => {
      expect(parser.validateSymbolFormat('')).toBe(false);
      expect(parser.validateSymbolFormat('123')).toBe(false);
      expect(parser.validateSymbolFormat('TOOLONG')).toBe(false);
      expect(parser.validateSymbolFormat('aa-pl')).toBe(false);
    });
  });

  describe('detectTimeframe', () => {
    it('should detect minute timeframes', () => {
      expect(parser.detectTimeframe('show me 5 minute chart')).toBe('5');
      expect(parser.detectTimeframe('1 minute candles')).toBe('1');
      expect(parser.detectTimeframe('15 minutes data')).toBe('15');
    });

    it('should detect hourly timeframes', () => {
      expect(parser.detectTimeframe('hourly chart')).toBe('60');
      expect(parser.detectTimeframe('show me hour data')).toBe('60');
    });

    it('should detect daily timeframes', () => {
      expect(parser.detectTimeframe('daily chart')).toBe('1D');
      expect(parser.detectTimeframe('show me day view')).toBe('1D');
    });

    it('should detect weekly timeframes', () => {
      expect(parser.detectTimeframe('weekly analysis')).toBe('1W');
      expect(parser.detectTimeframe('week chart')).toBe('1W');
    });

    it('should detect monthly timeframes', () => {
      expect(parser.detectTimeframe('monthly performance')).toBe('1M');
      expect(parser.detectTimeframe('month view')).toBe('1M');
    });

    it('should default to daily for unrecognized timeframes', () => {
      expect(parser.detectTimeframe('show me the chart')).toBe('1D');
      expect(parser.detectTimeframe('analyze this stock')).toBe('1D');
    });
  });
});