import { SimulationState } from '../types/sim';

const CHANNEL_NAME = 'sprout_spore_cross_window_sync';

let channel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (err) {
    console.warn('BroadcastChannel not supported or failed to initialize:', err);
  }
}

export function broadcastSimulationState(state: SimulationState): void {
  if (channel) {
    try {
      channel.postMessage({
        type: 'SYNC_STATE',
        state,
        senderId: (window as any).__WINDOW_ID__ || 'main',
        timestamp: Date.now()
      });
    } catch (err) {
      // ignore
    }
  }
}

export function subscribeToSimulationSync(onStateReceived: (state: SimulationState) => void): () => void {
  if (!channel) {
    // Fallback: listen to localStorage 'storage' event across windows
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'sprout_spore_grow_sim_v2' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          onStateReceived(parsed);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', storageHandler);
    return () => window.removeEventListener('storage', storageHandler);
  }

  const handler = (e: MessageEvent) => {
    if (e.data && e.data.type === 'SYNC_STATE' && e.data.state) {
      onStateReceived(e.data.state);
    }
  };

  channel.addEventListener('message', handler);
  return () => {
    channel?.removeEventListener('message', handler);
  };
}
