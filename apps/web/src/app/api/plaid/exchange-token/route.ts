import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    const requestBody = await request.json();
    
    // Ensure required fields are present
    if (!requestBody.publicToken) {
      return NextResponse.json(
        { error: 'Public token is required' },
        { status: 400 }
      );
    }
    
    if (!requestBody.userId) {
      // TODO: Get actual user ID from auth context
      requestBody.userId = 'default-user-id';
    }
    
    console.log('Exchanging public token for user:', requestBody.userId);
    
    const response = await fetch(`${backendUrl}/api/plaid/exchange-token`, {
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

    const responseText = await response.text();
    let data;
    
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
      return NextResponse.json(
        { error: data.error || 'Failed to exchange token' },
        { status: response.status }
      );
    }

    console.log('Token exchanged successfully:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error exchanging Plaid token:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}