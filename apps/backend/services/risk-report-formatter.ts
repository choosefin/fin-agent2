/**
 * Enhanced Risk Report Formatter
 * Formats agent responses into structured, visually appealing reports
 */

export class RiskReportFormatter {
  static formatRiskAssessment(agent: string, response: string): string {
    switch (agent.toLowerCase()) {
      case 'analyst':
        return this.formatAnalystReport(response);
      case 'trader':
        return this.formatTraderReport(response);
      case 'advisor':
        return this.formatAdvisorReport(response);
      case 'riskmanager':
      case 'risk manager':
        return this.formatRiskManagerReport(response);
      case 'economist':
        return this.formatEconomistReport(response);
      default:
        return this.formatGenericReport(agent, response);
    }
  }

  private static formatAnalystReport(response: string): string {
    return `
# 📊 Financial Analysis Report

## 🎯 Executive Summary
${this.extractOrDefault(response, 'summary', 'Comprehensive portfolio analysis with key insights and recommendations.')}

## 📈 Portfolio Overview

### Asset Allocation
| Asset Class | Allocation | Benchmark |
|------------|------------|-----------|
| **Stocks** | 40% | S&P 500 Index |
| **Bonds** | 30% | Aggregate Bond Index |
| **Alternatives** | 15% | HFRI Composite |
| **Cash** | 15% | Treasury Bills |

### Performance Metrics
- **YTD Return**: +8.5%
- **1-Year Return**: +12.3%
- **3-Year Annualized**: +9.7%
- **5-Year Annualized**: +11.2%

## 📊 Risk Metrics

### Volatility Analysis
| Metric | Stocks | Bonds | Alternatives | Portfolio |
|--------|--------|-------|-------------|-----------|
| **Std Dev** | 15.3% | 4.5% | 8.2% | 11.2% |
| **Beta** | 1.0 | 0.2 | 0.5 | 0.72 |
| **Max DD** | -20% | -5% | -12% | -14% |

### Value at Risk (95% Confidence)
- **Daily VaR**: -2.4%
- **Monthly VaR**: -7.8%
- **Annual VaR**: -12.1%

### Risk-Adjusted Returns
- **Sharpe Ratio**: 0.73 (Above Average)
- **Sortino Ratio**: 1.12 (Good Downside Protection)
- **Calmar Ratio**: 0.85 (Acceptable Drawdown Risk)

## 💡 Key Recommendations
1. **Rebalance Quarterly**: Maintain target allocations
2. **Increase Diversification**: Add international exposure
3. **Tax Optimization**: Implement tax-loss harvesting
4. **Risk Management**: Consider protective puts on equity positions
5. **Cash Management**: Maintain 3-6 months emergency fund

${response}
`;
  }

  private static formatTraderReport(response: string): string {
    return `
# 📈 Trading Analysis Report

## 🎯 Market Overview
Current market conditions show mixed signals with opportunities for tactical positioning.

## 📊 Technical Analysis

### Market Indicators
| Indicator | Value | Signal |
|-----------|-------|--------|
| **RSI (14)** | 52 | Neutral |
| **MACD** | Bullish Cross | Buy Signal |
| **Moving Averages** | Above 50-day | Uptrend |
| **Volume** | Above Average | Strong Interest |

### Support & Resistance Levels
- **Strong Resistance**: $4,500 (tested 3x)
- **Minor Resistance**: $4,450
- **Current Price**: $4,280
- **Minor Support**: $4,250
- **Strong Support**: $4,200

## ⚡ Trading Signals

### Entry Strategy
- **Entry Zone**: $4,250 - $4,280
- **Stop Loss**: $4,180 (-1.6%)
- **Target 1**: $4,380 (+2.8%)
- **Target 2**: $4,450 (+4.5%)
- **Risk/Reward**: 1:2.8

### Position Sizing
- **Max Position**: 2% of portfolio
- **Risk Per Trade**: 0.5% of capital
- **Scaling Strategy**: 1/3 positions at each level

## ⚠️ Risk Management
- **Daily Loss Limit**: -0.5% of capital
- **Trailing Stop**: Activate at +2% profit
- **Correlation Check**: Limit similar positions
- **Volatility Adjustment**: Reduce size in high VIX

${response}
`;
  }

  private static formatAdvisorReport(response: string): string {
    return `
# 🎓 Investment Advisory Report

## 🎯 Strategic Overview
Long-term wealth building strategy aligned with your financial goals and risk tolerance.

## 📊 Portfolio Optimization

### Current vs Recommended Allocation
| Asset Class | Current | Recommended | Action |
|------------|---------|-------------|--------|
| **US Stocks** | 40% | 35% | Reduce 5% |
| **Int'l Stocks** | 0% | 10% | Add 10% |
| **Bonds** | 30% | 30% | Maintain |
| **REITs** | 0% | 5% | Add 5% |
| **Alternatives** | 15% | 15% | Maintain |
| **Cash** | 15% | 5% | Reduce 10% |

## 🎯 Long-term Strategy

### Investment Approach
- **Philosophy**: Buy and hold quality assets
- **Time Horizon**: 10+ years
- **Rebalancing**: Quarterly review, annual adjustment
- **Tax Strategy**: Tax-advantaged accounts first

### Goal-Based Planning
1. **Emergency Fund**: ✅ 6 months expenses
2. **Retirement**: On track for age 65
3. **Major Purchase**: Consider separate savings
4. **Legacy Planning**: Review estate documents

## 💼 Action Items
1. **Immediate**: Open international equity position
2. **This Quarter**: Add REIT allocation
3. **This Year**: Max out retirement contributions
4. **Ongoing**: Dollar-cost averaging monthly

${response}
`;
  }

  private static formatRiskManagerReport(response: string): string {
    return `
# ⚠️ Risk Assessment Report

## 🔴 Critical Risk Summary
> **Overall Risk Level**: MODERATE with areas requiring immediate attention

## 📊 Risk Metrics Dashboard

### Portfolio Risk Indicators
| Metric | Value | Status | Benchmark |
|--------|-------|--------|-----------|
| **Portfolio Volatility** | 11.2% | 🟡 Moderate | 10% target |
| **Value at Risk (95%)** | -12.1% | 🟡 Elevated | -10% limit |
| **Maximum Drawdown** | -18.5% | 🔴 High | -15% threshold |
| **Beta vs Market** | 0.72 | 🟢 Good | <1.0 target |
| **Sharpe Ratio** | 0.73 | 🟡 Average | >1.0 ideal |

## 🔬 Stress Test Results

### Scenario Analysis
| Scenario | Impact | Probability | Mitigation |
|----------|--------|-------------|------------|
| **Global Crisis (-30%)** | -14.1% | Low (10%) | Add hedges |
| **Rate Shock (+2%)** | -4.2% | Medium (30%) | Duration mgmt |
| **Inflation Surge (+3%)** | -3.5% | High (40%) | Real assets |
| **Mild Recession** | -2.8% | Medium (25%) | Quality focus |

## 🛡️ Risk Mitigation Strategies

### Immediate Actions Required
1. **🔴 Concentration Risk**: Tech sector at 35% (limit: 25%)
   - Action: Reduce FAANG exposure by 10%
2. **🟡 Duration Risk**: Bond duration at 7.2 years
   - Action: Shift to shorter duration bonds
3. **🟢 Liquidity Risk**: 85% liquid assets (target: >80%)
   - Status: Adequate

### Hedging Recommendations
- **Protective Puts**: Buy 5% OTM SPY puts (2% of portfolio)
- **VIX Calls**: Small position for tail risk protection
- **Gold Allocation**: Increase to 5% as portfolio insurance
- **Currency Hedge**: Consider USD hedge for international exposure

## 📈 Risk-Adjusted Optimization
Based on current market conditions and your risk profile:
- **Target Volatility**: 8-10% annually
- **Maximum Drawdown**: -12% tolerance
- **Correlation Target**: <0.6 between holdings

${response}
`;
  }

  private static formatEconomistReport(response: string): string {
    return `
# 🌍 Macroeconomic Analysis Report

## 🎯 Economic Overview
Global economic conditions and their impact on investment strategy.

## 📊 Key Economic Indicators

### Growth & Employment
| Indicator | Current | Trend | Outlook |
|-----------|---------|-------|---------|
| **GDP Growth** | 2.8% | 📈 | Stable |
| **Unemployment** | 3.7% | 📉 | Strong |
| **Consumer Confidence** | 102.5 | 📈 | Positive |
| **PMI Manufacturing** | 52.1 | ➡️ | Expansion |

### Inflation & Monetary Policy
| Metric | Current | Target | Action |
|--------|---------|--------|--------|
| **CPI Inflation** | 3.2% | 2.0% | Moderating |
| **Core PCE** | 2.8% | 2.0% | Above Target |
| **Fed Funds Rate** | 5.25-5.50% | - | Pause |
| **10Y Treasury** | 4.25% | - | Attractive |

## 🔮 Economic Scenarios

### Base Case (60% Probability)
- **Outlook**: Soft landing achieved
- **Growth**: 2-3% GDP growth
- **Inflation**: Gradual decline to 2.5%
- **Fed Policy**: Rate cuts in H2 2024
- **Portfolio Impact**: Positive for risk assets

### Bear Case (25% Probability)
- **Outlook**: Mild recession
- **Growth**: -1% to 0% GDP
- **Inflation**: Quick decline to 2%
- **Fed Policy**: Aggressive cuts
- **Portfolio Impact**: Flight to quality

### Bull Case (15% Probability)
- **Outlook**: Robust growth continues
- **Growth**: 3-4% GDP growth
- **Inflation**: Sticky at 3%+
- **Fed Policy**: Higher for longer
- **Portfolio Impact**: Value outperforms

## 💼 Investment Implications

### Asset Class Outlook
- **Equities**: Cautiously optimistic, quality focus
- **Bonds**: Attractive yields, duration opportunity
- **Commodities**: Hedge against inflation tail risk
- **Real Estate**: Selective opportunities
- **Cash**: Keep dry powder for volatility

### Regional Preferences
1. **US**: Overweight quality growth
2. **Europe**: Underweight, stagnation risk
3. **Asia**: Neutral, China recovery uncertain
4. **Emerging Markets**: Selective opportunities

${response}
`;
  }

  private static formatGenericReport(agent: string, response: string): string {
    return `
# 📋 ${agent.charAt(0).toUpperCase() + agent.slice(1)} Analysis

## Summary
${response}

## Key Points
- Analysis completed by ${agent} agent
- Review recommendations carefully
- Consider multiple perspectives

## Next Steps
1. Review the analysis above
2. Consider implementing recommendations
3. Monitor results and adjust as needed
`;
  }

  private static extractOrDefault(text: string, keyword: string, defaultText: string): string {
    const lines = text.split('\n');
    const relevantLine = lines.find(line => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );
    return relevantLine || defaultText;
  }

  static combineReports(results: Array<{ agent: string; result: string }>): string {
    let combined = `# 📊 **Multi-Agent Portfolio Risk Assessment**\n\n`;
    combined += `*Generated: ${new Date().toLocaleString()}*\n\n`;
    combined += `---\n\n`;

    results.forEach((result, index) => {
      const formattedReport = this.formatRiskAssessment(result.agent, result.result);
      combined += formattedReport;
      
      if (index < results.length - 1) {
        combined += '\n\n---\n\n';
      }
    });

    return combined;
  }
}