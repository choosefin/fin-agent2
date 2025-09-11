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

  const { open, ready } = usePlaidLink({
    token: linkToken,
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
    onExit: (error, metadata) => {
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