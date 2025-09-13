import type { ApiRouteConfig, Handlers } from 'motia'

export const config: ApiRouteConfig = {
  type: 'api',
  name: 'TestStream',
  path: '/api/test-stream',
  method: 'GET',
  emits: [],
}

export const handler: Handlers['TestStream'] = async (req, { logger }) => {
  logger.info('Testing if ReadableStream can be returned')
  
  // Try returning a ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      
      // Send SSE formatted data
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: 'Hello' })}\n\n`))
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ message: 'World' })}\n\n`))
      
      controller.close()
    }
  })
  
  return {
    status: 200,
    body: stream,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  }
}