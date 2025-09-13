import { z } from 'zod';
import type { ApiRouteConfig, Handlers } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'WorkflowStatus',
  method: 'GET',
  path: '/api/workflow/:workflowId/status',
  emits: [],
};

export const handler: Handlers['WorkflowStatus'] = async (req, { logger, state, traceId }) => {
  try {
    const { workflowId } = req.pathParams;
    
    logger.info('Fetching workflow status', { 
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

    // Get agents from workflow (it can be either 'agents' or 'steps')
    const agents = workflow.agents || workflow.steps || [];
    const totalSteps = agents.length;
    
    // Get all step statuses
    const stepStatuses = [];
    for (let i = 0; i < totalSteps; i++) {
      const stepData: any = await state.get('workflows', `${workflowId}:step:${i}`);
      const resultData: any = await state.get('workflows', `${workflowId}:result:${i}`);
      
      // Handle both agent string array and step object array
      const agentName = typeof agents[i] === 'string' ? agents[i] : agents[i].agent;
      const agentTask = typeof agents[i] === 'string' 
        ? `Process with ${agents[i]}` 
        : agents[i].task || `Process with ${agents[i].agent}`;
      
      stepStatuses.push({
        index: i,
        agent: agentName,
        task: agentTask,
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
    if (completedSteps === totalSteps) {
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
          total: totalSteps,
          percentage: Math.round((completedSteps / totalSteps) * 100),
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