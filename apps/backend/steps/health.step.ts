import type { ApiRouteConfig } from 'motia';

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'HealthCheck',
  method: 'GET',
  path: '/health',
  emits: [],
};

export const handler = async (_req: any, { logger }: any) => {
  logger.info('Health check requested');
  
  return {
    status: 200,
    body: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        backend: 'running',
        groq: process.env.GROQ_API_KEY ? 'configured' : 'not configured',
        azure: process.env.AZURE_OPENAI_API_KEY ? 'configured' : 'not configured',
      }
    },
  };
};