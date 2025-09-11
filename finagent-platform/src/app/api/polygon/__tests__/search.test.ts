/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../search/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/polygon/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.POLYGON_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.POLYGON_API_KEY;
  });

  it('should return search results for valid query', async () => {
    const mockSearchData = {
      results: [
        {
          ticker: 'AAPL',
          name: 'Apple Inc.',
          primary_exchange: 'NASDAQ',
          type: 'CS',
        },
        {
          ticker: 'AAPLW',
          name: 'Apple Inc. Warrant',
          primary_exchange: 'NASDAQ',
          type: 'WARRANT',
        },
      ],
    };

    mockedAxios.get.mockResolvedValueOnce({
      data: mockSearchData,
    });

    const url = new URL('http://localhost:3000/api/polygon/search?query=Apple&limit=10');
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockSearchData);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.polygon.io/v3/reference/tickers',
      {
        params: {
          search: 'Apple',
          apikey: 'test-api-key',
          limit: 10,
          active: true,
        },
        timeout: 10000,
      }
    );
  });

  it('should use default limit when not provided', async () => {
    const mockSearchData = { results: [] };
    mockedAxios.get.mockResolvedValueOnce({ data: mockSearchData });

    const url = new URL('http://localhost:3000/api/polygon/search?query=Apple');
    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          limit: 10, // default value
        }),
      })
    );
  });

  it('should reject invalid query parameters', async () => {
    // Empty query
    const url1 = new URL('http://localhost:3000/api/polygon/search?query=');
    const request1 = new NextRequest(url1);
    const response1 = await GET(request1);
    const data1 = await response1.json();

    expect(response1.status).toBe(400);
    expect(data1.success).toBe(false);
    expect(data1.error).toBe('Invalid search parameters');

    // Query too long
    const longQuery = 'a'.repeat(101);
    const url2 = new URL(`http://localhost:3000/api/polygon/search?query=${longQuery}`);
    const request2 = new NextRequest(url2);
    const response2 = await GET(request2);
    const data2 = await response2.json();

    expect(response2.status).toBe(400);
    expect(data2.success).toBe(false);
    expect(data2.error).toBe('Invalid search parameters');
  });

  it('should reject invalid limit parameters', async () => {
    // Limit too high
    const url = new URL('http://localhost:3000/api/polygon/search?query=Apple&limit=100');
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid search parameters');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should handle missing API key', async () => {
    delete process.env.POLYGON_API_KEY;

    const url = new URL('http://localhost:3000/api/polygon/search?query=Apple');
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('API key not configured');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should handle API timeout errors', async () => {
    const timeoutError = new Error('Timeout');
    timeoutError.code = 'ECONNABORTED';
    
    mockedAxios.get.mockRejectedValueOnce(timeoutError);
    mockedAxios.isAxiosError.mockReturnValueOnce(true);

    const url = new URL('http://localhost:3000/api/polygon/search?query=Apple');
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to search tickers');
  });

  it('should accept both query and q parameters', async () => {
    const mockSearchData = { results: [] };
    mockedAxios.get.mockResolvedValueOnce({ data: mockSearchData });

    // Test with 'q' parameter
    const url = new URL('http://localhost:3000/api/polygon/search?q=Tesla');
    const request = new NextRequest(url);
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          search: 'Tesla',
        }),
      })
    );
  });
});