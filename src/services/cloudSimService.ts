import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, CloudSimulationRecord, CloudSimulationSummary } from '../lib/supabase';
import { SimulationState } from '../types/sim';

export interface FacilityMetrics {
  facilityName: string;
  roomCount: number;
  plantCount: number;
  mushroomCount: number;
  simTime: number;
}

/**
 * Computes high-level facility metrics from simulation state
 */
export function extractFacilityMetrics(state: SimulationState): FacilityMetrics {
  const rooms = state.rooms && state.rooms.length > 0 ? state.rooms : [state.room];
  const roomCount = rooms.length;
  
  let plantCount = 0;
  let mushroomCount = 0;

  rooms.forEach(r => {
    (r.items || []).forEach(i => {
      if (i.category === 'plant') plantCount++;
      if (i.category === 'mushroom') mushroomCount++;
    });
    (r.tents || []).forEach(t => {
      (t.items || []).forEach(i => {
        if (i.category === 'plant') plantCount++;
        if (i.category === 'mushroom') mushroomCount++;
      });
    });
  });

  const facilityName = state.room?.name || rooms[0]?.name || 'Indoor Grow Facility';

  return {
    facilityName,
    roomCount,
    plantCount,
    mushroomCount,
    simTime: state.simTime
  };
}

// ================= AUTH METHODS =================

export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

/**
 * Sign up with Email and Password
 */
export async function signUpWithPassword(email: string, password: string): Promise<{ user: User | null; error: AuthError | null; needsEmailConfirm?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { user: null, error };
  }

  // If user is returned but session is null, email confirmation is enabled on the Supabase project
  const needsEmailConfirm = !!data.user && !data.session;
  return { user: data.user, error: null, needsEmailConfirm };
}

/**
 * Sign in with Email and Password
 */
export async function signInWithPassword(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

/**
 * Resolves the accurate redirect URL for both root domains (AI Studio / localhost)
 * and subpath domains like GitHub Pages (https://sszretter.github.io/SproutAndSporeS2H/)
 */
export function getAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const cleanPath = pathname.replace(/\/index\.html$/, '');
  const finalPath = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
  return `${origin}${finalPath}`;
}

/**
 * Send OTP / Magic link to user's email
 */
export async function signInWithOtp(email: string): Promise<{ error: AuthError | null }> {
  const redirectUrl = getAuthRedirectUrl();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
      shouldCreateUser: true,
    }
  });
  return { error };
}

/**
 * Verify Email OTP token
 */
export async function verifyEmailOtp(email: string, token: string): Promise<{ user: User | null; error: AuthError | null }> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

/**
 * Complete authentication from a redirected URL (e.g. when link opened to localhost:3000/#access_token=...)
 */
export async function setSessionFromUrlOrHash(input: string): Promise<{ user: User | null; error: Error | null }> {
  try {
    const raw = input.trim();
    if (!raw) {
      return { user: null, error: new Error('Please paste the URL containing access_token.') };
    }

    // Check if it contains query params with code (PKCE)
    if (raw.includes('code=')) {
      try {
        const urlObj = new URL(raw.startsWith('http') ? raw : `http://localhost/${raw}`);
        const code = urlObj.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) return { user: null, error };
          return { user: data.user, error: null };
        }
      } catch {
        // Fall through to hash parsing
      }
    }

    // Handle hash containing access_token & refresh_token (Implicit Magic Link)
    let hashPart = raw;
    if (hashPart.includes('#')) {
      hashPart = hashPart.split('#')[1];
    } else if (hashPart.includes('?')) {
      hashPart = hashPart.split('?')[1];
    }

    const params = new URLSearchParams(hashPart);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      return { 
        user: null, 
        error: new Error('Could not find access_token and refresh_token in the provided URL. Make sure to paste the full URL.') 
      };
    }

    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (err: any) {
    return { user: null, error: err };
  }
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const redirectUrl = getAuthRedirectUrl();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  });

  return { error };
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// ================= SIMULATION CRUD METHODS =================

export interface SimulationServiceResult<T> {
  data: T | null;
  error: string | null;
  isTableMissing?: boolean;
}

/**
 * Fetch all simulation summaries for the authenticated user
 */
export async function listUserSimulations(): Promise<SimulationServiceResult<CloudSimulationSummary[]>> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: 'User is not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('simulations')
      .select('id, user_id, name, description, facility_name, room_count, plant_count, mushroom_count, sim_time, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      const isMissing = error.code === '42P01' || error.message.toLowerCase().includes('relation') || error.message.toLowerCase().includes('does not exist');
      return { 
        data: null, 
        error: error.message,
        isTableMissing: isMissing
      };
    }

    return { data: (data as CloudSimulationSummary[]) || [], error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to list simulations' };
  }
}

/**
 * Fetch a single simulation record with full SimulationState
 */
export async function loadUserSimulation(simulationId: string): Promise<SimulationServiceResult<CloudSimulationRecord>> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: 'User is not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('id', simulationId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as CloudSimulationRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to load simulation' };
  }
}

/**
 * Save a new simulation state to Supabase
 */
export async function saveNewSimulation(
  name: string,
  description: string,
  state: SimulationState
): Promise<SimulationServiceResult<CloudSimulationRecord>> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: 'User is not authenticated' };
  }

  const metrics = extractFacilityMetrics(state);

  try {
    const payload = {
      user_id: user.id,
      name: name.trim() || 'Grow Simulation',
      description: description.trim(),
      facility_name: metrics.facilityName,
      room_count: metrics.roomCount,
      plant_count: metrics.plantCount,
      mushroom_count: metrics.mushroomCount,
      sim_time: metrics.simTime,
      data: state,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('simulations')
      .insert([payload])
      .select()
      .single();

    if (error) {
      const isMissing = error.code === '42P01' || error.message.toLowerCase().includes('relation') || error.message.toLowerCase().includes('does not exist');
      return { 
        data: null, 
        error: error.message,
        isTableMissing: isMissing
      };
    }

    return { data: data as CloudSimulationRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to save simulation' };
  }
}

/**
 * Overwrite an existing simulation with current state
 */
export async function overwriteSimulation(
  simulationId: string,
  state: SimulationState,
  name?: string,
  description?: string
): Promise<SimulationServiceResult<CloudSimulationRecord>> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: 'User is not authenticated' };
  }

  const metrics = extractFacilityMetrics(state);

  try {
    const updatePayload: Record<string, any> = {
      facility_name: metrics.facilityName,
      room_count: metrics.roomCount,
      plant_count: metrics.plantCount,
      mushroom_count: metrics.mushroomCount,
      sim_time: metrics.simTime,
      data: state,
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updatePayload.name = name.trim();
    if (description !== undefined) updatePayload.description = description.trim();

    const { data, error } = await supabase
      .from('simulations')
      .update(updatePayload)
      .eq('id', simulationId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as CloudSimulationRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to update simulation' };
  }
}

/**
 * Delete a simulation from Supabase
 */
export async function deleteSimulation(simulationId: string): Promise<SimulationServiceResult<boolean>> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: 'User is not authenticated' };
  }

  try {
    const { error } = await supabase
      .from('simulations')
      .delete()
      .eq('id', simulationId)
      .eq('user_id', user.id);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: true, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to delete simulation' };
  }
}
