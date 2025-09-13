import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';

const searchParamsSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(50).default(10),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query') || searchParams.get('q');
    const limit = searchParams.get('limit');

    // Validate input parameters
    const { query: validatedQuery, limit: validatedLimit } = searchParamsSchema.parse({
      query,
      limit
    });

    const apiKey = process.env.POLYGON_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'API key not configured' 
        },
        { status: 500 }
      );
    }

    const response = await axios.get(
      'https://api.polygon.io/v3/reference/tickers',
      {
        params: {
          search: validatedQuery,
          apikey: apiKey,
          limit: validatedLimit,
          active: true,
        },
        timeout: 10000, // 10 second timeout
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Polygon search API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid search parameters',
          details: error.errors
        },
        { status: 400 }
      );
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      return NextResponse.json(
        { 
          success: false, 
          error: error.response?.data?.error || 'Failed to search tickers'
        },
        { status }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}