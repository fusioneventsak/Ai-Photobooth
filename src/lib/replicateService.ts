import { supabase } from './supabase'

export type ModelType = 
  | 'flux-schnell' 
  | 'flux-dev' 
  | 'flux-pro'
  | 'sdxl'
  | 'realistic-vision'

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
  const models = {
    image: {
      'flux-schnell': {
        name: 'FLUX Schnell',
        description: 'Fastest image generation',
        speed: 'fast',
        quality: 'good'
      },
      'flux-dev': {
        name: 'FLUX Dev',
        description: 'High quality image generation',
        speed: 'medium',
        quality: 'excellent'
      },
      'flux-pro': {
        name: 'FLUX Pro',
        description: 'Professional quality images',
        speed: 'slow',
        quality: 'professional'
      },
      'sdxl': {
        name: 'Stable Diffusion XL',
        description: 'Popular stable diffusion model',
        speed: 'medium',
        quality: 'very good'
      },
      'realistic-vision': {
        name: 'Realistic Vision',
        description: 'Photorealistic image generation',
        speed: 'medium',
        quality: 'photorealistic'
      }
    },
    video: {
      'stable-video': {
        name: 'Stable Video Diffusion',
        description: 'Generate short videos from images',
        speed: 'slow',
        quality: 'good'
      }
    }
  }

  if (!model) {
    return null
  }

  return models[type]?.[model as keyof typeof models[typeof type]]
}

// Get recommended model based on priority
export function getRecommendedModel(type: 'image' | 'video', priority: 'speed' | 'quality' | 'photorealistic' = 'quality'): ModelType {
  const recommendations = {
    image: {
      speed: 'flux-schnell',
      quality: 'flux-dev', 
      photorealistic: 'realistic-vision'
    },
    video: {
      speed: 'stable-video',
      quality: 'stable-video',
      photorealistic: 'stable-video'
    }
  }

  return recommendations[type][priority] as ModelType
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
export default { 
  generateWithReplicate, 
  testReplicateConnection, 
  getModelInfo, 
  getRecommendedModel, 
  generateWithAutoModel,
  batchGenerateWithModels,
  validateReplicateParams 
}