import { supabase } from './supabase';

// Type definitions for model selection
export type ImageModel = 'flux-schnell' | 'flux-dev' | 'sdxl' | 'realvisxl';
export type VideoModel = 'stable-video-diffusion' | 'animatediff' | 'zeroscope' | 'wan-video' | 'hailuo-02';

// Model definitions with complete information for Admin panel
export const REPLICATE_MODELS = {
  // Image models - keyed by model ID for easy Admin access
  image: {
    'flux-schnell': {
      name: 'FLUX Schnell',
      description: 'Fast image generation with good quality',
      speed: 'fast',
      quality: 'good',
      bestFor: 'Quick previews and testing',
      modelPath: 'black-forest-labs/flux-schnell'
    },
    'flux-dev': {
      name: 'FLUX Dev',
      description: 'High-quality image generation (slower)',
      speed: 'slow',
      quality: 'excellent',
      bestFor: 'High-quality final images',
      modelPath: 'black-forest-labs/flux-dev'
    },
    'sdxl': {
      name: 'Stable Diffusion XL',
      description: 'Stable Diffusion XL model for detailed images',
      speed: 'medium',
      quality: 'very good',
      bestFor: 'Detailed, artistic images',
      modelPath: 'stability-ai/sdxl'
    },
    'realvisxl': {
      name: 'RealVis XL',
      description: 'Photorealistic image generation',
      speed: 'medium',
      quality: 'excellent',
      bestFor: 'Photorealistic portraits and scenes',
      modelPath: 'lucataco/realvisxl-v3'
    }
  },
  
  // Video models - keyed by model ID for easy Admin access
  video: {
    'hailuo-02': {
      name: 'Hailuo 02',
      description: 'High-quality cinematic video generation',
      speed: 'slow',
      quality: 'excellent',
      bestFor: 'Cinematic quality videos',
      modelPath: 'minimax/hailuo-02'
    },
    'stable-video-diffusion': {
      name: 'Stable Video Diffusion',
      description: 'Stable video generation from images',
      speed: 'medium',
      quality: 'very good',
      bestFor: 'Image-to-video conversion',
      modelPath: 'stability-ai/stable-video-diffusion'
    },
    'animatediff': {
      name: 'AnimateDiff',
      description: 'Animation-focused video generation',
      speed: 'fast',
      quality: 'good',
      bestFor: 'Animated sequences',
      modelPath: 'lucataco/animatediff'
    },
    'zeroscope': {
      name: 'ZeroScope',
      description: 'Fast video generation',
      speed: 'fast',
      quality: 'good',
      bestFor: 'Quick video previews',
      modelPath: 'cerspense/zeroscope_v2_xl'
    },
    'wan-video': {
      name: 'WAN Video 2.2',
      description: 'Fast video generation',
      speed: 'fast',
      quality: 'good',
      bestFor: 'Quick video generation',
      modelPath: 'wan-video/wan-2.2-i2v-fast'
    }
  }
} as const;

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'image' | 'video';
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
    console.log('📦 Request payload:', { 
      prompt: prompt.substring(0, 50) + '...', 
      type, 
      duration, 
      preserveFace,
      inputDataLength: inputData.length 
    });

    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt,
        inputData,
        type,
        duration,
        preserveFace
      }
    });

    // Enhanced error logging
    if (error) {
      console.error('❌ Edge function error:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw new Error(`Edge Function Error: ${error.message || `Failed to generate ${type}`}`);
    }

    // Check for response structure
    console.log('📥 Edge function response:', {
      success: data?.success,
      hasResult: !!data?.result,
      hasError: !!data?.error,
      model: data?.model
    });

    if (!data?.success) {
      const errorMessage = data?.error || `Invalid response from ${type} generation service`;
      console.error('❌ Generation failed:', errorMessage);
      throw new Error(errorMessage);
    }

    if (!data?.result) {
      console.error('❌ No result in response:', data);
      throw new Error(`No result received from ${type} generation service`);
    }

    // Log additional metadata if available
    if (data.metadata) {
      console.log(`✅ Generation metadata:`, data.metadata);
    }
    
    console.log(`✅ Replicate ${type} generation successful with model: ${data.model || 'admin-configured'}`);
    console.log(`📄 Result URL: ${data.result.substring(0, 50)}...`);
    
    return data.result;

  } catch (error) {
    console.error('❌ Replicate API Error:', error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to generate ${type} with Replicate API: ${JSON.stringify(error)}`);
    }
  }
}

// Test Replicate connection function
export async function testReplicateConnection(): Promise<{ success: boolean; error?: string; model?: string }> {
  try {
    console.log('🔄 Testing Replicate connection...');

    // Test the connection by calling the edge function with test flag
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: 'test connection',
        inputData: testImageData,
        type: 'image',
        test: true // Add a test flag to indicate this is a connection test
      }
    });

    if (error) {
      console.error('❌ Replicate connection test failed:', error);
      return {
        success: false,
        error: error.message || 'Connection test failed'
      };
    }

    if (data?.success === false) {
      console.error('❌ API key validation failed:', data.error);
      return {
        success: false,
        error: data.error || 'API key validation failed'
      };
    }

    console.log('✅ Replicate connection test successful');
    return {
      success: true,
      model: data?.model || 'Replicate API'
    };

  } catch (error) {
    console.error('❌ Replicate connection test error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown connection error'
    };
  }
}

// Helper functions for admin panel use only
export function getAvailableVideoModels() {
  return Object.entries(REPLICATE_MODELS.video).map(([id, model]) => ({
    id,
    name: model.name,
    description: model.description,
    speed: model.speed,
    quality: model.quality,
    bestFor: model.bestFor,
    modelPath: model.modelPath
  }));
}

export function getAvailableImageModels() {
  return Object.entries(REPLICATE_MODELS.image).map(([id, model]) => ({
    id,
    name: model.name,
    description: model.description,
    speed: model.speed,
    quality: model.quality,
    bestFor: model.bestFor,
    modelPath: model.modelPath
  }));
}

// Get model info by ID (for admin use)
export function getModelInfo(modelId: string, type: 'image' | 'video') {
  if (type === 'video') {
    return REPLICATE_MODELS.video[modelId as keyof typeof REPLICATE_MODELS.video];
  } else {
    return REPLICATE_MODELS.image[modelId as keyof typeof REPLICATE_MODELS.image];
  }
}