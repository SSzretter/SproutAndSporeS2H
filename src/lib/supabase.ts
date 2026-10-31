import { createClient } from '@supabase/supabase-js';
import { SimulationState } from '../types/sim';

// Default Supabase project credentials provided for this project
const DEFAULT_SUPABASE_URL = 'https://hwujvjzazdsvbkwxddhd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_RwWcW9ws3BgOoReHn51PtA_4LGI3b7K';

// Read from Vite or Next-style env variables with fallback to project defaults
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL)) ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) ||
  DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export interface CloudSimulationRecord {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  facility_name?: string;
  room_count: number;
  plant_count: number;
  mushroom_count: number;
  sim_time: number;
  data: SimulationState;
  created_at: string;
  updated_at: string;
}

export type CloudSimulationSummary = Omit<CloudSimulationRecord, 'data'>;

export const SUPABASE_SETUP_SQL = `-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
CREATE TABLE IF NOT EXISTS simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  facility_name TEXT DEFAULT 'Indoor Grow Lab',
  room_count INTEGER DEFAULT 1,
  plant_count INTEGER DEFAULT 0,
  mushroom_count INTEGER DEFAULT 0,
  sim_time BIGINT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for speedy queries by user
CREATE INDEX IF NOT EXISTS idx_simulations_user_id ON simulations(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if re-running
DROP POLICY IF EXISTS "Users can manage own simulations" ON simulations;

-- Create policy so each authenticated user can only view, insert, update and delete their own simulations
CREATE POLICY "Users can manage own simulations"
  ON simulations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
`;
