import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Azure App Service compatibility
  experimental: {
    // Disable features that might cause issues on Azure
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  // Ensure proper handling of environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
};

export default nextConfig;
