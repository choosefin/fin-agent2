/**
 * Detects if a message should trigger a multi-agent workflow
 */
export class WorkflowDetector {
  private workflowTriggers = [
    // Investment analysis triggers
    { pattern: /analyze.*(?:stock|invest|portfolio|market)/i, agents: ['analyst', 'advisor', 'riskManager'] },
    { pattern: /should.*(?:buy|sell|invest)/i, agents: ['analyst', 'trader', 'advisor'] },
    { pattern: /(?:evaluate|assess).*risk/i, agents: ['analyst', 'riskManager', 'advisor'] },
    { pattern: /market.*(?:trend|outlook|forecast)/i, agents: ['analyst', 'economist', 'advisor'] },
    
    // Trading triggers
    { pattern: /(?:trade|trading).*strategy/i, agents: ['trader', 'analyst', 'riskManager'] },
    { pattern: /(?:technical|fundamental).*analysis/i, agents: ['analyst', 'trader', 'advisor'] },
    
    // Economic triggers
    { pattern: /economic.*(?:impact|indicator|outlook)/i, agents: ['economist', 'analyst', 'advisor'] },
    { pattern: /(?:inflation|gdp|employment).*(?:affect|impact)/i, agents: ['economist', 'analyst'] },
    
    // Complex analysis triggers
    { pattern: /comprehensive.*(?:analysis|review|assessment)/i, agents: ['analyst', 'trader', 'advisor', 'riskManager', 'economist'] },
    { pattern: /multi.*agent/i, agents: ['analyst', 'trader', 'advisor', 'riskManager', 'economist'] },
  ]

  async analyze(message: string, context?: any): Promise<false | { agents: string[], estimatedTime: number }> {
    // Check for explicit workflow triggers
    for (const trigger of this.workflowTriggers) {
      if (trigger.pattern.test(message)) {
        return {
          agents: trigger.agents,
          estimatedTime: trigger.agents.length * 5, // 5 seconds per agent estimate
        }
      }
    }

    // Check for context-based triggers
    if (context?.symbols && context.symbols.length > 0) {
      // If symbols are provided, likely needs analysis
      if (message.toLowerCase().includes('analyze') || 
          message.toLowerCase().includes('evaluate') ||
          message.toLowerCase().includes('assess')) {
        return {
          agents: ['analyst', 'advisor', 'riskManager'],
          estimatedTime: 15,
        }
      }
    }

    // Check for question complexity (multiple questions or complex analysis)
    const questionMarks = (message.match(/\?/g) || []).length
    const hasMultipleTopics = /(?:and|also|additionally|furthermore|moreover)/i.test(message)
    
    if (questionMarks > 2 || (questionMarks > 0 && hasMultipleTopics)) {
      return {
        agents: ['analyst', 'advisor'],
        estimatedTime: 10,
      }
    }

    return false
  }
}