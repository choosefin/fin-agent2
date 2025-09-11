import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const errorReportSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  timestamp: z.string(),
  userId: z.string().optional(),
  component: z.string().optional(),
  action: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate error report
    const errorData = errorReportSchema.parse(body);
    
    // Log error server-side
    console.error('Client-side error reported:', {
      message: errorData.message,
      component: errorData.component,
      action: errorData.action,
      timestamp: errorData.timestamp,
      userId: errorData.userId,
      url: errorData.url,
    });

    // In production, you would send this to your error tracking service
    // e.g., Sentry, Bugsnag, DataDog, etc.
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry
      // Sentry.captureException(new Error(errorData.message), {
      //   extra: errorData,
      // });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing error report:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid error report format',
          details: error.errors
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process error report' 
      },
      { status: 500 }
    );
  }
}