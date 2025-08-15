// Enhanced Stability AI client for seamless SDXL inpainting
export interface StabilityGenerationParams {
  prompt: string;
  imageData: string;
  mode: 'inpaint' | 'image-to-image' | 'controlnet';
  maskData?: string;
  facePreservationMode: 'preserve_face' | 'replace_face';
  strength?: number;
  cfgScale?: number;
  steps?: number;
  useControlNet?: boolean;
  controlNetType?: 'canny' | 'depth' | 'openpose' | 'auto';
  negativePrompt?: string;
  seed?: number;
}

export interface StabilityResponse {
  success: boolean;
  imageData?: string;
  error?: string;
  metadata?: {
    model: string;
    params: any;
    processingTime: number;
  };
}

export async function generateWithStability(params: StabilityGenerationParams): Promise<string> {
  try {
    console.log('🎨 Starting enhanced SDXL inpainting with optimized parameters...');
    
    // Enhanced prompt engineering for better face results
    const enhancedPrompt = optimizePromptForFaces(params.prompt, params.facePreservationMode);
    
    // Optimized parameters for seamless blending
    const optimizedParams = {
      ...params,
      prompt: enhancedPrompt,
      negativePrompt: params.negativePrompt || generateNegativePrompt(params.facePreservationMode),
      strength: params.facePreservationMode === 'preserve_face' ? 
        Math.min(params.strength || 0.35, 0.45) : // Lower strength for face preservation
        Math.max(params.strength || 0.65, 0.55),  // Higher strength for transformation
      cfgScale: params.cfgScale || 7.5, // Optimal for SDXL
      steps: params.steps || 25,        // Good quality/speed balance
      seed: params.seed || Math.floor(Math.random() * 1000000)
    };

    console.log('🔧 Optimized generation parameters:', {
      mode: optimizedParams.mode,
      strength: optimizedParams.strength,
      cfgScale: optimizedParams.cfgScale,
      steps: optimizedParams.steps,
      faceMode: optimizedParams.facePreservationMode
    });

    // Call the Supabase Edge Function
    const { supabase } = await import('../supabaseClient');
    
    const { data, error } = await supabase.functions.invoke('generate-stability-image', {
      body: JSON.stringify({
        ...optimizedParams,
        // Additional SDXL-specific optimizations
        model: 'stable-diffusion-xl-1024-v1-0',
        style_preset: 'photographic',
        clip_guidance_preset: 'FAST_BLUE',
        sampler: 'K_DPM_2_ANCESTRAL' // Good for faces
      })
    });

    if (error) {
      console.error('❌ Stability AI Edge Function error:', error);
      throw new Error(`Stability AI generation failed: ${error.message || 'Unknown error'}`);
    }

    if (!data || !data.success) {
      console.error('❌ Stability AI generation unsuccessful:', data);
      throw new Error(data?.error || 'Generation failed without specific error');
    }

    if (!data.imageData) {
      console.error('❌ No image data received from Stability AI');
      throw new Error('No image data received from generation service');
    }

    console.log('✅ Enhanced SDXL inpainting completed successfully');
    return data.imageData;

  } catch (error) {
    console.error('❌ Stability AI generation error:', error);
    
    if (error instanceof Error) {
      // Provide more specific error messages
      if (error.message.includes('API key')) {
        throw new Error('Stability AI API key is invalid or missing. Please check your configuration.');
      } else if (error.message.includes('credits')) {
        throw new Error('Insufficient Stability AI credits. Please check your account balance.');
      } else if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (error.message.includes('timeout')) {
        throw new Error('Generation timed out. Please try again with a simpler prompt.');
      }
    }
    
    throw error;
  }
}

// Enhanced prompt optimization for better face results
function optimizePromptForFaces(originalPrompt: string, faceMode: 'preserve_face' | 'replace_face'): string {
  const basePrompt = originalPrompt.trim();
  
  if (faceMode === 'preserve_face') {
    // Emphasis on natural, realistic face preservation
    const facePreservationKeywords = [
      'photorealistic portrait',
      'natural skin texture',
      'detailed facial features',
      'sharp eyes',
      'natural lighting',
      'high resolution',
      'professional photography',
      'clean composition',
      'seamless blending'
    ];
    
    return `${basePrompt}, ${facePreservationKeywords.join(', ')}, masterpiece, best quality, 8k uhd`;
  } else {
    // Creative transformation while maintaining quality
    const transformationKeywords = [
      'creative character design',
      'artistic interpretation',
      'detailed features',
      'high quality render',
      'professional illustration',
      'cohesive style'
    ];
    
    return `${basePrompt}, ${transformationKeywords.join(', ')}, masterpiece, best quality`;
  }
}

// Generate optimized negative prompts
function generateNegativePrompt(faceMode: 'preserve_face' | 'replace_face'): string {
  const commonNegatives = [
    'blurry',
    'low quality',
    'jpeg artifacts',
    'watermark',
    'text',
    'signature',
    'low resolution',
    'pixelated',
    'distorted',
    'oversaturated'
  ];
  
  const faceSpecificNegatives = faceMode === 'preserve_face' ? [
    'facial distortion',
    'asymmetrical face',
    'unnatural skin',
    'artificial lighting',
    'plastic skin',
    'overprocessed',
    'fake looking',
    'uncanny valley',
    'face swap artifacts',
    'misaligned features',
    'circular mask',
    'visible seams',
    'harsh transitions'
  ] : [
    'inconsistent style',
    'mismatched elements',
    'poor composition',
    'incoherent design'
  ];
  
  return [...commonNegatives, ...faceSpecificNegatives].join(', ');
}

// Enhanced image preprocessing for better SDXL compatibility
export async function preprocessForSDXL(imageData: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // SDXL works best at 1024x1024
        canvas.width = 1024;
        canvas.height = 1024;
        
        // High-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Subtle preprocessing for better results
        ctx.filter = 'contrast(1.02) brightness(1.01) saturate(1.02)';
        
        // Calculate best fit scaling
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;
        
        // Fill with neutral background
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the image
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        
        // Reset filter
        ctx.filter = 'none';
        
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load image for preprocessing'));
    img.src = imageData;
  });
}

// Utility function for validating generation parameters
export function validateStabilityParams(params: StabilityGenerationParams): boolean {
  if (!params.prompt || params.prompt.trim().length === 0) {
    throw new Error('Prompt is required');
  }
  
  if (!params.imageData || !params.imageData.startsWith('data:image/')) {
    throw new Error('Valid image data is required');
  }
  
  if (params.mode === 'inpaint' && (!params.maskData || !params.maskData.startsWith('data:image/'))) {
    throw new Error('Mask data is required for inpainting mode');
  }
  
  if (params.strength && (params.strength < 0 || params.strength > 1)) {
    throw new Error('Strength must be between 0 and 1');
  }
  
  if (params.cfgScale && (params.cfgScale < 1 || params.cfgScale > 20)) {
    throw new Error('CFG scale must be between 1 and 20');
  }
  
  if (params.steps && (params.steps < 10 || params.steps > 50)) {
    throw new Error('Steps must be between 10 and 50');
  }
  
  return true;
}

// Enhanced retry logic with exponential backoff
export async function generateWithRetry(
  params: StabilityGenerationParams,
  maxRetries: number = 2
): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Generation attempt ${attempt + 1}/${maxRetries + 1}`);
      
      // Validate parameters before each attempt
      validateStabilityParams(params);
      
      // Add slight randomization to avoid identical failures
      const adjustedParams = {
        ...params,
        seed: params.seed ? params.seed + attempt : undefined,
        cfgScale: params.cfgScale ? params.cfgScale + (attempt * 0.5) : undefined
      };
      
      const result = await generateWithStability(adjustedParams);
      console.log(`✅ Generation successful on attempt ${attempt + 1}`);
      return result;
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Generation attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`❌ All ${maxRetries + 1} generation attempts failed`);
  throw lastError || new Error('Generation failed after all retry attempts');
}