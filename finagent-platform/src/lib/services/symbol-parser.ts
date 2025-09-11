// Symbol Parser Service for extracting and validating financial symbols
import axios from 'axios';

export interface ParsedSymbol {
  symbol: string;
  exchange?: string;
  fullSymbol: string;
  type?: string;
}

export class SymbolParserService {
  private symbolRegex: RegExp = /\b[A-Z]{1,5}\b/g;
  private exchangeMap: { [key: string]: string } = {
    'NASDAQ': 'NASDAQ',
    'NYSE': 'NYSE',
    'CRYPTO': 'CRYPTO',
    'FOREX': 'FOREX',
  };
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.POLYGON_API_KEY || '';
  }

  /**
   * Extract potential stock symbols from user query
   */
  extractSymbols(query: string): string[] {
    const upperQuery = query.toUpperCase();
    const matches = upperQuery.match(this.symbolRegex) || [];
    
    // Filter out common words that might match the pattern
    const commonWords = ['I', 'A', 'THE', 'AND', 'OR', 'FOR', 'TO', 'IN', 'ON', 'AT', 'BY'];
    
    return matches.filter(match => 
      !commonWords.includes(match) && 
      this.validateSymbolFormat(match)
    );
  }

  /**
   * Validate if a string follows stock symbol format
   */
  validateSymbolFormat(symbol: string): boolean {
    // Basic validation: 1-5 uppercase letters
    return symbol.length >= 1 && 
           symbol.length <= 5 && 
           /^[A-Z]+$/.test(symbol);
  }

  /**
   * Resolve symbol with exchange information using Polygon API
   */
  async resolveSymbolWithExchange(symbol: string): Promise<ParsedSymbol | null> {
    if (!this.apiKey) {
      // Return basic symbol without exchange info if no API key
      return {
        symbol,
        fullSymbol: symbol,
      };
    }

    try {
      const response = await axios.get(
        `https://api.polygon.io/v3/reference/tickers/${symbol}`,
        {
          params: { apikey: this.apiKey },
        }
      );

      if (response.data.results) {
        const data = response.data.results;
        return {
          symbol: data.ticker,
          exchange: data.primary_exchange,
          fullSymbol: data.primary_exchange 
            ? `${data.primary_exchange}:${data.ticker}`
            : data.ticker,
          type: data.type,
        };
      }
    } catch (error) {
      console.error(`Failed to resolve symbol ${symbol}:`, error);
    }

    return null;
  }

  /**
   * Parse multiple symbols from query and resolve them
   */
  async parseQuery(query: string): Promise<ParsedSymbol[]> {
    const extractedSymbols = this.extractSymbols(query);
    const resolvedSymbols: ParsedSymbol[] = [];

    for (const symbol of extractedSymbols) {
      const resolved = await this.resolveSymbolWithExchange(symbol);
      if (resolved) {
        resolvedSymbols.push(resolved);
      } else {
        // Add unresolved symbol as fallback
        resolvedSymbols.push({
          symbol,
          fullSymbol: symbol,
        });
      }
    }

    return resolvedSymbols;
  }

  /**
   * Search for symbols matching a query
   */
  async searchSymbols(query: string, limit: number = 10): Promise<ParsedSymbol[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await axios.get(
        'https://api.polygon.io/v3/reference/tickers',
        {
          params: {
            search: query,
            apikey: this.apiKey,
            limit,
            active: true,
          },
        }
      );

      if (response.data.results) {
        return response.data.results.map((item: any) => ({
          symbol: item.ticker,
          exchange: item.primary_exchange,
          fullSymbol: item.primary_exchange 
            ? `${item.primary_exchange}:${item.ticker}`
            : item.ticker,
          type: item.type,
        }));
      }
    } catch (error) {
      console.error('Symbol search failed:', error);
    }

    return [];
  }

  /**
   * Detect time frame hints from query
   */
  detectTimeframe(query: string): string {
    const lowercaseQuery = query.toLowerCase();
    
    const timeframeMap: { [key: string]: string } = {
      'minute': '1',
      'minutes': '1',
      '5 minute': '5',
      '5 minutes': '5',
      '15 minute': '15',
      '15 minutes': '15',
      '30 minute': '30',
      '30 minutes': '30',
      'hour': '60',
      'hourly': '60',
      'hours': '60',
      'daily': '1D',
      'day': '1D',
      'days': '1D',
      'weekly': '1W',
      'week': '1W',
      'weeks': '1W',
      'monthly': '1M',
      'month': '1M',
      'months': '1M',
    };

    for (const [key, value] of Object.entries(timeframeMap)) {
      if (lowercaseQuery.includes(key)) {
        return value;
      }
    }

    return '1D'; // Default to daily
  }
}