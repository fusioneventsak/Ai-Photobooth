// src/lib/replicateService.ts - Updated with async webhook support
import { supabase } from './supabase';

// VERIFIED: Only models confirmed to work on Replicate API
export const REPLICATE_MODELS = {
  video: {
    'hailuo-2': {
      name: 'Hailuo-02 - Physics Master',
      description: 'Latest MiniMax model with excellent physics simulation and 1080p output',
      speed: 'Medium Speed',
      quality: 'Premium Quality',
      bestFor: 'Realistic physics, human movement, dramatic transformations',
      maxDuration: 10,
      verified: true
    },
    'hailuo': {
      name: 'Hailuo Video-01 - Classic',
      description: 'Original MiniMax model, reliable and well-tested',
      speed: 'Medium Speed',
      quality: 'High Quality',
      bestFor: 'Reliable results, proven performance',
      maxDuration: 6,
      verified: true
    },
    'hailuo-live': {
      name: 'Hailuo Live - Fast Track',
      description: 'Faster version of Hailuo for quick results',
      speed: 'Fast Speed',
      quality: 'High Quality',
      bestFor: 'Quick turnaround, fast previews',
      maxDuration: 6,
      verified: true
    },
    'wan-2.2': {
      name: 'Wan 2.2 - Speed Champion',
      description: 'Alibaba\'s fastest video model with motion diversity',
      speed: 'Fast Speed',
      quality: 'High Quality',
      bestFor: 'Fast generation, motion diversity, efficiency',
      maxDuration: 8,
      verified: true
    }
    // Removed problematic models: hunyuan-video, cogvideo, kling-2.1
    // These can be re-added once API compatibility is confirmed
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
  userId?: string; // For tracking generations
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
  model = 'hailuo-2', // Default to best working model
  userId
}: GenerationOptions): Promise<GenerationResponse> {
  try {
    console.log(`Starting async generation with model: ${model}...`);
    
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
        model,
        userId // Pass user ID for tracking
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

    if (!data?.predictionId) {
      throw new Error(`No prediction ID returned from ${type} generation service`);
    }

    console.log(`Replicate ${type} generation started with prediction ID: ${data.predictionId}`);
    
    // Return prediction info instead of waiting for result
    return {
      predictionId: data.predictionId,
      status: 'processing',
      message: data.message || 'Generation started. You will be notified when complete.',
      model: data.model || modelConfig.name
    };

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
      } else if (error.message.includes('connection reset')) {
        throw new Error('Connection issue with Replicate API. Please try again.');
      } else {
        throw error;
      }
    } else {
      throw new Error(`Failed to generate ${type} with Replicate API`);
    }
  }
}

// Get generation status from database
export async function getGenerationStatus(predictionId: string) {
  try {
    const { data, error } = await supabase
      .from('photo_generations')
      .select('*')
      .eq('prediction_id', predictionId)
      .single();

    if (error) {
      console.error('Failed to get generation status:', error);
      return { status: 'unknown', error: error.message };
    }

    return {
      status: data.status,
      prompt: data.prompt,
      model: data.model,
      createdAt: data.created_at,
      completedAt: data.completed_at,
      galleryPhotoId: data.gallery_photo_id,
      errorMessage: data.error_message
    };

  } catch (error) {
    console.error('Generation status check failed:', error);
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Get user's generation history
export async function getUserGenerations(userId: string, limit: number = 10) {
  try {
    const { data, error } = await supabase
      .from('photo_generations')
      .select('*, photos(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to get user generations:', error);
      return [];
    }

    return data;

  } catch (error) {
    console.error('User generations fetch failed:', error);
    return [];
  }
}

// Subscribe to generation updates for real-time status
export function subscribeToGenerationUpdates(userId: string, callback: (update: any) => void) {
  const subscription = supabase
    .channel('generation_updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'photo_generations',
      filter: `user_id=eq.${userId}`
    }, callback)
    .subscribe();

  return subscription;
}

// Subscribe to notifications for completed generations
export function subscribeToNotifications(userId: string, callback: (notification: any) => void) {
  const subscription = supabase
    .channel('user_notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, callback)
    .subscribe();

  return subscription;
}

// Mark notification as read
export async function markNotificationRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Failed to mark notification as read:', error);
    }
  } catch (error) {
    console.error('Notification update failed:', error);
  }
}

// Get unread notifications count
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Failed to get notifications count:', error);
      return 0;
    }

    return count || 0;

  } catch (error) {
    console.error('Notifications count check failed:', error);
    return 0;
  }
}

export async function testReplicateConnection(): Promise<{ 
  success: boolean; 
  error?: string; 
  model?: string; 
}> {
  try {
    // Use a minimal 1px test image
    const testInput = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const result = await generateWithReplicate({
      prompt: 'test video generation',
      inputData: testInput,
      type: 'video',
      model: 'hailuo-2', // Use working model for testing
      duration: 2 // Minimal duration for testing
    });

    return {
      success: true,
      model: result.model
    };

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('API configuration error')) {
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
    highest_quality: models.filter(m => m.quality.includes('Premium')),
    recommended: models.filter(m => ['hailuo-2', 'wan-2.2', 'hailuo-live'].includes(m.key))
  };
}