import { NextRequest, NextResponse } from 'next/server';
import { ChartAgent } from '@/lib/agents/chart-agent';

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params;
    const searchParams = request.nextUrl.searchParams;
    
    const interval = searchParams.get('interval') || '1D';
    const theme = (searchParams.get('theme') as 'light' | 'dark') || 'light';
    const fullscreen = searchParams.get('fullscreen') === 'true';

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
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}