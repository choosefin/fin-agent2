import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ChartAgent } from '@/lib/agents/chart-agent';

const symbolParamsSchema = z.object({
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9.-]+$/, 'Invalid symbol format'),
});

const queryParamsSchema = z.object({
  interval: z.string().regex(/^(1|5|15|30|60|240|1D|1W|1M)$/).default('1D'),
  theme: z.enum(['light', 'dark']).default('light'),
  fullscreen: z.boolean().default(false),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    // Validate symbol parameter
    const { symbol } = symbolParamsSchema.parse(params);
    
    // Validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const { interval, theme, fullscreen } = queryParamsSchema.parse({
      interval: searchParams.get('interval'),
      theme: searchParams.get('theme'),
      fullscreen: searchParams.get('fullscreen') === 'true',
    });

    const chartAgent = new ChartAgent();
    const result = await chartAgent.generateChart(symbol, {
      interval,
      theme,
      fullscreen,
    });

    if (!result) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Symbol ${symbol} not found or invalid` 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Chart API error:', error);
    
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
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}