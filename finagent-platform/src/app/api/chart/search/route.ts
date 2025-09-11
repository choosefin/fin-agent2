import { NextRequest, NextResponse } from 'next/server';
import { ChartAgent } from '@/lib/agents/chart-agent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, theme, interval, userId } = body;

    if (!query) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Query is required' 
        },
        { status: 400 }
      );
    }

    const chartAgent = new ChartAgent();
    const result = await chartAgent.analyzeCharts(query, {
      theme,
      interval,
      userId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chart search API error:', error);
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query');
    const theme = (searchParams.get('theme') as 'light' | 'dark') || 'light';
    const interval = searchParams.get('interval') || '1D';

    if (!query) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Query parameter is required' 
        },
        { status: 400 }
      );
    }

    const chartAgent = new ChartAgent();
    const result = await chartAgent.analyzeCharts(query, {
      theme,
      interval,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chart search API error:', error);
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