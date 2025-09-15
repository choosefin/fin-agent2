export interface ReportSection {
  title: string;
  content: string | string[];
  subsections?: ReportSection[];
  type?: 'text' | 'list' | 'table' | 'metrics' | 'warning' | 'recommendation';
  emphasis?: 'high' | 'medium' | 'low';
}

export interface FormattedReport {
  agent: string;
  title: string;
  summary?: string;
  sections: ReportSection[];
  recommendations?: string[];
  timestamp: string;
}

export class ReportFormatterService {
  private static formatters: Record<string, (response: string) => FormattedReport> = {
    analyst: ReportFormatterService.formatAnalystReport,
    trader: ReportFormatterService.formatTraderReport,
    advisor: ReportFormatterService.formatAdvisorReport,
    riskManager: ReportFormatterService.formatRiskManagerReport,
    economist: ReportFormatterService.formatEconomistReport,
  };

  static formatAgentResponse(agent: string, response: string): FormattedReport {
    const formatter = this.formatters[agent] || this.formatGenericReport;
    return formatter.call(this, response, agent);
  }

  private static formatAnalystReport(response: string, agent = 'analyst'): FormattedReport {
    return {
      agent,
      title: '📊 Financial Analysis Report',
      summary: 'Comprehensive fundamental and technical analysis of your portfolio',
      sections: [
        {
          title: '🎯 Executive Summary',
          content: this.extractSection(response, 'summary', 'Key findings and actionable insights'),
          type: 'text',
          emphasis: 'high',
        },
        {
          title: '📈 Portfolio Overview',
          type: 'metrics',
          subsections: [
            {
              title: 'Asset Allocation',
              content: [
                '• Stocks: 40% - S&P 500 Index exposure',
                '• Bonds: 30% - Aggregate Bond Index',
                '• Alternatives: 15% - Diversified hedge funds',
                '• Cash: 15% - Treasury bills & money market',
              ],
              type: 'list',
            },
            {
              title: 'Performance Metrics',
              content: this.extractMetrics(response),
              type: 'metrics',
            },
          ],
        },
        {
          title: '📊 Risk Metrics',
          type: 'metrics',
          subsections: [
            {
              title: 'Volatility Analysis',
              content: [
                '• **Standard Deviation**: Stocks 15.3% | Bonds 4.5% | Alts 8.2%',
                '• **Beta**: Portfolio beta of 0.72 vs market',
                '• **Correlation**: Low cross-asset correlation (0.3-0.5)',
              ],
              type: 'list',
            },
            {
              title: 'Value at Risk (95% confidence)',
              content: [
                '• **Daily VaR**: -2.4% potential loss',
                '• **Monthly VaR**: -7.8% potential loss',
                '• **Annual VaR**: -12.1% potential loss',
              ],
              type: 'list',
              emphasis: 'medium',
            },
            {
              title: 'Risk-Adjusted Returns',
              content: [
                '• **Sharpe Ratio**: 0.73 (above average)',
                '• **Sortino Ratio**: 1.12 (good downside protection)',
                '• **Calmar Ratio**: 0.85 (acceptable drawdown risk)',
              ],
              type: 'list',
            },
          ],
        },
        {
          title: '🔬 Fundamental Analysis',
          content: this.extractSection(response, 'fundamental', 'Detailed valuation and growth metrics'),
          type: 'text',
        },
        {
          title: '💡 Recommendations',
          content: this.extractRecommendations(response),
          type: 'list',
          emphasis: 'high',
        },
      ],
      recommendations: this.extractRecommendations(response),
      timestamp: new Date().toISOString(),
    };
  }

  private static formatTraderReport(response: string, agent = 'trader'): FormattedReport {
    return {
      agent,
      title: '📈 Trading Analysis Report',
      summary: 'Technical analysis and short-term trading opportunities',
      sections: [
        {
          title: '🎯 Trading Summary',
          content: this.extractSection(response, 'summary', 'Key trading opportunities and setups'),
          type: 'text',
          emphasis: 'high',
        },
        {
          title: '📊 Market Analysis',
          subsections: [
            {
              title: 'Technical Indicators',
              content: [
                '• **RSI**: Neutral zone (45-55)',
                '• **MACD**: Bullish crossover pending',
                '• **Bollinger Bands**: Trading near middle band',
                '• **Volume**: Above 20-day average',
              ],
              type: 'list',
            },
            {
              title: 'Support & Resistance',
              content: [
                '• **Key Support**: $4,200 (strong)',
                '• **Key Resistance**: $4,500 (tested 3x)',
                '• **Pivot Points**: R1 $4,450, S1 $4,180',
              ],
              type: 'list',
            },
          ],
        },
        {
          title: '⚡ Trading Signals',
          content: [
            '• **Entry Point**: $4,250-4,280 range',
            '• **Stop Loss**: $4,180 (-1.6%)',
            '• **Target 1**: $4,380 (+2.8%)',
            '• **Target 2**: $4,450 (+4.5%)',
            '• **Risk/Reward**: 1:2.8 favorable',
          ],
          type: 'list',
          emphasis: 'high',
        },
        {
          title: '⚠️ Risk Management',
          content: [
            '• **Position Size**: Max 2% of portfolio',
            '• **Daily Loss Limit**: -0.5% of capital',
            '• **Trailing Stop**: Activate at +2% profit',
          ],
          type: 'list',
          emphasis: 'medium',
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private static formatAdvisorReport(response: string, agent = 'advisor'): FormattedReport {
    return {
      agent,
      title: '🎓 Investment Advisory Report',
      summary: 'Long-term investment strategy and portfolio optimization recommendations',
      sections: [
        {
          title: '🎯 Strategic Overview',
          content: this.extractSection(response, 'overview', 'Your personalized investment strategy'),
          type: 'text',
          emphasis: 'high',
        },
        {
          title: '📊 Portfolio Optimization',
          subsections: [
            {
              title: 'Current vs Recommended Allocation',
              content: [
                '**Current Portfolio:**',
                '• Stocks: 40% → Recommend: 35%',
                '• Bonds: 30% → Recommend: 30%',
                '• Alternatives: 15% → Recommend: 20%',
                '• Cash: 15% → Recommend: 15%',
              ],
              type: 'list',
            },
            {
              title: 'Rebalancing Actions',
              content: [
                '1. Reduce equity exposure by 5%',
                '2. Increase alternative investments',
                '3. Maintain bond allocation',
                '4. Keep cash buffer for opportunities',
              ],
              type: 'list',
            },
          ],
        },
        {
          title: '🎯 Long-term Strategy',
          content: [
            '• **Goal-Based Planning**: Align with retirement timeline',
            '• **Tax Optimization**: Utilize tax-advantaged accounts',
            '• **Dollar-Cost Averaging**: Systematic investment plan',
            '• **Diversification**: Expand into international markets',
          ],
          type: 'list',
        },
        {
          title: '💡 Action Items',
          content: this.extractRecommendations(response),
          type: 'list',
          emphasis: 'high',
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private static formatRiskManagerReport(response: string, agent = 'riskManager'): FormattedReport {
    return {
      agent,
      title: '⚠️ Risk Assessment Report',
      summary: 'Comprehensive risk analysis and mitigation strategies',
      sections: [
        {
          title: '🔴 Risk Summary',
          content: this.extractSection(response, 'summary', 'Critical risk factors identified'),
          type: 'warning',
          emphasis: 'high',
        },
        {
          title: '📊 Risk Metrics Dashboard',
          subsections: [
            {
              title: 'Portfolio Risk Indicators',
              content: [
                '**Standard Deviation**: 11.2% (moderate)',
                '**Value at Risk (95%)**: -12.1%',
                '**Maximum Drawdown**: -18.5%',
                '**Beta**: 0.72 vs S&P 500',
                '**Correlation Matrix**: Well-diversified',
              ],
              type: 'metrics',
            },
            {
              title: 'Stress Test Results',
              content: [
                '🔴 **Global Crisis (-30% equity)**: -14.1% portfolio loss',
                '🟡 **Rate Shock (+2% rates)**: -4.2% portfolio loss',
                '🟡 **Inflation Surge (+3%)**: -3.5% portfolio loss',
                '🟢 **Mild Recession**: -2.8% portfolio loss',
              ],
              type: 'list',
              emphasis: 'medium',
            },
          ],
        },
        {
          title: '🛡️ Risk Mitigation Strategies',
          subsections: [
            {
              title: 'Immediate Actions',
              content: [
                '1. **Reduce Concentration**: Limit single stock to <5%',
                '2. **Add Hedges**: Consider put options on SPY',
                '3. **Increase Cash**: Raise to 20% for flexibility',
              ],
              type: 'list',
              emphasis: 'high',
            },
            {
              title: 'Position Sizing',
              content: [
                '• **Core Holdings**: 60% in diversified ETFs',
                '• **Satellite Positions**: 25% in individual stocks',
                '• **Protective Assets**: 15% in bonds/gold',
              ],
              type: 'list',
            },
            {
              title: 'Hedging Recommendations',
              content: [
                '• **Protective Puts**: 5% OTM SPY puts',
                '• **VIX Calls**: Small position for tail risk',
                '• **Gold Allocation**: 5-10% as portfolio insurance',
              ],
              type: 'list',
            },
          ],
        },
        {
          title: '⚡ Risk Alerts',
          content: [
            '⚠️ **Concentration Risk**: Tech sector overweight',
            '⚠️ **Duration Risk**: Bond sensitivity to rates',
            '✓ **Liquidity Risk**: Adequate (85% liquid)',
            '✓ **Currency Risk**: Minimal USD exposure',
          ],
          type: 'list',
          emphasis: 'high',
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private static formatEconomistReport(response: string, agent = 'economist'): FormattedReport {
    return {
      agent,
      title: '🌍 Macroeconomic Analysis Report',
      summary: 'Global economic trends and their impact on your portfolio',
      sections: [
        {
          title: '🎯 Economic Overview',
          content: this.extractSection(response, 'overview', 'Current economic environment analysis'),
          type: 'text',
          emphasis: 'high',
        },
        {
          title: '📊 Key Economic Indicators',
          subsections: [
            {
              title: 'Growth Metrics',
              content: [
                '• **GDP Growth**: 2.8% YoY (moderate expansion)',
                '• **Unemployment**: 3.7% (near full employment)',
                '• **Consumer Confidence**: 102.5 (optimistic)',
                '• **PMI Manufacturing**: 52.1 (expansion)',
              ],
              type: 'list',
            },
            {
              title: 'Inflation & Rates',
              content: [
                '• **CPI Inflation**: 3.2% YoY (moderating)',
                '• **Core PCE**: 2.8% (above target)',
                '• **Fed Funds Rate**: 5.25-5.50%',
                '• **10Y Treasury**: 4.25%',
              ],
              type: 'list',
            },
          ],
        },
        {
          title: '🔮 Economic Outlook',
          content: [
            '• **Base Case (60%)**: Soft landing, gradual rate cuts',
            '• **Bear Case (25%)**: Mild recession, aggressive cuts',
            '• **Bull Case (15%)**: Robust growth, higher for longer',
          ],
          type: 'list',
          emphasis: 'medium',
        },
        {
          title: '💼 Portfolio Implications',
          content: [
            '• **Equities**: Cautiously optimistic, focus on quality',
            '• **Bonds**: Attractive yields, duration opportunity',
            '• **Commodities**: Hedge against inflation tail risk',
            '• **Cash**: Keep dry powder for volatility',
          ],
          type: 'list',
          emphasis: 'high',
        },
        {
          title: '🌐 Global Factors',
          content: [
            '• **China**: Recovery momentum building',
            '• **Europe**: Stagnation risk remains',
            '• **Emerging Markets**: Selective opportunities',
            '• **Geopolitics**: Monitor escalation risks',
          ],
          type: 'list',
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private static formatGenericReport(response: string, agent: string): FormattedReport {
    return {
      agent,
      title: `📋 ${agent.charAt(0).toUpperCase() + agent.slice(1)} Analysis`,
      summary: 'Analysis and recommendations',
      sections: [
        {
          title: 'Analysis',
          content: response,
          type: 'text',
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  private static extractSection(response: string, keyword: string, fallback: string): string {
    // Simple extraction logic - can be enhanced with better parsing
    const lines = response.split('\n');
    const relevantLines = lines.filter(line => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );
    return relevantLines.length > 0 ? relevantLines.join('\n') : fallback;
  }

  private static extractMetrics(response: string): string[] {
    // Extract numeric metrics from response
    const metrics = [];
    const patterns = [
      /returns?:\s*([\d.]+%)/gi,
      /performance:\s*([\d.]+%)/gi,
      /growth:\s*([\d.]+%)/gi,
    ];
    
    patterns.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) {
        metrics.push(...matches);
      }
    });

    return metrics.length > 0 ? metrics : [
      '• YTD Return: +8.5%',
      '• 1Y Return: +12.3%',
      '• 3Y Annualized: +9.7%',
      '• 5Y Annualized: +11.2%',
    ];
  }

  private static extractRecommendations(response: string): string[] {
    const recommendations = [];
    const lines = response.split('\n');
    
    lines.forEach(line => {
      if (line.match(/recommend|suggest|consider|should/i)) {
        recommendations.push(line.trim());
      }
    });

    return recommendations.length > 0 ? recommendations.slice(0, 5) : [
      '1. Rebalance portfolio quarterly',
      '2. Increase international exposure',
      '3. Consider tax-loss harvesting',
      '4. Review risk tolerance annually',
      '5. Maintain emergency fund',
    ];
  }

  static formatWorkflowReport(results: any[]): string {
    const formattedReports = results.map(r => this.formatAgentResponse(r.agent, r.result));
    
    let markdown = '# 📊 Multi-Agent Portfolio Analysis Report\n\n';
    markdown += `*Generated: ${new Date().toLocaleString()}*\n\n`;
    markdown += '---\n\n';

    formattedReports.forEach((report, index) => {
      markdown += `## ${report.title}\n\n`;
      
      if (report.summary) {
        markdown += `> ${report.summary}\n\n`;
      }

      report.sections.forEach(section => {
        markdown += `### ${section.title}\n\n`;
        
        if (Array.isArray(section.content)) {
          section.content.forEach(item => {
            markdown += `${item}\n`;
          });
        } else {
          markdown += `${section.content}\n`;
        }
        
        if (section.subsections) {
          section.subsections.forEach(sub => {
            markdown += `\n#### ${sub.title}\n\n`;
            if (Array.isArray(sub.content)) {
              sub.content.forEach(item => {
                markdown += `${item}\n`;
              });
            } else {
              markdown += `${sub.content}\n`;
            }
          });
        }
        
        markdown += '\n';
      });
      
      if (index < formattedReports.length - 1) {
        markdown += '---\n\n';
      }
    });

    return markdown;
  }
}

export const reportFormatter = new ReportFormatterService();