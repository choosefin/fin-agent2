/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST, GET } from '../search/route';

// Mock the ChartAgent
jest.mock('@/lib/agents/chart-agent');
const MockedChartAgent = require('@/lib/agents/chart-agent').ChartAgent;

describe('/api/chart/search', () => {
  let mockAnalyzeCharts: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalyzeCharts = jest.fn();
    MockedChartAgent.mockImplementation(() => ({
      analyzeCharts: mockAnalyzeCharts,
    }));
  });

  describe('POST /api/chart/search', () => {
    it('should accept valid request body', async () => {
      const mockResult = {
        success: true,
        charts: [{ symbol: 'AAPL', url: 'https://example.com/chart' }],
      };
      mockAnalyzeCharts.mockResolvedValueOnce(mockResult);

      const requestBody = {
        query: 'Show me Apple stock chart',
        theme: 'dark',
        interval: '1D',
        userId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const request = new NextRequest('http://localhost:3000/api/chart/search', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
      expect(mockAnalyzeCharts).toHaveBeenCalledWith(
        'Show me Apple stock chart',
        {
          theme: 'dark',
          interval: '1D',
          userId: '123e4567-e89b-12d3-a456-426614174000',
        }
      );
    });

    it('should reject invalid query length', async () => {
      const requestBody = {
        query: '', // empty query
      };

      const request = new NextRequest('http://localhost:3000/api/chart/search', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request parameters');
      expect(mockAnalyzeCharts).not.toHaveBeenCalled();
    });

    it('should reject invalid theme', async () => {
      const requestBody = {
        query: 'Show me Apple stock',
        theme: 'invalid-theme',
      };

      const request = new NextRequest('http://localhost:3000/api/chart/search', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should reject invalid interval', async () => {
      const requestBody = {
        query: 'Show me Apple stock',
        interval: '2H', // invalid interval
      };

      const request = new NextRequest('http://localhost:3000/api/chart/search', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should reject invalid userId format', async () => {
      const requestBody = {
        query: 'Show me Apple stock',
        userId: 'invalid-uuid',
      };

      const request = new NextRequest('http://localhost:3000/api/chart/search', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should handle ChartAgent errors', async () => {
      mockAnalyzeCharts.mockRejectedValueOnce(new Error('Chart analysis failed'));

      const requestBody = {
        query: 'Show me Apple stock chart',
      };

      const request = new NextRequest('http://localhost:3000/api/chart/search', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Chart analysis failed');
    });
  });

  describe('GET /api/chart/search', () => {
    it('should accept valid query parameters', async () => {
      const mockResult = {
        success: true,
        charts: [{ symbol: 'MSFT', url: 'https://example.com/msft-chart' }],
      };
      mockAnalyzeCharts.mockResolvedValueOnce(mockResult);

      const url = new URL('http://localhost:3000/api/chart/search?query=Microsoft&theme=light&interval=5');
      const request = new NextRequest(url);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
      expect(mockAnalyzeCharts).toHaveBeenCalledWith('Microsoft', {
        theme: 'light',
        interval: '5',
      });
    });

    it('should use default values for optional parameters', async () => {
      const mockResult = { success: true, charts: [] };
      mockAnalyzeCharts.mockResolvedValueOnce(mockResult);

      const url = new URL('http://localhost:3000/api/chart/search?q=Tesla');
      const request = new NextRequest(url);
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockAnalyzeCharts).toHaveBeenCalledWith('Tesla', {
        theme: 'light', // default
        interval: '1D', // default
      });
    });

    it('should reject missing query parameter', async () => {
      const url = new URL('http://localhost:3000/api/chart/search');
      const request = new NextRequest(url);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid request parameters');
      expect(mockAnalyzeCharts).not.toHaveBeenCalled();
    });

    it('should accept both q and query parameters', async () => {
      const mockResult = { success: true, charts: [] };
      mockAnalyzeCharts.mockResolvedValueOnce(mockResult);

      // Test with 'q' parameter
      const url1 = new URL('http://localhost:3000/api/chart/search?q=Amazon');
      const request1 = new NextRequest(url1);
      const response1 = await GET(request1);

      expect(response1.status).toBe(200);
      expect(mockAnalyzeCharts).toHaveBeenCalledWith('Amazon', expect.any(Object));

      mockAnalyzeCharts.mockClear();

      // Test with 'query' parameter
      const url2 = new URL('http://localhost:3000/api/chart/search?query=Google');
      const request2 = new NextRequest(url2);
      const response2 = await GET(request2);

      expect(response2.status).toBe(200);
      expect(mockAnalyzeCharts).toHaveBeenCalledWith('Google', expect.any(Object));
    });
  });
});