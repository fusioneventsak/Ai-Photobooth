// src/lib/replicateService.ts - Realistic version with only verified working models
import { supabase } from './supabase';

// VERIFIED: Only models confirmed to work on Replicate API
export const REPLICATE_MODELS = {
  video: {
    'hailuo-2': {
      name: 'Hailuo Video-01 - Best Physics',
      description: 'MiniMax video model with excellent physics simulation and reliable performance',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Realistic physics, human movement, dramatic transformations',
      maxDuration: 6,
      verified: true
    },
    'hunyuan-video': {
      name: 'HunyuanVideo - Cinematic Quality',
      description: 'Tencent\'s 13B parameter model with cinema-quality results',
      speed: 'Slow Speed',
      quality: 'Ultimate Quality',
      bestFor: 'Cinematic quality, professional projects, high detail',
      maxDuration: 6,
      verified: true
    },
    'wan-2.2': {
      name: 'Wan 2.1 - Speed & Quality',
      description: 'Alibaba\'s video model with fast generation and good quality',
      speed: 'Fast Speed',
      quality: 'High Quality',
      bestFor: 'Fast generation, motion diversity, efficiency',
      maxDuration: 5,
      verified: true
    },
    'cogvideo': {
      name: 'CogVideoX-5B - Open Source',
      description: 'Open-source option with solid quality and good prompt adherence',
      speed: 'Medium Speed',
      quality: 'High Quality',
      bestFor: 'Balanced quality, open-source, consistent results',
      maxDuration: 6,
      verified: true
    },
    'hailuo': {
      name: 'Hailuo Classic - Legacy',
      description: 'Original MiniMax model, reliable fallback option',
      speed: 'Medium Speed',
      quality: 'Standard Quality',
      bestFor: 'Legacy compatibility, basic transformations',
      maxDuration: 6,
      verified: true
    }
    // Note: Removed kling-2.1 and stable-video-diffusion due to API issues
    // These can be re-added once we verify they work properly
  }
} as const;

export type VideoModel = keyof typeof REPLICATE_MODELS.video;

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'video'; // Only video supported
  duration?: number;
  preserveFace?: boolean;
  model?: VideoModel;
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  duration = 5,
  preserveFace = true,
  model = 'hailuo-2' // Default to best working model
}: GenerationOptions): Promise<string> {
  try {
    console.log(`Calling Replicate Edge Function for ${type} generation with model: ${model}...`);
    
    if (type !== 'video') {
      throw new Error('Replicate service only supports video generation. Use Stability AI for images.');
    }
    
    // Ensure model exists in our supported list
    if (!REPLICATE_MODELS.video[model as VideoModel]) {
      console.warn(`Model ${model} not found, using default hailuo-2`);
      model = 'hailuo-2';
    }
    
    // Validate duration against model limits
    const modelConfig = REPLICATE_MODELS.video[model as VideoModel];
    const maxDuration = modelConfig.maxDuration;
    const clampedDuration = Math.min(duration, maxDuration);
    
    if (duration > maxDuration) {
      console.warn(`Duration ${duration}s exceeds ${model} limit of ${maxDuration}s, clamping to ${clampedDuration}s`);
    }
    
    console.log(`Using ${model} model with ${clampedDuration}s duration`);

    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt,
        inputData,
        type,
        duration: clampedDuration,
        preserveFace,
        model
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || `Failed to generate ${type}`);
    }

    if (!data?.success) {
      const errorMessage = data?.error || `Invalid response from ${type} generation service`;
      console.error('Generation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    if (!data?.result) {
      throw new Error(`No result returned from ${type} generation service`);
    }

    console.log(`Replicate ${type} generation successful with ${data.model || model}`);
    
    return data.result;

  } catch (error) {
    console.error('Replicate API Error:', error);
    
    if (error instanceof Error) {
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
      } else if (error.message.includes('Both primary and fallback models failed')) {
        // Extract more specific error from the message
        const specificError = error.message.split('Both primary and fallback models failed: ')[1];
        throw new Error(`Video generation failed: ${specificError || 'Multiple model attempts failed'}`);
      } else {
        throw error;
      }
    } else {
      throw new Error(`Failed to generate ${type} with Replicate API`);
    }
  }
}

export async function testReplicateConnection(): Promise<{ 
  success: boolean; 
  error?: string; 
  model?: string; 
}> {
  try {
    const testInput = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: 'test video generation',
        inputData: testInput,
        type: 'video',
        model: 'hailuo-2' // Use working model for testing
      }
    });

    if (error) {
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
      model: data?.model || 'hailuo-2'
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    };
  }
}

// Helper function to get model info
export function getModelInfo(modelKey: VideoModel) {
  return REPLICATE_MODELS.video[modelKey] || REPLICATE_MODELS.video['hailuo-2'];
}

// Helper function to get recommended duration for a model
export function getRecommendedDuration(modelKey: VideoModel, requestedDuration: number): number {
  const modelInfo = getModelInfo(modelKey);
  return Math.min(requestedDuration, modelInfo.maxDuration);
}

// Helper function to get all available models
export function getAllModels() {
  return Object.entries(REPLICATE_MODELS.video).map(([key, info]) => ({
    key: key as VideoModel,
    ...info
  }));
}

// Helper function to get models by performance
export function getModelsByPerformance() {
  const models = getAllModels();
  
  return {
    fastest: models.filter(m => m.speed.includes('Fast')),
    balanced: models.filter(m => m.speed.includes('Medium')),
    highest_quality: models.filter(m => m.quality.includes('Ultimate') || m.quality.includes('Premium')),
    recommended: models.filter(m => ['hailuo-2', 'wan-2.2', 'hunyuan-video'].includes(m.key))
  };
}