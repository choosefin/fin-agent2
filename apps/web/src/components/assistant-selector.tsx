'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Brain, TrendingUp, DollarSign, Shield, LineChart, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export interface AssistantProfile {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  expertise: string[];
}

const assistantProfiles: AssistantProfile[] = [
  {
    id: 'general',
    name: 'General Assistant',
    description: 'Balanced financial analysis and general advice',
    color: 'bg-blue-500',
    icon: Brain,
    expertise: ['General Finance', 'Education', 'Guidance'],
  },
  {
    id: 'analyst',
    name: 'Financial Analyst',
    description: 'Deep fundamental and technical analysis',
    color: 'bg-green-500',
    icon: LineChart,
    expertise: ['Fundamental Analysis', 'Technical Analysis', 'Valuations'],
  },
  {
    id: 'trader',
    name: 'Trading Assistant',
    description: 'Short-term trading and market timing',
    color: 'bg-orange-500',
    icon: TrendingUp,
    expertise: ['Day Trading', 'Technical Indicators', 'Risk Management'],
  },
  {
    id: 'advisor',
    name: 'Investment Advisor',
    description: 'Long-term investment strategy and planning',
    color: 'bg-purple-500',
    icon: DollarSign,
    expertise: ['Portfolio Strategy', 'Retirement Planning', 'Tax Optimization'],
  },
  {
    id: 'riskManager',
    name: 'Risk Manager',
    description: 'Portfolio risk assessment and mitigation',
    color: 'bg-red-500',
    icon: Shield,
    expertise: ['Risk Assessment', 'Hedging', 'Stress Testing'],
  },
  {
    id: 'economist',
    name: 'Macro Economist',
    description: 'Economic trends and policy analysis',
    color: 'bg-indigo-500',
    icon: Globe,
    expertise: ['Economic Trends', 'Policy Impact', 'Market Cycles'],
  },
];

interface AssistantSelectorProps {
  selectedAssistant: AssistantProfile;
  onSelectAssistant: (assistant: AssistantProfile) => void;
}

export function AssistantSelector({ 
  selectedAssistant, 
  onSelectAssistant 
}: AssistantSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const Icon = selectedAssistant.icon;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <div className={cn('h-2 w-2 rounded-full', selectedAssistant.color)} />
            <Icon className="h-4 w-4" />
            <span>{selectedAssistant.name}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-full min-w-[300px] p-2 bg-white dark:bg-gray-900 border rounded-lg shadow-lg"
        align="start"
      >
        {assistantProfiles.map((profile) => {
          const ProfileIcon = profile.icon;
          return (
            <DropdownMenuItem
              key={profile.id}
              className="flex flex-col items-start gap-1 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              onSelect={() => {
                onSelectAssistant(profile);
                setOpen(false);
              }}
            >
              <div className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', profile.color)} />
                <ProfileIcon className="h-4 w-4" />
                <span className="font-medium">{profile.name}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {profile.description}
              </p>
              <div className="flex gap-1 mt-1">
                {profile.expertise.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { assistantProfiles };
export default AssistantSelector;