import axios from 'axios';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;
const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

// Updated API endpoints with correct model IDs
const API_ENDPOINTS = {
  // Use the current v2beta endpoint which works reliably
  image: 'https://api.stability.ai/v2beta/stable-image/generate/core',
  // Backup v1 endpoint with correct model ID
  imageV1: 'https://api.stability.ai/v1/generation/stable-diffusion-v1-6/image-to-image'
};

// Maximum number of retries
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 2000;

async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = INITIAL_RETRY_DELAY
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (retries === 0) throw error;

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status && ![404, 500, 502, 503, 504, 429].includes(status)) {
        throw error;
      }
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithExponentialBackoff(operation, retries - 1, delay * 2);
  }
}

async function generateWithStabilityAIv2(
  prompt: string,
  originalContent: string
): Promise<string> {
  try {
    const base64Data = originalContent.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid image data. Please try capturing the photo again.');
    }

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const imageBlob = new Blob([byteArray], { type: 'image/jpeg' });

    if (imageBlob.size === 0) {
      throw new Error('Empty image content received. Please try capturing the photo again.');
    }

    if (imageBlob.size > 10 * 1024 * 1024) {
      throw new Error('Image size exceeds 10MB limit. Please try capturing a smaller photo.');
    }

    // Enhanced prompt for maximum face preservation
    const facePreservationPrompt = `Transform this person into: ${prompt}. CRITICAL: Preserve the EXACT same person - identical face, same skin tone, same facial features, same eye color, same nose, same mouth shape, same cheekbones. Only change the clothing, background, and setting. The person's identity must remain completely unchanged.`;

    // Strong negative prompt to prevent face changes
    const strongNegativePrompt = 'different person, face change, different skin color, different ethnicity, different race, wrong face, altered facial features, different nose, different eyes, different mouth, changed person, face swap, identity change';

    const formData = new FormData();
    formData.append('image', imageBlob, 'input.jpg');
    formData.append('prompt', facePreservationPrompt);
    formData.append('negative_prompt', strongNegativePrompt);
    formData.append('strength', '0.25'); // Low strength to preserve original
    formData.append('aspect_ratio', '1:1');
    formData.append('output_format', 'png');

    const response = await retryWithExponentialBackoff(async () => {
      console.log('🎯 Using Stability AI v2 with face preservation...');
      console.log('Strength: 0.25 (preserving 75% of original)');
      
      const result = await axios.post(
        API_ENDPOINTS.image,
        formData,
        {
          headers: {
            Accept: 'image/*',
            Authorization: `Bearer ${STABILITY_API_KEY}`,
          },
          responseType: 'arraybuffer',
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 60000
        }
      );

      if (!result?.data) {
        throw new Error('Empty response from Stability AI');
      }

      return result;
    });

    // Convert arraybuffer to base64
    const arrayBuffer = response.data;
    const base64String = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:image/png;base64,${base64String}`;

  } catch (error) {
    console.error('Stability AI v2 error:', error);
    throw error;
  }
}

async function generateWithStabilityAIv1(
  prompt: string,
  originalContent: string
): Promise<string> {
  try {
    const base64Data = originalContent.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid image data. Please try capturing the photo again.');
    }

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const imageBlob = new Blob([byteArray], { type: 'image/jpeg' });

    // Enhanced prompt for face preservation
    const detailedPrompt = `Transform this person into: ${prompt}. IMPORTANT: Keep the exact same person's face - same skin tone, same facial features, same eye shape, same nose, same mouth structure. Only change the clothing, background, and setting. The person's face must remain completely identical.`;

    const detailedNegativePrompt = 'different person, face change, different skin color, different ethnicity, wrong face, altered facial features, different nose shape, different eye color, face swap, different mouth, changed appearance, different jawline';

    // Use form data for v1 API
    const formData = new FormData();
    formData.append('init_image', imageBlob, 'image.jpg');
    formData.append('image_strength', '0.2'); // Very low - keep 80% of original
    formData.append('cfg_scale', '15'); // Higher guidance for better prompt following
    formData.append('steps', '40'); // More steps for better quality
    formData.append('samples', '1');
    formData.append('text_prompts[0][text]', detailedPrompt);
    formData.append('text_prompts[0][weight]', '1');
    formData.append('text_prompts[1][text]', detailedNegativePrompt);
    formData.append('text_prompts[1][weight]', '-1');

    const response = await retryWithExponentialBackoff(async () => {
      console.log('🎯 Using Stability AI v1 with optimal settings...');
      console.log('Image strength: 0.2 (preserving 80% of original)');
      
      const result = await axios.post(
        API_ENDPOINTS.imageV1,
        formData,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${STABILITY_API_KEY}`,
            'Content-Type': 'multipart/form-data'
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
          timeout: 60000
        }
      );

      if (!result?.data) {
        throw new Error('Empty response from Stability AI');
      }

      return result;
    });

    // Handle the JSON response format for v1
    const artifact = response.data?.artifacts?.[0];
    if (!artifact?.base64) {
      throw new Error('Invalid response format from Stability AI. Please try again.');
    }

    return `data:image/png;base64,${artifact.base64}`;

  } catch (error) {
    console.error('Stability AI v1 error:', error);
    throw error;
  }
}

// Simple Replicate fallback without complex uploads
async function generateWithReplicateSimple(
  prompt: string,
  originalContent: string
): Promise<string> {
  // For now, just throw an error to avoid upload issues
  // We'll focus on getting Stability AI working properly
  throw new Error('Replicate temporarily disabled due to upload issues. Please use Stability AI.');
}

export async function generateImage(
  prompt: string, 
  originalContent: string,
  modelType: 'image' | 'video' = 'image',
  videoDuration: number = 5
): Promise<string> {
  console.log('🚀 Starting generation with optimized face preservation');
  console.log('Original prompt:', prompt);

  // Input validation
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty for generation');
  }

  if (!originalContent?.startsWith('data:image/')) {
    throw new Error('Invalid image format. Please provide a valid image.');
  }

  // For video generation, return error for now
  if (modelType === 'video') {
    throw new Error('Video generation temporarily disabled. Please use image generation.');
  }

  // For image generation - try both Stability AI versions
  if (!STABILITY_API_KEY || STABILITY_API_KEY.includes('undefined')) {
    throw new Error('Stability AI API key not found. Please check your .env file and make sure VITE_STABILITY_API_KEY is set.');
  }

  let lastError: Error | null = null;

  // Try v2 API first
  try {
    console.log('🎯 Trying Stability AI v2 API...');
    return await generateWithStabilityAIv2(prompt, originalContent);
  } catch (error) {
    console.log('❌ Stability AI v2 failed, trying v1 API...');
    lastError = error instanceof Error ? error : new Error('Stability AI v2 failed');
    
    // Don't try fallback on auth errors
    if (lastError.message.includes('Invalid API key') || 
        lastError.message.includes('Account credits depleted')) {
      throw lastError;
    }
  }

  // Try v1 API as fallback
  try {
    console.log('🔄 Trying Stability AI v1 API as fallback...');
    return await generateWithStabilityAIv1(prompt, originalContent);
  } catch (error) {
    console.log('❌ Stability AI v1 also failed');
    const v1Error = error instanceof Error ? error : new Error('Stability AI v1 failed');
    
    // Don't try further fallbacks on auth errors
    if (v1Error.message.includes('Invalid API key') || 
        v1Error.message.includes('Account credits depleted')) {
      throw v1Error;
    }

    // Both Stability AI versions failed
    const v2ErrorMsg = lastError ? lastError.message : 'Unknown v2 error';
    const v1ErrorMsg = v1Error.message;
    
    throw new Error(`Stability AI failed on both v1 and v2 APIs. v2 error: ${v2ErrorMsg}. v1 error: ${v1ErrorMsg}. Please check your API key and account status.`);
  }
}