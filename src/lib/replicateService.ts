import { supabase } from './supabase';

// Model constants for admin use only
export const REPLICATE_MODELS = {
  VIDEO: {
    WAN_VIDEO: 'wan-video/wan-2.2-i2v-fast',
    HAILUO: 'minimax/hailuo-02-fast',
  },
  IMAGE: {
    FLUX: 'black-forest-labs/flux-schnell',
  }
} as const;

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'image' | 'video';
  duration?: number;
  preserveFace?: boolean;
  // Model selection removed from here - will come from config
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  duration = 5,
  preserveFace = true
}: GenerationOptions): Promise<string> {
  try {
    console.log(`🔄 Calling Replicate Edge Function for ${type} generation...`);

    // Model selection is now handled by the admin config
    // The Edge Function will use the config to determine the model
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt,
        inputData,
        type,
        duration,
        preserveFace
        // No model parameter - determined by admin config
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || `Failed to generate ${type}`);
    }

    if (!data?.success || !data?.result) {
      throw new Error(data?.error || `Invalid response from ${type} generation service`);
    }

    // Log additional metadata if available
    if (data.metadata) {
      console.log(`✅ Generation metadata:`, data.metadata);
    }
    
    console.log(`✅ Replicate ${type} generation successful with model: ${data.model || 'admin-configured'}`);
    return data.result;

  } catch (error) {
    console.error('Replicate API Error:', error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to generate ${type} with Replicate API`);
    }
  }
}

// Helper functions for admin panel use only
export function getAvailableVideoModels() {
  return [
    { id: 'wan-video', name: 'WAN Video 2.2 (Fast)', description: 'High-quality video generation', version: REPLICATE_MODELS.VIDEO.WAN_VIDEO },
    { id: 'hailuo', name: 'Hailuo 02 (Fast)', description: 'Alternative video generation model', version: REPLICATE_MODELS.VIDEO.HAILUO }
  ];
}

export function getAvailableImageModels() {
  return [
    { id: 'flux', name: 'FLUX Schnell', description: 'Fast image generation', version: REPLICATE_MODELS.IMAGE.FLUX }
  ];
}

// Get model info by ID (for admin use)
export function getModelInfo(modelId: string, type: 'image' | 'video') {
  if (type === 'video') {
    return getAvailableVideoModels().find(model => model.id === modelId);
  } else {
    return getAvailableImageModels().find(model => model.id === modelId);
  }
}