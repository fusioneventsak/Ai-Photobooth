import { supabase } from './supabase'

export interface StabilityParams {
  prompt: string
  imageData: string
  maskData?: string
  mode?: 'image-to-image' | 'inpaint'
  strength?: number
  cfgScale?: number
  steps?: number
  negativePrompt?: string
  seed?: number
  useControlNet?: boolean
  controlNetType?: string
  facePreservationMode?: 'preserve_face' | 'transform_face'
}

export async function generateWithStability(params: StabilityParams): Promise<string> {
  try {
    console.log('🔄 Starting Stability AI generation...', {
      mode: params.mode,
      hasMask: !!params.maskData,
      faceMode: params.facePreservationMode
    })

    // Validate required parameters
    if (!params.prompt || !params.imageData) {
      throw new Error('Missing required parameters: prompt and imageData')
    }

    // Optimize parameters for SDXL and face preservation
    const optimizedParams = {
      prompt: params.prompt,
      imageData: params.imageData,
      maskData: params.maskData,
      mode: params.mode || (params.maskData ? 'inpaint' : 'image-to-image'),
      negativePrompt: params.negativePrompt || 'blurry, low quality, distorted, deformed, ugly, bad anatomy, extra limbs, extra fingers, mutated hands',
      facePreservationMode: params.facePreservationMode || 'preserve_face',
      useControlNet: params.useControlNet !== false, // Default to true
      controlNetType: params.controlNetType || 'auto',
      // Face preservation: lower strength to keep original features
      strength: params.facePreservationMode === 'preserve_face' ? 
        Math.min(params.strength || 0.35, 0.45) : 
        Math.max(params.strength || 0.65, 0.55),
      cfgScale: params.cfgScale || 7.5,
      steps: params.steps || 25,
      seed: params.seed || Math.floor(Math.random() * 1000000),
      // SDXL-specific optimizations
      model: 'stable-diffusion-xl-1024-v1-0',
      style_preset: 'photographic',
      clip_guidance_preset: 'FAST_BLUE',
      sampler: 'K_DPM_2_ANCESTRAL'
    }

    console.log('🔧 Optimized generation parameters:', {
      mode: optimizedParams.mode,
      strength: optimizedParams.strength,
      cfgScale: optimizedParams.cfgScale,
      steps: optimizedParams.steps,
      faceMode: optimizedParams.facePreservationMode
    })

    // Call the Supabase Edge Function with proper body formatting
    const { data, error } = await supabase.functions.invoke('generate-stability-image', {
      body: optimizedParams // Pass as object, not JSON.stringify
    })

    if (error) {
      console.error('❌ Stability AI Edge Function error:', error)
      
      // Parse error details if available
      const errorDetails = error.details || error.message || 'Unknown error'
      const errorType = error.errorType || 'unknown_error'
      
      // Provide specific error messages based on error type
      switch (errorType) {
        case 'server_error':
          throw new Error('API key configuration error. Please check your Stability AI API key in Supabase Edge Functions.')
        case 'api_error':
          throw new Error(`Stability AI API error: ${errorDetails}`)
        case 'timeout_error':
          throw new Error('Generation timed out. Please try again with a simpler prompt.')
        case 'validation_error':
          throw new Error('Invalid parameters. Please check your input data.')
        case 'network_error':
          throw new Error('Network connection error. Please check your internet connection.')
        default:
          throw new Error(`Stability AI generation failed: ${error.message || errorDetails}`)
      }
    }

    // Check for successful response
    if (!data || !data.success) {
      console.error('❌ Stability AI generation unsuccessful:', data)
      
      const errorMessage = data?.error || 'Generation failed without specific error'
      const suggestion = data?.suggestion || 'Try again later'
      
      throw new Error(`${errorMessage}. ${suggestion}`)
    }

    if (!data.imageData) {
      console.error('❌ No image data received from Stability AI')
      throw new Error('No image data received from generation service')
    }

    console.log('✅ Enhanced SDXL inpainting completed successfully')
    return data.imageData

  } catch (error) {
    console.error('❌ Stability AI generation error:', error)
    console.error('📊 Generation error details:', error)
    
    if (error instanceof Error) {
      // Provide more specific error messages
      if (error.message.includes('API key')) {
        throw new Error('Stability AI API key is invalid or missing. Please check your configuration.')
      } else if (error.message.includes('credits')) {
        throw new Error('Insufficient Stability AI credits. Please check your account balance.')
      } else if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.')
      } else if (error.message.includes('timeout')) {
        throw new Error('Generation timed out. Please try again with a simpler prompt.')
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
export async function testStabilityConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    // Create a minimal test image (1x1 pixel)
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    
    console.log('🧪 Testing Stability AI connection...')
    
    const { data, error } = await supabase.functions.invoke('generate-stability-image', {
      body: {
        prompt: 'test image',
        imageData: testImage,
        mode: 'image-to-image',
        strength: 0.5,
        steps: 10 // Minimal steps for testing
      }
    })

    if (error || !data?.success) {
      return { 
        success: false, 
        error: error?.message || data?.error || 'Connection test failed' 
      }
    }

    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Enhanced error handling and validation
export function validateStabilityParams(params: StabilityParams): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!params.prompt || params.prompt.trim().length === 0) {
    errors.push('Prompt is required')
  }

  if (!params.imageData || !params.imageData.startsWith('data:image/')) {
    errors.push('Valid image data is required')
  }

  if (params.mode === 'inpaint' && (!params.maskData || !params.maskData.startsWith('data:image/'))) {
    errors.push('Mask data is required for inpaint mode')
  }

  if (params.strength !== undefined && (params.strength < 0 || params.strength > 1)) {
    errors.push('Strength must be between 0 and 1')
  }

  if (params.cfgScale !== undefined && (params.cfgScale < 1 || params.cfgScale > 20)) {
    errors.push('CFG Scale must be between 1 and 20')
  }

  if (params.steps !== undefined && (params.steps < 10 || params.steps > 50)) {
    errors.push('Steps must be between 10 and 50')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

// Utility function for image processing
export function optimizeImageForStability(imageData: string): string {
  try {
    // Basic validation and optimization
    if (!imageData.startsWith('data:image/')) {
      throw new Error('Invalid image data format')
    }

    // You could add image resizing, compression, or format conversion here
    // For now, just return the original data
    return imageData
  } catch (error) {
    console.error('❌ Image optimization failed:', error)
    throw new Error('Failed to optimize image for Stability AI')
  }
}

export default { generateWithStability, testStabilityConnection, validateStabilityParams, optimizeImageForStability }