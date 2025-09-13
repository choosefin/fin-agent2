'use client';

import { useState } from 'react';
import { AssistantSelector, assistantProfiles, AssistantProfile } from '@/components/assistant-selector';
import { UnifiedChatInterface } from '@/components/unified-chat-interface';
import { PlaidConnect } from '@/components/plaid-connect';
import { Button } from '@/components/ui/button';
import { TrendingUp, Menu, X, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { AuthForm } from '@/components/auth-form';

export default function HomePage() {
  const [selectedAssistant, setSelectedAssistant] = useState<AssistantProfile>(assistantProfiles[0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showPlaidConnect, setShowPlaidConnect] = useState(false);
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <AuthForm />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white dark:bg-gray-800 border-r overflow-hidden`}>
        <div className="p-4">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <TrendingUp className="h-8 w-8 text-blue-500" />
            <h1 className="text-xl font-bold">Fin Agent</h1>
          </div>

          {/* User Info */}
          <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Signed in as</p>
            <p className="text-sm font-medium truncate">{user.email}</p>
          </div>

          {/* Assistant Selector */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Select Assistant
            </label>
            <AssistantSelector
              selectedAssistant={selectedAssistant}
              onSelectAssistant={setSelectedAssistant}
            />
          </div>

          {/* Plaid Connect */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Bank Connection
            </label>
            {showPlaidConnect ? (
              <PlaidConnect
                onSuccess={() => {
                  setShowPlaidConnect(false);
                  // Refresh accounts
                }}
                onExit={() => setShowPlaidConnect(false)}
              />
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowPlaidConnect(true)}
              >
                Manage Accounts
              </Button>
            )}
          </div>

          {/* Portfolio Summary */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Portfolio Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Total Value</span>
                <span className="font-medium">$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Today&apos;s Change</span>
                <span className="font-medium text-green-500">+0.00%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Connected Accounts</span>
                <span className="font-medium">0</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <TrendingUp className="mr-2 h-4 w-4" />
              View Charts
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div>
              <h2 className="text-lg font-semibold">{selectedAssistant.name}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedAssistant.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${selectedAssistant.color}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">Online</span>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 overflow-hidden">
          <UnifiedChatInterface assistant={selectedAssistant} />
        </div>
      </div>
    </div>
  );
}
