import { NextResponse } from 'next/server';

// Workflow definitions with trigger patterns (matching backend)
const workflows = {
  portfolioAnalysis: {
    name: 'Portfolio Analysis',
    triggers: [
      'analyze my portfolio',
      'review my investments',
      'portfolio performance',
      'how are my investments doing',
      'portfolio health check',
    ],
  },
  marketOpportunity: {
    name: 'Market Opportunity Scanner',
    triggers: [
      'find trading opportunities',
      'what should i buy',
      'market opportunities',
      'best stocks to trade',
      'trading ideas',
    ],
  },
  riskAssessment: {
    name: 'Risk Assessment',
    triggers: [
      'assess my risk',
      'portfolio risk',
      'am i too exposed',
      'hedge my portfolio',
      'protect my investments',
    ],
  },
  investmentResearch: {
    name: 'Investment Research',
    triggers: [
      'research',
      'tell me about',
      'should i invest in',
      'analyze this stock',
      'deep dive',
    ],
  },
  marketDebate: {
    name: 'Market Debate',
    triggers: [
      'market debate',
      'bull vs bear',
      'market outlook',
      'where is the market heading',
      'recession coming',
    ],
  },
};

// Function to detect workflow from user message
function detectWorkflow(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Check each workflow's triggers
  for (const workflow of Object.values(workflows)) {
    for (const trigger of workflow.triggers) {
      if (lowerMessage.includes(trigger)) {
        return true;
      }
    }
  }
  
  // Check for explicit workflow requests
  if (lowerMessage.includes('workflow') || lowerMessage.includes('multi-agent')) {
    return true;
  }
  
  return false;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Log the request details
    console.log('Test API called with:', body);
    console.log('Backend URL:', process.env.NEXT_PUBLIC_API_URL);
    
    // Detect if this should trigger a workflow
    const isWorkflow = detectWorkflow(body.message);
    
    // Choose the appropriate endpoint
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004';
    const endpoint = isWorkflow ? '/api/workflow/trigger' : '/api/chat';
    
    console.log(`Routing to ${endpoint} - Workflow detected: ${isWorkflow}`);
    
    // Prepare the request body based on endpoint
    const requestBody = isWorkflow 
      ? {
          message: body.message,
          userId: body.userId,
          context: {
            symbols: body.symbols || [],
            timeframe: body.timeframe || '1d',
            riskTolerance: body.riskTolerance || 'moderate',
          }
        }
      : body;
    
    // Forward to backend
    const response = await fetch(`${backendUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Backend error:', error);
      return NextResponse.json({ error: 'Backend error', details: error }, { status: response.status });
    }
    
    const data = await response.json();
    
    // If workflow was triggered, add metadata for the frontend
    if (isWorkflow && data.triggered) {
      return NextResponse.json({
        ...data,
        isWorkflow: true,
        workflowType: data.workflow?.name,
      });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ 
      error: 'Failed to connect to backend',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    backendUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'
  });
}