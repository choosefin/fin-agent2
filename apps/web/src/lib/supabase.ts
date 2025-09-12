import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fuaogvgmdgndldimnnrs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YW9ndmdtZGduZGxkaW1ubnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDY2ODQ0MjIsImV4cCI6MTk2MjI2MDQyMn0.dummy-key-for-build';

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);