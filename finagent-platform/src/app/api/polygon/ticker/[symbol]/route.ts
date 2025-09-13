import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import axios from 'axios';

const symbolParamsSchema = z.object({
  symbol: z.string().min(1).max(5).regex(/^[A-Z]+$/, 'Symbol must be uppercase letters only')
});

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    // Validate symbol parameter
    const { symbol } = symbolParamsSchema.parse(params);
    
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
      `https://api.polygon.io/v3/reference/tickers/${symbol}`,
      {
        params: { apikey: apiKey },
        timeout: 10000, // 10 second timeout
      }
    );

    return NextResponse.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error(`Polygon API error for symbol ${params.symbol}:`, error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid symbol format',
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
          error: error.response?.data?.error || 'Failed to fetch ticker data'
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