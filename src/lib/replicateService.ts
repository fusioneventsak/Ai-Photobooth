// src/lib/replicateService.ts - Updated to pass model parameter
import { supabase } from './supabase';

// Enhanced model configurations
export const REPLICATE_MODELS = {
  video: {
    'hailuo-2': {
      name: 'Hailuo-02 - Physics Master',
      description: 'Latest MiniMax model with excellent physics simulation and 1080p output',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Realistic physics, human movement, dramatic transformations'
    },
    'wan-2.2': {
      name: 'Wan 2.2 - Speed Champion',
      description: 'Alibaba\'s fastest video model with motion diversity',
      speed: 'Fast Speed',
      quality: 'High Quality',
      bestFor: 'Fast generation, motion diversity, efficiency'
    },
    'hunyuan-video': {
      name: 'HunyuanVideo - Cinematic Pro',
      description: 'Tencent\'s 13B parameter model with cinema-quality results',
      speed: 'Slow Speed',
      quality: 'Ultimate Quality',
      bestFor: 'Cinematic quality, fine-tuning, professional projects'
    },
    'kling-2.1': {
      name: 'Kling 2.1 - Motion Master',
      description: 'Enhanced motion model with complex action support',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Complex actions, dynamic motion, realistic movement'
    },
    'cogvideo': {
      name: 'CogVideoX - Quality Balance',
      description: 'Open-source option with solid quality and good prompt adherence',
      speed: 'Medium Speed',
      quality: 'High Quality',
      bestFor: 'Balanced quality, open-source, consistent results'
    },
    'hailuo': {
      name: 'Hailuo-01 - Classic',
      description: 'Original dramatic transformation model',
      speed: 'Medium Speed',
      quality: 'Standard Quality',
      bestFor: 'Legacy compatibility, basic transformations'
    },
    'stable-video-diffusion': {
      name: 'Stable Video Diffusion',
      description: 'High-quality image-to-video generation from Stability AI',
      speed: 'Fast Speed',
      quality: 'Standard Quality',
      bestFor: 'Simple animation, basic motion, speed priority'
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
  model?: VideoModel; // Added model parameter
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  duration = 5,
  preserveFace = true,
  model = 'hailuo-2' // Default to best 2025 model
}: GenerationOptions): Promise<string> {
  try {
    console.log(`🔄 Calling Replicate Edge Function for ${type} generation with model: ${model}...`);
    
    // Validate that only video is requested
    if (type !== 'video') {
      throw new Error('Replicate service only supports video generation. Use Stability AI for images.');
    }
    
    console.log(`📊 Using ${model} model`);

    // Call Supabase Edge Function with model parameter
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt,
        inputData,
        type,
        duration,
        preserveFace,
        model // Pass the selected model
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

    // Log success with model info
    console.log(`✅ Replicate ${type} generation successful with ${data.model || model}`);
    
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
      } else if (error.message.includes('API configuration error')) {
        throw new Error('Replicate API key not configured in Supabase. Please add REPLICATE_API_KEY to your Edge Functions environment variables.');
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
    // Test with a minimal request
    const testInput = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: 'test',
        inputData: testInput,
        type: 'video',
        model: 'stable-video-diffusion' // Use the most reliable model for testing
      }
    });

    if (error) {
      // If it's just a test data error but the function responded, that's still a connection success
      if (error.message?.includes('API configuration error')) {
        return {
          success: false,
          error: 'Replicate API key not configured in Supabase Edge Functions'
        };
      }
      
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      model: data?.model || 'stable-video-diffusion'
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    };
  }
}