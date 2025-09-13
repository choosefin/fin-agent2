import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Set the workspace root to silence lockfile warnings
  outputFileTracingRoot: '../../',
  // Azure App Service compatibility
  serverExternalPackages: ['@supabase/supabase-js'],
  // Ensure proper handling of environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
};

export default nextConfig;
