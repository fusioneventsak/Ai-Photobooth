import { supabase } from './supabase';

// Available models for each type
export const REPLICATE_MODELS = {
  image: {
    'flux-schnell': {
      name: "FLUX Schnell",
      description: "Fast, high-quality image generation",
      speed: "⚡ Fast",
      quality: "🔥 High",
      bestFor: "Quick previews, face preservation"
    },
    'flux-dev': {
      name: "FLUX Dev", 
      description: "Higher quality, slower generation",
      speed: "🐌 Slow",
      quality: "✨ Premium",
      bestFor: "Maximum quality, artistic results"
    },
    'sdxl': {
      name: "Stable Diffusion XL",
      description: "Classic high-quality generation",
      speed: "🚀 Medium",
      quality: "🔥 High",
      bestFor: "Balanced quality and speed"
    },
    'realvisxl': {
      name: "RealVisXL v4.0",
      description: "Photorealistic image generation",
      speed: "🚀 Medium",
      quality: "📸 Photorealistic",
      bestFor: "Realistic portraits, photography"
    }
  },
  video: {
    'stable-video-diffusion': {
      name: "Stable Video Diffusion",
      description: "High-quality video from image",
      speed: "🐌 Slow",
      quality: "✨ Premium",
      bestFor: "Highest quality videos"
    },
    'animatediff': {
      name: "AnimateDiff",
      description: "Smooth animation generation",
      speed: "🚀 Medium", 
      quality: "🔥 High",
      bestFor: "Smooth animations, motion"
    },
    'zeroscope': {
      name: "Zeroscope v2 XL",
      description: "Text-to-video generation",
      speed: "🚀 Medium",
      quality: "🔥 High",
      bestFor: "Creative video effects"
    }
  }
} as const;

export type ImageModel = keyof typeof REPLICATE_MODELS.image;
export type VideoModel = keyof typeof REPLICATE_MODELS.video;
export type ModelType = ImageModel | VideoModel;

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'image' | 'video';
  model?: ModelType; // NEW: Optional model selection
  duration?: number;
  preserveFace?: boolean;
  faceMode?: 'preserve_face' | 'transform_face'; // NEW: Explicit face mode
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  model, // NEW: Model parameter
  duration = 5,
  preserveFace = true,
  faceMode = 'preserve_face' // NEW: Face mode parameter
}: GenerationOptions): Promise<string> {
  try {
    console.log(`🔄 Calling Replicate Edge Function for ${type} generation...`);
    
    // Log model selection
    if (model) {
      const modelInfo = getModelInfo(type, model);
      console.log(`📊 Selected model: ${modelInfo?.name || model}`);
    } else {
      console.log(`📊 Using default model for ${type}`);
    }

    // Call Supabase Edge Function with enhanced parameters
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt,
        inputData,
        type,
        model, // Pass the selected model
        duration,
        preserveFace,
        faceMode // Pass face mode for backward compatibility
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
    const modelName = data.model || data.modelKey || 'Unknown Model';
    console.log(`✅ Replicate ${type} generation successful with ${modelName}`);
    
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
      } else if (error.message.includes('Invalid model')) {
        throw new Error(`Selected model is not available. Please choose a different model.`);
      } else {
        throw error;
      }
    } else {
      throw new Error(`Failed to generate ${type} with Replicate API`);
    }
  }
}

// Helper function to get model info
export function getModelInfo(type: 'image' | 'video', modelKey: string) {
  const models = REPLICATE_MODELS[type] as any;
  return models[modelKey] || null;
}

// Helper function to get all available models for a type
export function getAvailableModels(type: 'image' | 'video') {
  return REPLICATE_MODELS[type];
}

// Helper function to get default model for each type
export function getDefaultModel(type: 'image' | 'video'): string {
  const models = REPLICATE_MODELS[type];
  return Object.keys(models)[0];
}

// Helper function to get recommended model based on use case
export function getRecommendedModel(
  type: 'image' | 'video', 
  priority: 'speed' | 'quality' | 'photorealistic' = 'quality'
): string {
  if (type === 'image') {
    switch (priority) {
      case 'speed':
        return 'flux-schnell';
      case 'photorealistic':
        return 'realvisxl';
      case 'quality':
      default:
        return 'flux-dev';
    }
  } else {
    switch (priority) {
      case 'speed':
        return 'animatediff';
      case 'quality':
      default:
        return 'stable-video-diffusion';
    }
  }
}

// Test function to verify Replicate connectivity
export async function testReplicateConnection(): Promise<{ 
  success: boolean; 
  error?: string; 
  model?: string 
}> {
  try {
    // Create a minimal test image (1x1 pixel)
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    console.log('🧪 Testing Replicate connection...');
    
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: 'test image',
        inputData: testImage,
        type: 'image',
        model: 'flux-schnell', // Use fastest model for testing
        preserveFace: true
      }
    });

    if (error || !data?.success) {
      return { 
        success: false, 
        error: error?.message || data?.error || 'Connection test failed' 
      };
    }

    return { 
      success: true, 
      model: data.model || data.modelKey || 'flux-schnell'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Advanced generation function with auto-model selection
export async function generateWithAutoModel({
  prompt,
  inputData,
  type,
  priority = 'quality',
  preserveFace = true,
  duration = 5
}: {
  prompt: string;
  inputData: string;
  type: 'image' | 'video';
  priority?: 'speed' | 'quality' | 'photorealistic';
  preserveFace?: boolean;
  duration?: number;
}): Promise<string> {
  const recommendedModel = getRecommendedModel(type, priority);
  
  console.log(`🤖 Auto-selected ${recommendedModel} for ${priority} priority`);
  
  return generateWithReplicate({
    prompt,
    inputData,
    type,
    model: recommendedModel as ModelType,
    duration,
    preserveFace
  });
}

// Batch generation function for testing multiple models
export async function batchGenerateWithModels({
  prompt,
  inputData,
  type,
  models,
  preserveFace = true,
  duration = 5
}: {
  prompt: string;
  inputData: string;
  type: 'image' | 'video';
  models: ModelType[];
  preserveFace?: boolean;
  duration?: number;
}): Promise<Array<{ model: string; result?: string; error?: string }>> {
  const results = [];
  
  for (const model of models) {
    try {
      console.log(`🔄 Testing with model: ${model}`);
      const result = await generateWithReplicate({
        prompt,
        inputData,
        type,
        model,
        preserveFace,
        duration
      });
      
      results.push({ model, result });
    } catch (error) {
      console.error(`❌ Failed with model ${model}:`, error);
      results.push({ 
        model, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

// Export types for use in components
export type { GenerationOptions };