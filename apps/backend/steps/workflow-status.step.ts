import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'WorkflowStatus',
  method: 'GET',
  path: '/api/workflow/:workflowId/status',
  paramsSchema: z.object({
    workflowId: z.string(),
  }),
  emits: [],
};

export const handler: Handlers['WorkflowStatus'] = async (req, { logger, state, traceId }) => {
  try {
    const { workflowId } = req.params;
    
    logger.info('Fetching workflow status', { 
      workflowId,
      traceId 
    });

    // Get workflow state
    const workflow = await state.get('workflows', workflowId);
    
    if (!workflow) {
      return {
        status: 404,
        body: {
          error: 'Workflow not found',
          workflowId,
        },
      };
    }

    // Get all step statuses
    const stepStatuses = [];
    for (let i = 0; i < workflow.steps.length; i++) {
      const stepData = await state.get('workflows', `${workflowId}:step:${i}`);
      const resultData = await state.get('workflows', `${workflowId}:result:${i}`);
      
      stepStatuses.push({
        index: i,
        agent: workflow.steps[i].agent,
        task: workflow.steps[i].task,
        status: resultData ? 'completed' : stepData ? 'processing' : 'pending',
        result: resultData?.result,
        startedAt: stepData?.startedAt,
        completedAt: resultData?.completedAt,
      });
    }

    // Determine overall status
    const completedSteps = stepStatuses.filter(s => s.status === 'completed').length;
    const processingSteps = stepStatuses.filter(s => s.status === 'processing').length;
    
    let overallStatus = 'pending';
    if (completedSteps === workflow.steps.length) {
      overallStatus = 'completed';
    } else if (processingSteps > 0 || completedSteps > 0) {
      overallStatus = 'processing';
    }

    return {
      status: 200,
      body: {
        workflowId,
        name: workflow.name,
        status: overallStatus,
        progress: {
          completed: completedSteps,
          total: workflow.steps.length,
          percentage: Math.round((completedSteps / workflow.steps.length) * 100),
        },
        steps: stepStatuses,
        startedAt: workflow.startedAt,
        lastUpdated: workflow.lastUpdated,
        results: workflow.results || [],
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch workflow status', { 
      error: errorMessage,
      traceId 
    });
    
    return {
      status: 500,
      body: {
        error: 'Failed to fetch workflow status',
        message: errorMessage,
      },
    };
  }
};