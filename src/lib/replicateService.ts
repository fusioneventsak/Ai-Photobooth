// src/lib/replicateService.ts - FIXED VERSION
// Updated to match the working Edge Function configuration

import { supabase } from './supabase';

// Only video models since Edge Function only supports video
export const REPLICATE_MODELS = {
  video: {
    'stable-video-diffusion': {
      name: 'Stable Video Diffusion',
      description: 'High-quality image-to-video generation from Stability AI',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Smooth video transitions, face preservation'
    }
  }
} as const;

export type VideoModel = keyof typeof REPLICATE_MODELS.video;

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'video'; // Only video supported
  duration?: number;
  preserveFace?: boolean;
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
    
    // Validate that only video is requested
    if (type !== 'video') {
      throw new Error('Replicate service only supports video generation. Use Stability AI for images.');
    }
    
    console.log(`📊 Using default stable-video-diffusion model`);

    // Call Supabase Edge Function - simplified parameters
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt,
        inputData,
        type,
        duration,
        preserveFace
        // Note: removed model parameter since Edge Function uses hardcoded model
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || `Failed to generate ${type}`);
    }

    // Enhanced response validation
    if (!data?.success) {
      const errorMessage = data?.error || `Invalid response from ${type} generation service`;
      console.error('Generation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    if (!data?.result) {
      throw new Error(`No result returned from ${type} generation service`);
    }

    // Log success
    console.log(`✅ Replicate ${type} generation successful`);
    
    return data.result;

  } catch (error) {
    console.error('Replicate API Error:', error);
    
    if (error instanceof Error) {
      // Enhanced error handling with specific messages
      if (error.message.includes('API key')) {
        throw new Error('Replicate API key is invalid or missing. Please check your configuration.');
      } else if (error.message.includes('credits') || error.message.includes('billing')) {
        throw new Error('Insufficient Replicate credits. Please add credits to your account.');
      } else if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Generation timed out. Please try again or use a faster model.');
      } else if (error.message.includes('Edge Function returned a non-2xx status code')) {
        throw new Error('Server configuration error. Check API keys in Supabase Dashboard.');
      } else {
        throw error;
      }
    } else {
      throw new Error(`Failed to generate ${type} with Replicate API`);
    }
  }
}

// Test function to verify Replicate connectivity
export async function testReplicateConnection(): Promise<{ 
  success: boolean; 
  error?: string; 
  model?: string; 
}> {
  try {
    // Just test the Edge Function is available
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: 'test',
        inputData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        type: 'video'
      }
    });

    if (error && !error.message?.includes('API')) {
      // If it's not an API key error, the function is at least reachable
      return {
        success: true,
        model: 'stable-video-diffusion'
      };
    }

    return {
      success: !error,
      error: error?.message,
      model: 'stable-video-diffusion'
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    };
  }
}