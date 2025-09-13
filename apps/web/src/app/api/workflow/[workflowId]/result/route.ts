import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params;
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';
    
    // Forward to backend
    const response = await fetch(`${backendUrl}/api/workflow/${workflowId}/result`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', error);
      return NextResponse.json({ error: 'Backend error', details: error }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    
    // Return a mock response if backend is not available
    // This helps with development when backend isn't running
    return NextResponse.json({
      workflowId,
      status: 'processing',
      message: 'Backend service unavailable. Please ensure the Motia backend is running on port 3004.',
      results: [],
      combinedResponse: '',
    });
  }
}