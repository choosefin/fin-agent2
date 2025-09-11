/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../ticker/[symbol]/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/polygon/ticker/[symbol]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.POLYGON_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.POLYGON_API_KEY;
  });

  it('should return ticker data for valid symbol', async () => {
    const mockTickerData = {
      results: {
        ticker: 'AAPL',
        name: 'Apple Inc.',
        primary_exchange: 'NASDAQ',
        type: 'CS',
      },
    };

    mockedAxios.get.mockResolvedValueOnce({
      data: mockTickerData,
    });

    const request = new NextRequest('http://localhost:3000/api/polygon/ticker/AAPL');
    const response = await GET(request, { params: { symbol: 'AAPL' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockTickerData);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.polygon.io/v3/reference/tickers/AAPL',
      {
        params: { apikey: 'test-api-key' },
        timeout: 10000,
      }
    );
  });

  it('should reject invalid symbol format', async () => {
    const request = new NextRequest('http://localhost:3000/api/polygon/ticker/invalid123@');
    const response = await GET(request, { params: { symbol: 'invalid123@' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid symbol format');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should handle missing API key', async () => {
    delete process.env.POLYGON_API_KEY;

    const request = new NextRequest('http://localhost:3000/api/polygon/ticker/AAPL');
    const response = await GET(request, { params: { symbol: 'AAPL' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('API key not configured');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
    mockedAxios.isAxiosError.mockReturnValueOnce(false);

    const request = new NextRequest('http://localhost:3000/api/polygon/ticker/AAPL');
    const response = await GET(request, { params: { symbol: 'AAPL' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });

  it('should handle API rate limiting', async () => {
    const mockError = {
      response: {
        status: 429,
        data: { error: 'Rate limit exceeded' },
      },
    };

    mockedAxios.get.mockRejectedValueOnce(mockError);
    mockedAxios.isAxiosError.mockReturnValueOnce(true);

    const request = new NextRequest('http://localhost:3000/api/polygon/ticker/AAPL');
    const response = await GET(request, { params: { symbol: 'AAPL' } });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Rate limit exceeded');
  });

  it('should validate symbol length constraints', async () => {
    // Test symbol too long
    const longSymbol = 'TOOLONGSYMBOL';
    const request = new NextRequest(`http://localhost:3000/api/polygon/ticker/${longSymbol}`);
    const response = await GET(request, { params: { symbol: longSymbol } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid symbol format');
  });
});