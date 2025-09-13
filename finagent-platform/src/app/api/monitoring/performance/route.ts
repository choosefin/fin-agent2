import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const performanceMetricsSchema = z.object({
  loadTime: z.number().positive(),
  component: z.string(),
  symbol: z.string().optional(),
  timestamp: z.number(),
  userId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate performance metrics
    const metricsData = performanceMetricsSchema.parse(body);
    
    // Log performance metrics server-side
    console.log('Performance metrics reported:', {
      component: metricsData.component,
      loadTime: metricsData.loadTime,
      symbol: metricsData.symbol,
      timestamp: new Date(metricsData.timestamp).toISOString(),
      userId: metricsData.userId,
    });

    // In production, you would send this to your monitoring service
    // e.g., DataDog, New Relic, CloudWatch, etc.
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to monitoring service
      // await sendMetricsToMonitoringService(metricsData);
    }

    // Log slow performance issues
    if (metricsData.loadTime > 5000) { // 5+ seconds
      console.warn('Slow performance detected:', {
        component: metricsData.component,
        loadTime: metricsData.loadTime,
        symbol: metricsData.symbol,
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing performance metrics:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid metrics format',
          details: error.errors
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process performance metrics' 
      },
      { status: 500 }
    );
  }
}