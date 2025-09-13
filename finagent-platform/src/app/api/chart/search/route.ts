import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChartAgent } from '@/lib/agents/chart-agent';

const postRequestSchema = z.object({
  query: z.string().min(1).max(500),
  theme: z.enum(['light', 'dark']).optional(),
  interval: z.string().regex(/^(1|5|15|30|60|240|1D|1W|1M)$/).optional(),
  userId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const { query, theme, interval, userId } = postRequestSchema.parse(body);

    const chartAgent = new ChartAgent();
    const result = await chartAgent.analyzeCharts(query, {
      theme,
      interval,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chart search API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
          details: error.errors
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        type: 'error',
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

const getRequestSchema = z.object({
  query: z.string().min(1).max(500),
  theme: z.enum(['light', 'dark']).default('light'),
  interval: z.string().regex(/^(1|5|15|30|60|240|1D|1W|1M)$/).default('1D'),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawParams = {
      query: searchParams.get('q') || searchParams.get('query'),
      theme: searchParams.get('theme'),
      interval: searchParams.get('interval'),
    };

    // Validate input
    const { query, theme, interval } = getRequestSchema.parse(rawParams);

    const chartAgent = new ChartAgent();
    const result = await chartAgent.analyzeCharts(query, {
      theme,
      interval,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chart search API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request parameters',
          details: error.errors
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        type: 'error',
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}