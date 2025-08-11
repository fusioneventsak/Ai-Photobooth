import { create } from 'zustand';
import type { Config } from '../types/supabase';
import { getConfig, updateConfig } from '../lib/supabase';

interface ConfigState {
  config: Config | null;
  loading: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
  updateConfig: (updates: Partial<Config>) => Promise<Config | null>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loading: false,
  error: null,
  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await getConfig();
      set({ config, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch config';
      set({ error: message, loading: false });
    }
  },
  updateConfig: async (updates) => {
    set({ loading: true, error: null });
    try {
      const updatedConfig = await updateConfig(updates);
      if (!updatedConfig) {
        throw new Error('Failed to update configuration');
      }
      set({ config: updatedConfig, loading: false });
      return updatedConfig;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update config';
      set({ error: message, loading: false });
      throw error;
    }
  }
}));