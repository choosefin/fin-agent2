'use client';

import React from 'react';
import { 
  Brain, 
  TrendingUp, 
  Shield, 
  DollarSign, 
  Globe,
  CheckCircle,
  Loader2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentStatus {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  result?: string;
  startTime?: Date;
  endTime?: Date;
  currentAction?: string;
}

interface AgentStatusPanelProps {
  agents: AgentStatus[];
  workflowId: string;
  estimatedTime?: number;
  onClose?: () => void;
}

const agentIcons: Record<string, React.FC<{ className?: string }>> = {
  analyst: Brain,
  trader: TrendingUp,
  advisor: DollarSign,
  riskManager: Shield,
  economist: Globe,
};

const agentColors: Record<string, string> = {
  analyst: 'from-purple-500 to-purple-600',
  trader: 'from-green-500 to-green-600',
  advisor: 'from-blue-500 to-blue-600',
  riskManager: 'from-orange-500 to-orange-600',
  economist: 'from-indigo-500 to-indigo-600',
};

export function AgentStatusPanel({ 
  agents, 
  workflowId, 
  estimatedTime
  // onClose is optional and not used internally
}: AgentStatusPanelProps) {
  const completedCount = agents.filter(a => a.status === 'completed').length;
  const totalCount = agents.length;
  const overallProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const getStatusIcon = (status: AgentStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getElapsedTime = (agent: AgentStatus) => {
    if (!agent.startTime) return null;
    const end = agent.endTime || new Date();
    const elapsed = Math.floor((end.getTime() - agent.startTime.getTime()) / 1000);
    return `${elapsed}s`;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Multi-Agent Analysis
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {completedCount} of {totalCount} agents completed
          </p>
        </div>
        {estimatedTime && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Est. time: {estimatedTime}s
          </div>
        )}
      </div>

      {/* Overall Progress Bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Agent Cards */}
      <div className="space-y-3">
        {agents.map((agent) => {
          const Icon = agentIcons[agent.id] || Brain;
          const colorClass = agentColors[agent.id] || 'from-gray-500 to-gray-600';
          
          return (
            <div 
              key={agent.id}
              className={cn(
                "relative rounded-lg border transition-all duration-300",
                agent.status === 'processing' && "border-blue-500 shadow-md",
                agent.status === 'completed' && "border-green-500 bg-green-50 dark:bg-green-900/10",
                agent.status === 'error' && "border-red-500 bg-red-50 dark:bg-red-900/10",
                agent.status === 'pending' && "border-gray-300 dark:border-gray-600 opacity-60"
              )}
            >
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {/* Agent Icon */}
                    <div className={cn(
                      "h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center",
                      colorClass
                    )}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    
                    {/* Agent Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                          {agent.name}
                        </h4>
                        {getStatusIcon(agent.status)}
                      </div>
                      
                      {/* Current Action or Result Preview */}
                      {agent.currentAction && agent.status === 'processing' && (
                        <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                          {agent.currentAction}
                        </p>
                      )}
                      
                      {agent.result && agent.status === 'completed' && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {agent.result}
                        </p>
                      )}
                      
                      {agent.status === 'error' && (
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          Failed to complete analysis
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Timing */}
                  {agent.status !== 'pending' && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {getElapsedTime(agent)}
                    </div>
                  )}
                </div>

                {/* Individual Progress Bar */}
                {agent.status === 'processing' && agent.progress !== undefined && (
                  <div className="mt-3">
                    <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${agent.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Processing Animation */}
              {agent.status === 'processing' && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Workflow ID Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Workflow ID: {workflowId}
        </p>
      </div>
    </div>
  );
}