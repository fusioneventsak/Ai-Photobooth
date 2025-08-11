import axios from 'axios';
import { generateWithReplicate } from './replicateService';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;
const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

const API_ENDPOINTS = {
  // Use the image-to-image endpoint which is better for face preservation
  image: 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-1/image-to-image'
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

async function generateWithStabilityAI(
  prompt: string,
  originalContent: string
): Promise<string> {
  if (!STABILITY_API_KEY || STABILITY_API_KEY.includes('undefined')) {
    throw new Error('Stability API key not found. Please check your environment variables.');
  }

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

    // Create a much more specific prompt that tells the AI exactly what to do
    const detailedPrompt = `Transform the person in this image into: ${prompt}. IMPORTANT: Keep the exact same person's face - same skin tone, same facial features, same eye shape, same nose, same mouth structure. Only change the clothing, background, and setting. The person's face must remain completely identical.`;

    // Very specific negative prompt to prevent face changes
    const detailedNegativePrompt = 'different person, face change, different skin color, different ethnicity, wrong face, altered facial features, different nose shape, different eye color, face swap, different mouth, changed appearance, different jawline';

    // Use form data for multipart upload (required by v1 API)
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
      console.log('🎯 Using Stability AI v1 image-to-image with optimal settings...');
      console.log('Image strength: 0.2 (preserving 80% of original)');
      console.log('CFG Scale: 15 (strong prompt following)');
      console.log('Steps: 40 (high quality)');
      
      const result = await axios.post(
        API_ENDPOINTS.image,
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

    // Handle the JSON response format
    const artifact = response.data?.artifacts?.[0];
    if (!artifact?.base64) {
      throw new Error('Invalid response format from Stability AI. Please try again.');
    }

    return `data:image/png;base64,${artifact.base64}`;

  } catch (error) {
    console.error('Stability AI error:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (!error.response) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }

      switch (status) {
        case 400:
          throw new Error(`Invalid request: ${message || 'Please check your image and try again.'}`);
        case 401:
          throw new Error('Invalid API key. Please check your Stability AI configuration.');
        case 402:
          throw new Error('Account credits depleted. Please check your Stability AI account.');
        case 429:
          throw new Error('Too many requests. Please wait a moment and try again.');
        case 500:
        case 502:
        case 503:
        case 504:
          throw new Error('Stability AI service is temporarily unavailable. Please try again.');
        default:
          throw new Error(message || 'An unexpected error occurred with Stability AI.');
      }
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('An unexpected error occurred with Stability AI.');
  }
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

  // For video generation
  if (modelType === 'video') {
    if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
      throw new Error('Replicate API key not found. Please check your environment variables.');
    }

    try {
      console.log('Using Replicate for video generation...');
      return await generateWithReplicate({
        prompt,
        inputData: originalContent,
        type: 'video',
        duration: videoDuration
      });
    } catch (error) {
      console.error('Video generation failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to generate video. Please try again.');
    }
  }

  // For image generation - try Stability AI with optimal settings first
  let lastError: Error | null = null;

  if (STABILITY_API_KEY && !STABILITY_API_KEY.includes('undefined')) {
    try {
      console.log('🎯 Using Stability AI with optimal face preservation settings...');
      return await generateWithStabilityAI(prompt, originalContent);
    } catch (error) {
      console.log('❌ Stability AI failed:', error);
      lastError = error instanceof Error ? error : new Error('Stability AI failed');
      
      // Don't fallback on authentication errors
      if (lastError.message.includes('Invalid API key') || 
          lastError.message.includes('Account credits depleted')) {
        throw lastError;
      }
    }
  } else {
    console.log('⚠️ No Stability AI key found. Stability AI generally works better for face preservation.');
    lastError = new Error('Stability AI key not configured');
  }

  // Fallback to Replicate only if Stability AI fails
  if (REPLICATE_API_KEY && !REPLICATE_API_KEY.includes('undefined')) {
    try {
      console.log('🔄 Falling back to Replicate...');
      console.log('Note: Replicate may not preserve faces as well as Stability AI');
      
      return await generateWithReplicate({
        prompt: `Transform this person into: ${prompt}. Keep the same person's face, identical facial features, same skin tone, same ethnicity. Only change the setting and clothing.`,
        inputData: originalContent,
        type: 'image'
      });
    } catch (error) {
      console.error('❌ Replicate also failed:', error);
      
      const replicateError = error instanceof Error ? error.message : 'Replicate service failed';
      const stabilityError = lastError ? lastError.message : 'Stability AI not configured';
      
      throw new Error(`Both AI services failed. For best face preservation, configure Stability AI. Stability: ${stabilityError}. Replicate: ${replicateError}`);
    }
  }

  // If no services are available
  throw new Error('No AI services configured. Please add your Stability AI or Replicate API key to the environment variables.');
}