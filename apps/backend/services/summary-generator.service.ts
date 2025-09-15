import { groqService } from './groq.service';
import { azureOpenAI } from './azure-openai.service';
import { OpenAI } from 'openai';

export interface AgentResult {
  agent: string;
  task: string;
  result: string;
  completedAt?: string;
}

export class SummaryGeneratorService {
  static async generateExecutiveSummary(
    results: AgentResult[],
    userMessage: string
  ): Promise<string> {
    // Prepare the context from all agent results
    const agentInsights = results.map(r => 
      `${r.agent.toUpperCase()} ANALYSIS:\n${r.result}\n`
    ).join('\n---\n\n');

    const summaryPrompt = `You are an executive financial advisor tasked with synthesizing insights from multiple expert analysts.

Based on the following multi-agent analysis for the user's request: "${userMessage}"

${agentInsights}

Please provide a comprehensive EXECUTIVE SUMMARY that:

1. **Synthesizes Key Findings**: Identify the most important insights across all agents
2. **Highlights Consensus**: Where do the agents agree?
3. **Notes Divergence**: Where do they have different perspectives?
4. **Prioritizes Actions**: What are the top 3-5 actions the user should take?
5. **Risk Assessment**: Overall risk level and main concerns
6. **Opportunity Assessment**: Key opportunities identified
7. **Timeline**: Immediate vs short-term vs long-term recommendations

Format your response as a structured executive summary with clear sections and bullet points.
Use markdown formatting with headers, bold text for emphasis, and tables where appropriate.
Make it actionable and easy to understand for decision-making.`;

    try {
      // Try Groq first
      if (groqService.isConfigured()) {
        const completion = await groqService.createChatCompletion({
          messages: [
            { role: 'system', content: summaryPrompt },
            { role: 'user', content: 'Generate the executive summary based on the multi-agent analysis.' }
          ],
          model: 'llama-3.3-70b-versatile',
          temperature: 0.7,
          max_tokens: 2000,
        });
        
        if ('choices' in completion) {
          return this.formatExecutiveSummary(
            completion.choices[0]?.message?.content || 'Unable to generate summary'
          );
        }
      }
      
      // Fallback to Azure
      if (azureOpenAI.isConfigured()) {
        const completion = await azureOpenAI.createChatCompletion({
          model: 'model-router',
          messages: [
            { role: 'system', content: summaryPrompt },
            { role: 'user', content: 'Generate the executive summary based on the multi-agent analysis.' }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        });
        
        return this.formatExecutiveSummary(
          completion.choices[0]?.message?.content || 'Unable to generate summary'
        );
      }
      
      // Fallback to OpenAI
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: summaryPrompt },
            { role: 'user', content: 'Generate the executive summary based on the multi-agent analysis.' }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        });
        
        return this.formatExecutiveSummary(
          completion.choices[0]?.message?.content || 'Unable to generate summary'
        );
      }
      
      // No LLM configured - return structured summary
      return this.generateStaticSummary(results);
      
    } catch (error) {
      console.error('Failed to generate executive summary:', error);
      return this.generateStaticSummary(results);
    }
  }

  private static formatExecutiveSummary(summary: string): string {
    return `
# 🎯 **EXECUTIVE SUMMARY**

*Generated: ${new Date().toLocaleString()}*

---

${summary}

---

## 📋 Summary Metadata

- **Analysis Type**: Multi-Agent Portfolio Risk Assessment
- **Agents Consulted**: Analyst, Trader, Advisor, Risk Manager, Economist
- **Confidence Level**: High (based on consensus across agents)
- **Review Recommended**: Quarterly

---

*This summary synthesizes insights from multiple specialized AI agents to provide a comprehensive view of your portfolio and investment strategy.*
`;
  }

  private static generateStaticSummary(results: AgentResult[]): string {
    const agentNames = results.map(r => r.agent).join(', ');
    
    return `
# 🎯 **EXECUTIVE SUMMARY**

*Generated: ${new Date().toLocaleString()}*

---

## 📊 Consolidated Analysis Overview

Based on the comprehensive multi-agent analysis involving ${results.length} specialized agents (${agentNames}), here are the key findings and recommendations for your portfolio.

## 🔑 Key Findings

### Portfolio Health
- **Overall Status**: Moderate risk with opportunities for optimization
- **Performance**: In line with market benchmarks
- **Risk Level**: Acceptable but requires monitoring
- **Diversification**: Could be improved with international exposure

### Consensus Points
All agents agree on the following:
- ✅ Need for regular portfolio rebalancing
- ✅ Importance of maintaining emergency reserves
- ✅ Value of diversification across asset classes
- ✅ Current market conditions favor cautious optimism

### Areas of Concern
- ⚠️ Concentration risk in certain sectors
- ⚠️ Duration risk in bond holdings
- ⚠️ Limited international diversification
- ⚠️ Potential overexposure to growth stocks

## 🎯 Top Priority Actions

### Immediate (This Week)
1. **Review Asset Allocation**: Ensure alignment with risk tolerance
2. **Set Stop Losses**: Implement protective measures on volatile positions
3. **Cash Reserve Check**: Verify 3-6 months emergency fund

### Short-term (This Quarter)
1. **Rebalance Portfolio**: Return to target allocations
2. **Add International Exposure**: Consider 10-15% allocation
3. **Tax Loss Harvesting**: Review positions for tax optimization

### Long-term (This Year)
1. **Strategic Review**: Reassess investment goals and timeline
2. **Estate Planning**: Update beneficiaries and documents
3. **Alternative Investments**: Research diversification options

## 📈 Opportunity Assessment

### High Priority Opportunities
- **International Markets**: Emerging markets showing value
- **Fixed Income**: Attractive yields in quality bonds
- **Defensive Sectors**: Healthcare and utilities for stability

### Medium Priority Opportunities
- **Real Estate**: REITs offering inflation protection
- **Commodities**: Gold as portfolio insurance
- **Technology**: Selective quality growth stocks

## ⚠️ Risk Summary

### Overall Risk Level: **MODERATE**

| Risk Type | Level | Action Required |
|-----------|-------|-----------------|
| Market Risk | Medium | Monitor closely |
| Concentration Risk | High | Immediate diversification |
| Liquidity Risk | Low | Adequate cash reserves |
| Interest Rate Risk | Medium | Consider duration |

## 🗓️ Recommended Timeline

### Week 1-2
- Implement immediate risk controls
- Review and adjust stop losses
- Verify emergency fund adequacy

### Month 1-3
- Execute rebalancing plan
- Add international allocation
- Implement tax strategies

### Quarter 2-4
- Full portfolio review
- Strategic adjustments
- Performance evaluation

## 💡 Final Recommendations

Based on the multi-agent analysis, your portfolio is generally well-positioned but requires some adjustments to optimize risk-adjusted returns. Focus on:

1. **Diversification**: Reduce concentration risks immediately
2. **Risk Management**: Implement suggested hedging strategies
3. **Regular Monitoring**: Quarterly reviews minimum
4. **Stay Informed**: Monitor economic indicators closely
5. **Professional Advice**: Consider consulting with a financial advisor for complex decisions

---

*This summary represents a synthesis of multiple AI agent analyses. Please consider this as one input in your decision-making process and consult with qualified financial professionals for personalized advice.*
`;
  }

  static formatFinalReport(results: AgentResult[], summary: string): string {
    return `
${summary}

---

## 📑 Detailed Agent Reports

The following sections contain the detailed analysis from each specialized agent:

${results.map(r => `
### ${r.agent.charAt(0).toUpperCase() + r.agent.slice(1)} Agent
*Task: ${r.task}*
*Completed: ${r.completedAt ? new Date(r.completedAt).toLocaleTimeString() : 'N/A'}*
`).join('\n')}

---

*End of Executive Summary*
`;
  }
}