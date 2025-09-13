import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'WorkflowResult',
  method: 'GET',
  path: '/api/workflow/:workflowId/result',
  emits: [],
};

export const handler: Handlers['WorkflowResult'] = async (req, { logger, state, traceId }) => {
  try {
    const { workflowId } = req.pathParams;
    
    logger.info('Fetching workflow result', { 
      workflowId,
      traceId 
    });

    // Get workflow state
    const workflow: any = await state.get('workflows', workflowId);
    
    if (!workflow) {
      return {
        status: 404,
        body: {
          error: 'Workflow not found',
          workflowId,
        },
      };
    }

    // Get all agent results
    const results = workflow.results || [];
    
    // Check if workflow is complete
    const isComplete = workflow.currentStep >= workflow.steps.length;
    
    // Format the combined response
    let combinedResponse = '';
    
    if (isComplete && results.length > 0) {
      combinedResponse = results.map((r: any) => 
        `## ${r.agent.toUpperCase()} Analysis\n\n${r.result}\n`
      ).join('\n---\n\n');
    }

    return {
      status: 200,
      body: {
        workflowId,
        workflowName: workflow.name,
        status: isComplete ? 'completed' : 'processing',
        message: workflow.message,
        results,
        combinedResponse,
        completedAt: workflow.completedAt,
        traceId,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch workflow result', { 
      error: errorMessage,
      traceId 
    });
    
    return {
      status: 500,
      body: {
        error: 'Failed to fetch workflow result',
        message: errorMessage,
      },
    };
  }
};