'use client';

import React, { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from './ui/button';
import { Building2, Loader2 } from 'lucide-react';

interface PlaidConnectProps {
  onSuccess?: () => void;
  onExit?: () => void;
}

export function PlaidConnect({ onSuccess, onExit }: PlaidConnectProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createLinkToken();
  }, []);

  const createLinkToken = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Plaid');
    } finally {
      setLoading(false);
    }
  };

  // Check if we're using a mock token
  const isMockToken = linkToken?.startsWith('link-sandbox-mock-');
  
  const { open, ready } = usePlaidLink({
    token: (!isMockToken && linkToken) || null,
    onSuccess: async (publicToken, metadata) => {
      try {
        const response = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            publicToken,
            institution: metadata.institution,
            accounts: metadata.accounts,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to exchange token');
        }

        // Trigger account sync
        await fetch('/api/plaid/sync-accounts', {
          method: 'POST',
        });

        onSuccess?.();
      } catch (err) {
        console.error('Error exchanging public token:', err);
        setError('Failed to connect account. Please try again.');
      }
    },
    onExit: (error) => {
      if (error) {
        console.error('Plaid Link error:', error);
        setError('Connection cancelled or failed');
      }
      onExit?.();
    },
  });

  if (error) {
    return (
      <div className="text-red-500 text-sm">
        {error}
        <Button
          variant="link"
          onClick={createLinkToken}
          className="ml-2"
        >
          Try again
        </Button>
      </div>
    );
  }

  // Show mock UI if using mock token
  if (isMockToken) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-yellow-600 text-sm">
          ⚠️ Plaid credentials not configured. Using mock mode.
        </div>
        <Button
          onClick={() => {
            // Simulate successful connection in mock mode
            onSuccess?.();
          }}
          className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700"
        >
          <Building2 className="mr-2 h-4 w-4" />
          Connect Bank Account (Mock)
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => open()}
      disabled={!ready || loading}
      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Building2 className="mr-2 h-4 w-4" />
      )}
      {loading ? 'Loading...' : 'Connect Bank Account'}
    </Button>
  );
}