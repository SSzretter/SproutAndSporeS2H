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

export function subscribeToAuthState(callback: (user: User | null, session: Session | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null, session ?? null);
  });
  return () => subscription.unsubscribe();
}

/**
 * Formats auth errors with actionable explanations for common issues like
 * "Unregistered API key" (Supabase Kong rejection) and invalid credentials.
 */
export function formatAuthError(err: any): string {
  if (!err) return 'An unexpected authentication error occurred.';
  const msg = typeof err === 'string' ? err : (err.message || err.error_description || String(err));
  
  if (msg.toLowerCase().includes('unregistered api key') || msg.toLowerCase().includes('not registered for this project')) {
    return 'Supabase rejected the API key with "Unregistered API key". This means the key in your secrets does not match your active Supabase project. In Supabase Dashboard (Settings > API), copy the standard "anon" "public" JWT key (starts with "eyJ...") or ensure the key belongs to the active project.';
  }
  
  if (msg.toLowerCase().includes('invalid login credentials')) {
    return 'Account not found or password incorrect. If you haven\'t created an account with a password yet, switch to "Create Cloud Account" or use Continue with Google.';
  }
  
  return msg;
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
  const envUrl = 
    (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_APP_URL || import.meta.env.APP_URL)) ||
    '';
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.endsWith('/') ? envUrl : `${envUrl}/`;
  }
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
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string): Promise<{ error: AuthError | null }> {
  const redirectUrl = getAuthRedirectUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl
  });
  return { error };
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

    // Check if raw JWT access_token was pasted directly (e.g. eyJhbGciOi...)
    if (raw.startsWith('ey') && raw.split('.').length >= 3) {
      try {
        const { data, error } = await supabase.auth.setSession({
          access_token: raw,
          refresh_token: '',
        });
        if (!error && data.user) return { user: data.user, error: null };
      } catch {
        // Fall through
      }
    }

    // Check if JSON session object was pasted directly
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        const accessToken = parsed.access_token || parsed.currentSession?.access_token || parsed.session?.access_token;
        const refreshToken = parsed.refresh_token || parsed.currentSession?.refresh_token || parsed.session?.refresh_token || '';
        if (accessToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) return { user: null, error };
          return { user: data.user, error: null };
        }
      } catch {
        // Fall through to other checks
      }
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

    // Handle hash or query containing access_token (Implicit Magic Link / OAuth)
    let hashPart = raw;
    if (hashPart.includes('#')) {
      hashPart = hashPart.split('#')[1];
    } else if (hashPart.includes('?')) {
      hashPart = hashPart.split('?')[1];
    }

    const params = new URLSearchParams(hashPart);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token') || '';

    if (!accessToken) {
      return { 
        user: null, 
        error: new Error('Could not find access_token in the provided input. Make sure to paste the full URL or session key.') 
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
 * Sign in with Google OAuth (handles both standalone windows and AI Studio iframe preview)
 */
export async function signInWithGoogle(preOpenedPopup?: Window | null): Promise<{ error: Error | null; url?: string }> {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const configuredAppUrl = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_APP_URL || import.meta.env.APP_URL)) || 'https://sszretter.github.io/SproutAndSporeS2H/';
  const redirectUrl = isIframe && typeof window !== 'undefined' && window.location.hostname.includes('run.app')
    ? configuredAppUrl
    : getAuthRedirectUrl();

  if (isIframe) {
    // In iframe (AI Studio preview): Google blocks OAuth in iframes with 403 / X-Frame-Options.
    // Use skipBrowserRedirect to obtain the provider authorization URL and launch a popup.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      if (preOpenedPopup && !preOpenedPopup.closed) preOpenedPopup.close();
      return { error };
    }

    if (data?.url) {
      if (preOpenedPopup && !preOpenedPopup.closed) {
        preOpenedPopup.location.href = data.url;
        return { error: null, url: data.url };
      }

      const width = 560;
      const height = 680;
      const left = window.screen.availWidth ? Math.max(0, (window.screen.availWidth - width) / 2) : 100;
      const top = window.screen.availHeight ? Math.max(0, (window.screen.availHeight - height) / 2) : 100;
      const popup = window.open(
        data.url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      );

      if (!popup || popup.closed) {
        return { 
          error: new Error('Popup was blocked by your browser. Please allow popups or use Email & Password below.'),
          url: data.url
        };
      }
      return { error: null, url: data.url };
    }
  }

  // Standalone top-level browser tab (e.g. GitHub Pages)
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
 * True when the setup SQL hasn't been (fully) run. Postgres reports a missing table as
 * 42P01, PostgREST as PGRST205 ("...in the schema cache"); a table without the
 * `authenticated` grant fails with 42501 ("permission denied for table simulations").
 */
function isMissingTableError(error: { code?: string; message: string }): boolean {
  const msg = error.message.toLowerCase();
  return error.code === '42P01' || error.code === 'PGRST205' || error.code === '42501' ||
    msg.includes('schema cache') || msg.includes('relation') || msg.includes('does not exist') ||
    msg.includes('permission denied for table');
}

// ================= CLOUD AUTO-SAVE =================

const activeSaveKey = (userId: string) => `sprout_active_cloud_save_${userId}`;

/** The cloud save this browser auto-saves into (last loaded, saved or overwritten). */
export function getActiveCloudSaveId(userId: string): string | null {
  try {
    return localStorage.getItem(activeSaveKey(userId));
  } catch {
    return null;
  }
}

export function setActiveCloudSaveId(userId: string, simulationId: string | null): void {
  try {
    if (simulationId) localStorage.setItem(activeSaveKey(userId), simulationId);
    else localStorage.removeItem(activeSaveKey(userId));
  } catch {
    // Storage unavailable; auto-save will fall back to creating an "Autosave" record
  }
}

/**
 * The user's most recently updated cloud save, with its full state (null data when they have none).
 */
export async function getLatestUserSimulation(): Promise<SimulationServiceResult<CloudSimulationRecord>> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: 'User is not authenticated' };
  }

  try {
    const { data, error } = await supabase
      .from('simulations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message, isTableMissing: isMissingTableError(error) };
    }

    return { data: (data as CloudSimulationRecord) || null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to fetch latest simulation' };
  }
}

/**
 * Write the current state to the active cloud save, or create an "Autosave"
 * record (and make it active) when there is none or it was deleted.
 */
export async function autoSaveSimulation(state: SimulationState): Promise<SimulationServiceResult<CloudSimulationRecord>> {
  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: 'User is not authenticated' };
  }

  const activeId = getActiveCloudSaveId(user.id);
  if (activeId) {
    const result = await overwriteSimulation(activeId, state);
    if (!result.error || result.isTableMissing) return result;
    // Active save no longer exists (deleted elsewhere); start a fresh one below
    setActiveCloudSaveId(user.id, null);
  }

  const created = await saveNewSimulation('Autosave', 'Automatic cloud backup', state);
  if (created.data) setActiveCloudSaveId(user.id, created.data.id);
  return created;
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
      const isMissing = isMissingTableError(error);
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
      const isMissing = isMissingTableError(error);
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
      return { data: null, error: error.message, isTableMissing: isMissingTableError(error) };
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
