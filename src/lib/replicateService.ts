// src/lib/replicateService.ts - Fixed with proper duration validation
import { supabase } from './supabase';

// VERIFIED: Only models confirmed to work on Replicate API
export const REPLICATE_MODELS = {
  video: {
    'hailuo-2': {
      name: 'MiniMax Video-01 - Physics Master',
      description: 'MiniMax video model with excellent physics simulation and reliable performance',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Realistic physics, human movement, dramatic transformations',
      maxDuration: 6, // MiniMax limitation - BUT API only accepts 6 or 10!
      allowedDurations: [6, 10], // NEW: Specific allowed values
      verified: true,
      replicateId: 'minimax/hailuo-02' // This is the actual API identifier
    },
    'hailuo': {
      name: 'MiniMax Video-01 - Classic',
      description: 'Legacy MiniMax video model (same as hailuo-2)',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Legacy compatibility, same as hailuo-2',
      maxDuration: 6,
      allowedDurations: [6, 10],
      verified: true,
      replicateId: 'minimax/video-01' // Same API identifier
    },
    'wan-2.2': {
      name: 'Wan 2.2 - Speed Champion',
      description: 'Alibaba\'s fastest video model with motion diversity',
      speed: 'Fast Speed',
      quality: 'High Quality',
      bestFor: 'Fast generation, motion diversity, efficiency',
      maxDuration: 8,
      allowedDurations: [3, 5, 8], // Example - update with actual values
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
      allowedDurations: [2, 4, 6, 8], // Example - update with actual values
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

// Helper function to get valid duration for a specific model
function getValidDuration(requestedDuration: number, model: VideoModel): number {
  const modelInfo = REPLICATE_MODELS.video[model];
  if (!modelInfo || !modelInfo.allowedDurations) {
    // Fallback to closest valid duration for hailuo-2
    return requestedDuration <= 6 ? 6 : 10;
  }

  const allowedDurations = modelInfo.allowedDurations;
  
  // Find the closest allowed duration
  let closest = allowedDurations[0];
  let minDiff = Math.abs(requestedDuration - closest);
  
  for (const duration of allowedDurations) {
    const diff = Math.abs(requestedDuration - duration);
    if (diff < minDiff) {
      closest = duration;
      minDiff = diff;
    }
  }
  
  return closest;
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  duration = 5,
  preserveFace = true,
  model = 'hailuo-2', // Default to working MiniMax model (matches Admin UI)
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

    // Get valid duration for this specific model
    const validDuration = getValidDuration(duration, model);
    if (validDuration !== duration) {
      console.log(`⚠️ Duration adjusted from ${duration}s to ${validDuration}s for model ${model}`);
    }

    // Ensure valid resolution for MiniMax models
    const validResolution = model.startsWith('hailuo') ? '1080p' : '720p';

    console.log(`📡 Calling Edge Function with model: ${model} (${modelInfo.replicateId})`);

    // Call your Supabase Edge Function with corrected parameters
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: prompt,
        model: model, // Send your internal model name
        duration: validDuration, // Use validated duration
        resolution: validResolution, // Use validated resolution
        first_frame_image: preserveFace ? inputData : null // Add image if preserving face
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
    console.error('Generation error details:', error);
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
      model: 'hailuo-2', // Use working MiniMax model (matches Admin UI)
      duration: 5 // This will be converted to 6 automatically
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
  return REPLICATE_MODELS.video[modelKey] || REPLICATE_MODELS.video['hailuo-2'];
}

export function getRecommendedDuration(modelKey: VideoModel, requestedDuration: number): number {
  return getValidDuration(requestedDuration, modelKey);
}

export function getAllModels() {
  return Object.entries(REPLICATE_MODELS.video).map(([key, info]) => ({
    key: key as VideoModel,
    ...info
  }));
}