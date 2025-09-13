// Shared chat session storage
export const activeSessions = new Map<string, {
  status: 'processing' | 'streaming' | 'completed' | 'error',
  tokens: string[],
  metadata?: any,
  error?: string,
  result?: any
}>()