import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Forward the request to the backend API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    // Handle request body - it might be empty
    let requestBody: any = {};
    try {
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await request.text();
        if (text) {
          requestBody = JSON.parse(text);
        }
      }
    } catch (parseError) {
      console.log('Request body is empty or not JSON, using defaults');
    }
    
    // Ensure userId is present
    if (!requestBody.userId) {
      // TODO: Get actual user ID from auth context
      requestBody.userId = 'default-user-' + Date.now();
      console.log('No userId provided, generating default');
    }
    
    console.log('Sending to backend:', requestBody);
    
    console.log('Calling backend at:', `${backendUrl}/api/plaid/create-link-token`);
    console.log('Request body:', JSON.stringify(requestBody));
    
    const response = await fetch(`${backendUrl}/api/plaid/create-link-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward any authorization headers
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization') as string
        })
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Backend response status:', response.status);

    // Check if response has content
    let data;
    const responseText = await response.text();
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        return NextResponse.json(
          { error: 'Invalid response from backend' },
          { status: 500 }
        );
      }
    } else {
      data = {};
    }

    if (!response.ok) {
      console.error('Backend error:', data);
      console.error('Full backend response:', responseText);
      return NextResponse.json(
        { 
          error: data.error || 'Failed to create link token',
          message: data.message || responseText,
          details: data
        },
        { status: response.status }
      );
    }

    console.log('Link token created successfully:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's an Axios error with response data
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      return NextResponse.json(
        { 
          error: 'Failed to create link token',
          message: axiosError.message,
          details: axiosError.response?.data
        },
        { status: axiosError.response?.status || 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}