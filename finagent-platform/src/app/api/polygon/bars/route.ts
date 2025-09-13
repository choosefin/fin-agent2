import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';

const barsParamsSchema = z.object({
  ticker: z.string().min(1).max(10),
  multiplier: z.coerce.number().min(1).max(1000).default(1),
  timespan: z.enum(['minute', 'hour', 'day', 'week', 'month', 'quarter', 'year']).default('day'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  limit: z.coerce.number().min(1).max(5000).default(100),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = {
      ticker: searchParams.get('ticker'),
      multiplier: searchParams.get('multiplier'),
      timespan: searchParams.get('timespan'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      limit: searchParams.get('limit'),
    };

    // Validate input parameters
    const validatedParams = barsParamsSchema.parse(params);

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

    const { ticker, multiplier, timespan, from, to, limit } = validatedParams;
    
    const response = await axios.get(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`,
      {
        params: {
          apikey: apiKey,
          limit,
          adjusted: true,
          sort: 'asc',
        },
        timeout: 15000, // 15 second timeout for potentially large datasets
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Polygon bars API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid parameters',
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
          error: error.response?.data?.error || 'Failed to fetch bars data'
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