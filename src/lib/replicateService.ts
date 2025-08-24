import { supabase } from './supabase'

// Available models for each type - REPLICATE_MODELS constant
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
    'flux-pro': {
      name: "FLUX Pro",
      description: "Professional quality images",
      speed: "🐌 Slow",
      quality: "✨ Premium",
      bestFor: "Professional quality, commercial use"
    },
    'sdxl': {
      name: "Stable Diffusion XL",
      description: "Classic high-quality generation",
      speed: "🚀 Medium",
      quality: "🔥 High",
      bestFor: "Balanced quality and speed"
    },
    'realistic-vision': {
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
} as const

export type ImageModel = keyof typeof REPLICATE_MODELS.image
export type VideoModel = keyof typeof REPLICATE_MODELS.video
export type ModelType = ImageModel | VideoModel

export interface GenerationOptions {
  prompt: string
  inputData: string
  type: 'image' | 'video'
  model?: ModelType
  duration?: number
  preserveFace?: boolean
  faceMode?: 'preserve_face' | 'transform_face'
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  model,
  duration = 5,
  preserveFace = true,
  faceMode = 'preserve_face'
}: GenerationOptions): Promise<string> {
  try {
    console.log(`🔄 Calling Replicate Edge Function for ${type} generation...`)
    
    // Log model selection
    if (model) {
      console.log(`📊 Selected model: ${model}`)
    } else {
      console.log(`📊 Using default model for ${type}`)
    }

    // Validate required parameters
    if (!prompt || !inputData) {
      throw new Error('Missing required parameters: prompt and inputData')
    }

    if (!type || !['image', 'video'].includes(type)) {
      throw new Error('Invalid type parameter. Must be "image" or "video"')
    }

    // Call Supabase Edge Function with enhanced parameters
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt,
        inputData,
        type,
        model,
        duration,
        preserveFace,
        faceMode
      }
    })

    if (error) {
      console.error('❌ Replicate Edge Function error:', error)
      
      // Parse error details if available
      const errorDetails = error.details || error.message || 'Unknown error'
      const errorType = error.errorType || 'unknown_error'
      
      // Provide specific error messages based on error type
      switch (errorType) {
        case 'server_error':
          throw new Error('API key configuration error. Please check your Replicate API key in Supabase Edge Functions.')
        case 'api_error':
          throw new Error(`Replicate API error: ${errorDetails}`)
        case 'timeout_error':
        case 'generation_error':
          throw new Error('Generation timed out. Please try again or use a faster model.')
        case 'validation_error':
          throw new Error('Invalid parameters. Please check your input data.')
        case 'method_error':
          throw new Error('Invalid request method.')
        case 'parse_error':
          throw new Error('Data format error. Please try again.')
        default:
          throw new Error(`Replicate generation failed: ${error.message || errorDetails}`)
      }
    }

    // Enhanced response validation
    if (!data || !data.success) {
      const errorMessage = data?.error || `Invalid response from ${type} generation service`
      const suggestion = data?.suggestion || 'Try again later'
      console.error('❌ Generation failed:', errorMessage)
      throw new Error(`${errorMessage}. ${suggestion}`)
    }

    if (!data.result) {
      throw new Error(`No result returned from ${type} generation service`)
    }

    // Log success with model info
    const modelName = data.model || model || 'Unknown Model'
    console.log(`✅ Replicate ${type} generation successful with ${modelName}`)
    
    return data.result

  } catch (error) {
    console.error('❌ Replicate API Error:', error)
    console.error('📊 Generation error details:', error)
    
    if (error instanceof Error) {
      // Enhanced error handling with specific messages
      if (error.message.includes('API key')) {
        throw new Error('Replicate API key is invalid or missing. Please check your configuration.')
      } else if (error.message.includes('credits') || error.message.includes('billing')) {
        throw new Error('Insufficient Replicate credits. Please add credits to your account.')
      } else if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.')
      } else if (error.message.includes('timeout')) {
        throw new Error('Generation timed out. Please try again or use a faster model.')
      } else if (error.message.includes('Invalid model')) {
        throw new Error('Selected model is not available. Please choose a different model.')
      } else if (error.message.includes('upload')) {
        throw new Error('Failed to upload image. Please check your image format and try again.')
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.')
      } else if (error.message.includes('parse') || error.message.includes('JSON')) {
        throw new Error('Data format error. Please try again.')
      }
      
      // Re-throw the original error if no specific handling
      throw error
    } else {
      throw new Error('Unknown error occurred during generation')
    }
  }
}

// Test function for API connectivity
export async function testReplicateConnection(): Promise<{ 
  success: boolean; 
  error?: string; 
  model?: string 
}> {
  try {
    // Create a minimal test image (1x1 pixel)
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    
    console.log('🧪 Testing Replicate connection...')
    
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: 'test image',
        inputData: testImage,
        type: 'image',
        model: 'flux-schnell', // Use fastest model for testing
        preserveFace: true
      }
    })

    if (error || !data?.success) {
      return { 
        success: false, 
        error: error?.message || data?.error || 'Connection test failed' 
      }
    }

    return { 
      success: true, 
      model: data.model || 'flux-schnell'
    }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Get model information
export function getModelInfo(type: 'image' | 'video', model?: ModelType) {
  if (!model) return null
  
  const models = REPLICATE_MODELS[type] as any
  return models[model] || null
}

// Helper function to get all available models for a type
export function getAvailableModels(type: 'image' | 'video') {
  return REPLICATE_MODELS[type]
}

// Helper function to get default model for each type
export function getDefaultModel(type: 'image' | 'video'): string {
  const models = REPLICATE_MODELS[type]
  return Object.keys(models)[0]
}

// Get recommended model based on priority
export function getRecommendedModel(type: 'image' | 'video', priority: 'speed' | 'quality' | 'photorealistic' = 'quality'): ModelType {
  if (type === 'image') {
    const recommendations = {
      speed: 'flux-schnell' as ImageModel,
      quality: 'flux-dev' as ImageModel,
      photorealistic: 'realistic-vision' as ImageModel
    }
    return recommendations[priority]
  } else {
    // For video, we have limited options
    return 'stable-video-diffusion' as VideoModel
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
  prompt: string
  inputData: string
  type: 'image' | 'video'
  priority?: 'speed' | 'quality' | 'photorealistic'
  preserveFace?: boolean
  duration?: number
}): Promise<string> {
  const recommendedModel = getRecommendedModel(type, priority)
  
  console.log(`🤖 Auto-selected ${recommendedModel} for ${priority} priority`)
  
  return generateWithReplicate({
    prompt,
    inputData,
    type,
    model: recommendedModel,
    duration,
    preserveFace
  })
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
  prompt: string
  inputData: string
  type: 'image' | 'video'
  models: ModelType[]
  preserveFace?: boolean
  duration?: number
}): Promise<Array<{ model: string; result?: string; error?: string }>> {
  const results = []
  
  for (const model of models) {
    try {
      console.log(`🔄 Testing with model: ${model}`)
      const result = await generateWithReplicate({
        prompt,
        inputData,
        type,
        model,
        preserveFace,
        duration
      })
      
      results.push({ model, result })
    } catch (error) {
      console.error(`❌ Failed with model ${model}:`, error)
      results.push({ 
        model, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  return results
}

// Validation function for parameters
export function validateReplicateParams(params: GenerationOptions): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!params.prompt || params.prompt.trim().length === 0) {
    errors.push('Prompt is required')
  }

  if (!params.inputData || !params.inputData.startsWith('data:image/')) {
    errors.push('Valid image data is required')
  }

  if (!params.type || !['image', 'video'].includes(params.type)) {
    errors.push('Type must be "image" or "video"')
  }

  if (params.duration !== undefined && (params.duration < 1 || params.duration > 30)) {
    errors.push('Duration must be between 1 and 30 seconds')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// Export types for use in components
export type { GenerationOptions }

// Default export for backward compatibility
export default { 
  generateWithReplicate, 
  testReplicateConnection, 
  getModelInfo, 
  getRecommendedModel, 
  generateWithAutoModel,
  batchGenerateWithModels,
  validateReplicateParams,
  getAvailableModels,
  getDefaultModel,
  REPLICATE_MODELS
}