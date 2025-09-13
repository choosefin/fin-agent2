import { z } from 'zod';
import type { EventStepConfig, Handlers } from 'motia';
import { groqService } from '../services/groq.service';
import { azureOpenAI } from '../services/azure-openai.service';
import { agentPrompts } from '../src/mastra/config';
import { OpenAI } from 'openai';

export const config: EventStepConfig = {
  type: 'event',
  name: 'AgentExecutor',
  subscribes: ['workflow.agent.started'],
  emits: ['workflow.agent.completed', 'workflow.agent.progress', 'workflow.completed', 'workflow.agent.started'],
  input: z.object({
    workflowId: z.string(),
    stepIndex: z.number(),
    agent: z.string(),
    task: z.string(),
  }),
};

// Simulate agent thinking process with intermediate updates
async function* processAgentTask(
  agent: string,
  task: string,
  context: any,
  emit: any,
  workflowId: string
): AsyncGenerator<string> {
  const steps = [
    `Analyzing task requirements...`,
    `Gathering relevant data...`,
    `Applying ${agent} expertise...`,
    `Formulating insights...`,
    `Preparing recommendations...`,
  ];

  for (const step of steps) {
    yield step;
    
    // Emit progress update
    await emit({
      topic: 'workflow.agent.progress',
      data: {
        workflowId,
        agent,
        status: step,
        timestamp: new Date().toISOString(),
      },
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function callLLM(
  agent: string,
  task: string,
  userMessage: string,
  previousResults: any[]
): Promise<string> {
  const systemPrompt = agentPrompts[agent as keyof typeof agentPrompts] || agentPrompts.general;
  
  // Build context from previous agent results
  const contextPrompt = previousResults.length > 0
    ? `\n\nPrevious agent insights:\n${previousResults.map(r => 
        `${r.agent}: ${r.result}`
      ).join('\n\n')}`
    : '';

  const fullPrompt = `${systemPrompt}

Your specific task: ${task}

User's original request: ${userMessage}
${contextPrompt}

Provide a focused response addressing your specific task from your agent perspective.`;

  try {
    // Try Groq first
    if (groqService.isConfigured()) {
      const completion = await groqService.createChatCompletion({
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: userMessage }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      if ('choices' in completion) {
        return completion.choices[0]?.message?.content || 'No response generated';
      }
    }
    
    // Fallback to Azure
    if (azureOpenAI.isConfigured()) {
      const completion = await azureOpenAI.createChatCompletion({
        model: 'model-router',
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      return completion.choices[0]?.message?.content || 'No response generated';
    }
    
    // Fallback to OpenAI
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: fullPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });
      
      return completion.choices[0]?.message?.content || 'No response generated';
    }
    
    // No LLM configured - return mock response
    return `[${agent.toUpperCase()} AGENT]\n\nTask: ${task}\n\nAnalysis: This is a simulated response from the ${agent} agent. Configure an LLM provider to get actual AI-powered insights.\n\nKey Points:\n- Point 1 related to ${task}\n- Point 2 with ${agent} perspective\n- Point 3 with actionable insights`;
    
  } catch (error) {
    console.error(`LLM call failed for agent ${agent}:`, error);
    return `[${agent.toUpperCase()} AGENT - Error]\n\nUnable to generate response. Please check LLM configuration.`;
  }
}

export const handler: Handlers['AgentExecutor'] = async (input, { logger, emit, state, traceId }) => {
  const { workflowId, stepIndex, agent, task } = input;
  
  try {
    logger.info('Agent executor started', { 
      workflowId,
      agent,
      task,
      stepIndex,
      traceId 
    });

    // Get workflow state
    const workflow = await state.get('workflows', workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Get previous results for context
    const previousResults = workflow.results || [];

    // Simulate agent processing with progress updates
    const progressGenerator = processAgentTask(agent, task, workflow.context, emit, workflowId);
    
    for await (const progress of progressGenerator) {
      logger.info(`Agent ${agent} progress: ${progress}`);
    }

    // Call LLM for actual agent response
    const agentResponse = await callLLM(
      agent,
      task,
      workflow.message,
      previousResults
    );

    // Store agent result
    const agentResult = {
      agent,
      task,
      result: agentResponse,
      completedAt: new Date().toISOString(),
    };

    await state.set('workflows', `${workflowId}:result:${stepIndex}`, agentResult);

    // Update workflow with this agent's result
    const updatedResults = [...previousResults, agentResult];
    await state.set('workflows', workflowId, {
      ...workflow,
      results: updatedResults,
      currentStep: stepIndex + 1,
      lastUpdated: new Date().toISOString(),
    });

    // Emit agent completed event
    await emit({
      topic: 'workflow.agent.completed',
      data: {
        workflowId,
        stepIndex,
        agent,
        task,
        result: agentResponse,
        timestamp: new Date().toISOString(),
      },
    });

    // Check if this was the last agent or trigger the next one
    if (stepIndex === workflow.steps.length - 1) {
      // This was the last agent - workflow complete
      await emit({
        topic: 'workflow.completed',
        data: {
          workflowId,
          results: updatedResults,
          completedAt: new Date().toISOString(),
        },
      });
    } else {
      // Trigger the next agent in sequence
      const nextStep = workflow.steps[stepIndex + 1];
      
      await emit({
        topic: 'workflow.agent.started',
        data: {
          workflowId,
          stepIndex: stepIndex + 1,
          agent: nextStep.agent,
          task: nextStep.task,
        },
      });
      
      // Update workflow state for next step
      await state.set('workflows', `${workflowId}:step:${stepIndex + 1}`, {
        agent: nextStep.agent,
        task: nextStep.task,
        status: 'processing',
        startedAt: new Date().toISOString(),
      });
    }

    logger.info('Agent executor completed', { 
      workflowId,
      agent,
      stepIndex,
      traceId 
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Agent execution failed', { 
      error: errorMessage,
      workflowId,
      agent,
      traceId 
    });
    
    await emit({
      topic: 'workflow.agent.completed',
      data: {
        workflowId,
        stepIndex,
        agent,
        task,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
    });
  }
};