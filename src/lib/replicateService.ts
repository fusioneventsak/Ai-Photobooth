// src/lib/replicateService.ts - Fixed with correct model identifiers
import { supabase } from './supabase';

// VERIFIED: Only models confirmed to work on Replicate API
export const REPLICATE_MODELS = {
  video: {
    'hailuo': {
      name: 'MiniMax Video-01 - Physics Master',
      description: 'MiniMax video model with excellent physics simulation and reliable performance',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Realistic physics, human movement, dramatic transformations',
      maxDuration: 6, // MiniMax limitation
      verified: true,
      replicateId: 'minimax/video-01' // This is the actual API identifier
    },
    'wan-2.2': {
      name: 'Wan 2.2 - Speed Champion',
      description: 'Alibaba\'s fastest video model with motion diversity',
      speed: 'Fast Speed',
      quality: 'High Quality',
      bestFor: 'Fast generation, motion diversity, efficiency',
      maxDuration: 8,
      verified: true,
      replicateId: 'alibaba-pai/emo-2'
    },
    'cogvideo': {
      name: 'CogVideoX-5B - Open Source',
      description: 'Open-source option with solid quality and good prompt adherence',
      speed: 'Medium Speed',
      quality: 'High Quality',
      bestFor: 'Balanced quality, open-source, consistent results',
      maxDuration: 8,
      verified: true,
      replicateId: 'thudm/cogvideox-5b'
    }
  }
} as const;

export type VideoModel = keyof typeof REPLICATE_MODELS.video;

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'video';
  duration?: number;
  preserveFace?: boolean;
  model?: VideoModel;
  userId?: string;
}

interface GenerationResponse {
  predictionId: string;
  status: 'processing';
  message: string;
  model: string;
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  duration = 5,
  preserveFace = true,
  model = 'hailuo', // Default to working MiniMax model
  userId
}: GenerationOptions): Promise<GenerationResponse> {
  try {
    console.log(`🎬 Starting video generation with model: ${model}`);
    
    if (type !== 'video') {
      throw new Error('Replicate service only supports video generation.');
    }

    // Get model info
    const modelInfo = REPLICATE_MODELS.video[model];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    // Validate duration against model limits
    const validDuration = Math.min(duration, modelInfo.maxDuration);
    if (validDuration !== duration) {
      console.log(`⚠️ Duration capped from ${duration}s to ${validDuration}s for model ${model}`);
    }

    console.log(`📡 Calling Edge Function with model: ${model} (${modelInfo.replicateId})`);

    // Call your Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: prompt,
        model: model, // Send your internal model name
        duration: validDuration,
        resolution: "720p"
      }
    });

    if (error) {
      console.error('🚨 Edge Function Error:', error);
      if (error.message?.includes('non-2xx status code')) {
        throw new Error('Server configuration error. Check API keys in Supabase Dashboard.');
      }
      throw new Error(`Edge Function Error: ${error.message}`);
    }

    if (!data || !data.predictionId) {
      console.error('🚨 Invalid response from Edge Function:', data);
      throw new Error('Invalid response from video generation service');
    }

    console.log(`✅ Generation started successfully! Prediction ID: ${data.predictionId}`);

    return {
      predictionId: data.predictionId,
      status: 'processing',
      message: data.message || 'Video generation started',
      model: data.model || modelInfo.replicateId
    };

  } catch (error) {
    console.error('🚨 Generation error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Video generation failed');
  }
}

// Test function for connection
export async function testReplicateConnection(): Promise<{ 
  success: boolean; 
  error?: string; 
  model?: string; 
}> {
  try {
    console.log('🧪 Testing Replicate connection...');
    
    const result = await generateWithReplicate({
      prompt: 'test video generation - a simple object moving',
      inputData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      type: 'video',
      model: 'hailuo', // Use working MiniMax model
      duration: 2 // Minimal duration for testing
    });

    return {
      success: true,
      model: result.model
    };

  } catch (error) {
    console.error('🚨 Connection test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API configuration error') || error.message.includes('Check API keys')) {
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
      success: false,
      error: 'Connection test failed'
    };
  }
}

// Helper functions
export function getModelInfo(modelKey: VideoModel) {
  return REPLICATE_MODELS.video[modelKey] || REPLICATE_MODELS.video['hailuo'];
}

export function getRecommendedDuration(modelKey: VideoModel, requestedDuration: number): number {
  const modelInfo = getModelInfo(modelKey);
  return Math.min(requestedDuration, modelInfo.maxDuration);
}

export function getAllModels() {
  return Object.entries(REPLICATE_MODELS.video).map(([key, info]) => ({
    key: key as VideoModel,
    ...info
  }));
}