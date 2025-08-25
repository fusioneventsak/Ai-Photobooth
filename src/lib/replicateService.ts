// src/lib/replicateService.ts - Updated client to send Kling parameters
import { supabase } from './supabase';

// VERIFIED: Models confirmed to work on Replicate API + Kling v1.6 Pro
export const REPLICATE_MODELS = {
  video: {
    'hailuo-2': {
      name: 'MiniMax Video-01 - Physics Master',
      description: 'MiniMax video model with excellent physics simulation and reliable performance',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Realistic physics, human movement, dramatic transformations',
      maxDuration: 6,
      allowedDurations: [6, 10],
      verified: true,
      replicateId: 'minimax/hailuo-02'
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
      replicateId: 'minimax/video-01'
    },
    'kling-v1.6-pro': {
      name: 'Kling v1.6 Pro - Crystal Quality',
      description: 'Kwaivgi\'s latest Kling model with enhanced detail and artistic effects',
      speed: 'Slow Speed',
      quality: 'Ultra Premium',
      bestFor: 'Artistic effects, crystal reflections, geometric worlds, high detail',
      maxDuration: 10,
      allowedDurations: [5, 10],
      verified: true,
      replicateId: 'kwaivgi/kling-v1.6-pro',
      supportsCfgScale: true,
      cfgScaleRange: [0.1, 2.0],
      supportsNegativePrompt: true,
      supportsAspectRatio: true,
      aspectRatios: ['16:9', '9:16', '1:1'],
      supportsStartImage: true
    },
    'wan-2.2': {
      name: 'Wan 2.2 - Speed Champion',
      description: 'Alibaba\'s fastest video model with motion diversity',
      speed: 'Fast Speed',
      quality: 'High Quality',
      bestFor: 'Fast generation, motion diversity, efficiency',
      maxDuration: 8,
      allowedDurations: [3, 5, 8],
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
      allowedDurations: [2, 4, 6, 8],
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
  // Kling-specific options
  cfgScale?: number;
  negativePrompt?: string;
  aspectRatio?: string;
}

interface GenerationResponse {
  predictionId: string;
  status: 'processing';
  message: string;
  model: string;
}

function getValidDuration(requestedDuration: number, model: VideoModel): number {
  const modelInfo = REPLICATE_MODELS.video[model];
  if (!modelInfo || !modelInfo.allowedDurations) {
    return requestedDuration <= 6 ? 6 : 10;
  }

  const allowedDurations = modelInfo.allowedDurations;
  
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
  model = 'hailuo-2',
  userId,
  cfgScale,
  negativePrompt,
  aspectRatio = '16:9'
}: GenerationOptions): Promise<GenerationResponse> {
  try {
    console.log(`🎬 Starting video generation with model: ${model}`);
    
    if (type !== 'video') {
      throw new Error('Replicate service only supports video generation.');
    }

    const modelInfo = REPLICATE_MODELS.video[model];
    if (!modelInfo) {
      throw new Error(`Unknown model: ${model}`);
    }

    const validDuration = getValidDuration(duration, model);
    if (validDuration !== duration) {
      console.log(`⚠️ Duration adjusted from ${duration}s to ${validDuration}s for model ${model}`);
    }

    console.log(`📡 Calling Edge Function with model: ${model} (${modelInfo.replicateId})`);

    // Prepare base parameters
    const baseParams = {
      model: model,
      prompt: prompt,
      duration: validDuration
    };

    // Add model-specific parameters
    let modelParams: any;

    if (model === 'kling-v1.6-pro') {
      // Kling-specific parameters
      modelParams = {
        ...baseParams,
        cfg_scale: cfgScale || 0.5,
        aspect_ratio: aspectRatio || '16:9',
        negative_prompt: negativePrompt || '',
        start_image: preserveFace ? inputData : null
      };
    } else {
      // MiniMax and other models
      const validResolution = model.startsWith('hailuo') ? '1080p' : '720p';
      modelParams = {
        ...baseParams,
        resolution: validResolution,
        first_frame_image: preserveFace ? inputData : null
      };
    }

    console.log('Model-specific params:', {
      ...modelParams,
      // Don't log the actual image data
      start_image: modelParams.start_image ? '[IMAGE_PROVIDED]' : null,
      first_frame_image: modelParams.first_frame_image ? '[IMAGE_PROVIDED]' : null
    });

    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: modelParams
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
      model: 'hailuo-2',
      duration: 5
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