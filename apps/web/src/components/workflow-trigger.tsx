'use client';

import React from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  LineChart, 
  Shield, 
  Search,
  MessageSquare
} from 'lucide-react';
import { Card } from './ui/card';
import { cn } from '@/lib/utils';

interface WorkflowPrompt {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  prompts: string[];
  agents: string[];
}

const workflowPrompts: WorkflowPrompt[] = [
  {
    id: 'portfolioAnalysis',
    name: 'Portfolio Analysis',
    description: 'Comprehensive portfolio review with multiple perspectives',
    icon: LineChart,
    color: 'from-blue-500 to-indigo-500',
    prompts: [
      'Analyze my portfolio performance',
      'Review my investment allocation',
      'How are my investments doing?'
    ],
    agents: ['analyst', 'riskManager', 'advisor'],
  },
  {
    id: 'marketOpportunity',
    name: 'Market Scanner',
    description: 'Find trading opportunities across markets',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-500',
    prompts: [
      'Find trading opportunities today',
      'What stocks should I buy?',
      'Show me market opportunities'
    ],
    agents: ['trader', 'analyst', 'economist'],
  },
  {
    id: 'riskAssessment',
    name: 'Risk Assessment',
    description: 'Evaluate and mitigate portfolio risks',
    icon: Shield,
    color: 'from-orange-500 to-red-500',
    prompts: [
      'Assess my portfolio risk',
      'Am I too exposed to tech stocks?',
      'Help me hedge my portfolio'
    ],
    agents: ['riskManager', 'economist', 'advisor'],
  },
  {
    id: 'investmentResearch',
    name: 'Deep Research',
    description: 'In-depth analysis of specific investments',
    icon: Search,
    color: 'from-purple-500 to-pink-500',
    prompts: [
      'Research Tesla stock for me',
      'Should I invest in Apple?',
      'Deep dive on Microsoft'
    ],
    agents: ['analyst', 'economist', 'trader'],
  },
  {
    id: 'marketDebate',
    name: 'Market Debate',
    description: 'Multi-perspective debate on market direction',
    icon: MessageSquare,
    color: 'from-teal-500 to-cyan-500',
    prompts: [
      'Is a recession coming?',
      'Bull vs bear market debate',
      'Where is the market heading?'
    ],
    agents: ['economist', 'trader', 'analyst', 'riskManager'],
  },
];

interface WorkflowTriggerProps {
  onTriggerWorkflow: (prompt: string) => void;
  isLoading?: boolean;
}

export function WorkflowTrigger({ onTriggerWorkflow, isLoading }: WorkflowTriggerProps) {
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Multi-Agent Workflows</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Trigger intelligent workflows that coordinate multiple AI agents to solve complex financial problems
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflowPrompts.map((workflow) => {
          const Icon = workflow.icon;
          
          return (
            <Card key={workflow.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className={cn(
                  'p-2 rounded-lg bg-gradient-to-br text-white',
                  workflow.color
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{workflow.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {workflow.description}
                  </p>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex flex-wrap gap-1">
                  {workflow.agents.map((agent) => (
                    <span
                      key={agent}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full capitalize"
                    >
                      {agent}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Try these prompts:
                </p>
                {workflow.prompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => onTriggerWorkflow(prompt)}
                    disabled={isLoading}
                    className={cn(
                      'w-full text-left text-sm p-2 rounded',
                      'bg-gray-50 hover:bg-gray-100',
                      'dark:bg-gray-800 dark:hover:bg-gray-700',
                      'transition-colors duration-200',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    &quot;{prompt}&quot;
                  </button>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          💡 Tip: You can also trigger workflows naturally in conversation. 
          Just mention what you want to analyze!
        </p>
      </div>
    </div>
  );
}

export default WorkflowTrigger;