import axios from 'axios';
import { generateWithReplicate } from './replicateService';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;
const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

const API_ENDPOINTS = {
  image: 'https://api.stability.ai/v2beta/stable-image/generate/core'
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

    // MUCH stronger face preservation prompt
    const strongFacePreservationPrompt = `Transform this person into: ${prompt}. CRITICAL: Keep the EXACT same face, identical facial features, same skin tone, same eye color, same nose shape, same mouth, same jawline, same cheekbones, same eyebrows, same hair color if visible. This must be the SAME PERSON just in a different setting/outfit. Preserve all facial characteristics completely.`;

    const strongNegativePrompt = 'different person, changed face, different skin color, different ethnicity, different race, wrong face, face swap, different facial features, different nose, different eyes, different mouth, altered appearance, different person entirely, face change';

    // Use very low strength to preserve maximum face details
    const formData = new FormData();
    formData.append('image', imageBlob, 'input.jpg');
    formData.append('prompt', strongFacePreservationPrompt);
    formData.append('negative_prompt', strongNegativePrompt);
    formData.append('strength', '0.15'); // VERY low strength - preserve 85% of original
    formData.append('aspect_ratio', '1:1');
    formData.append('output_format', 'png');

    const response = await retryWithExponentialBackoff(async () => {
      console.log('🎭 Attempting Stability AI with STRONG face preservation...');
      console.log('Strength: 0.15 (preserving 85% of original)');
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

    const arrayBuffer = response.data;
    const base64String = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:image/png;base64,${base64String}`;

  } catch (error) {
    console.error('Stability AI error:', error);
    
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || 
                     (typeof error.response?.data === 'string' ? error.response.data : '');

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
        case 404:
          throw new Error('Stability AI model not found. This may be a temporary issue.');
        case 429:
          throw new Error('Too many requests. Please wait a moment and try again.');
        case 500:
        case 502:
        case 503:
        case 504:
          throw new Error('Stability AI service is temporarily unavailable. Trying fallback service...');
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

async function generateWithReplicateStrong(
  prompt: string,
  originalContent: string
): Promise<string> {
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
    throw new Error('Replicate API key not found.');
  }

  // Use an even stronger prompt for Replicate
  const ultraStrongPrompt = `Transform this person into: ${prompt}. ABSOLUTELY CRITICAL: This must be the EXACT SAME PERSON with identical facial features, same face structure, same skin tone, same ethnicity, same eye color, same nose, same mouth, same facial bone structure. DO NOT change the person's race, ethnicity, or facial features AT ALL. Keep their face 100% identical, only change the setting, clothing, or background.`;

  try {
    console.log('🎭 Using Replicate with ULTRA-STRONG face preservation...');
    return await generateWithReplicate({
      prompt: ultraStrongPrompt,
      inputData: originalContent,
      type: 'image'
    });
  } catch (error) {
    throw error;
  }
}

export async function generateImage(
  prompt: string, 
  originalContent: string,
  modelType: 'image' | 'video' = 'image',
  videoDuration: number = 5,
  preserveFace: boolean = true
): Promise<string> {
  console.log(`🚀 Starting ${modelType} generation with MAXIMUM face preservation`);
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

  // For image generation with MAXIMUM face preservation
  let lastError: Error | null = null;

  // Try Stability AI first with very strong face preservation
  if (STABILITY_API_KEY && !STABILITY_API_KEY.includes('undefined')) {
    try {
      console.log('🎯 Trying Stability AI with MAXIMUM face preservation (strength: 0.15)...');
      return await generateWithStabilityAI(prompt, originalContent);
    } catch (error) {
      console.log('❌ Stability AI failed, trying Replicate with ultra-strong face preservation...');
      lastError = error instanceof Error ? error : new Error('Stability AI failed');
      
      if (lastError.message.includes('Invalid API key') || 
          lastError.message.includes('Account credits depleted')) {
        throw lastError;
      }
    }
  } else {
    console.log('No Stability AI key found, using Replicate with ultra-strong face preservation...');
  }

  // Fallback to Replicate with ultra-strong face preservation
  if (REPLICATE_API_KEY && !REPLICATE_API_KEY.includes('undefined')) {
    try {
      console.log('🔄 Using Replicate with ULTRA-STRONG face preservation...');
      return await generateWithReplicateStrong(prompt, originalContent);
    } catch (error) {
      console.error('❌ Replicate also failed:', error);
      
      const replicateError = error instanceof Error ? error.message : 'Replicate service failed';
      const stabilityError = lastError ? lastError.message : 'Stability AI not configured';
      
      throw new Error(`Both AI services failed to preserve your face. Stability AI: ${stabilityError}. Replicate: ${replicateError}`);
    }
  }

  // If no services are available
  const errorMsg = !STABILITY_API_KEY ? 'Stability AI key missing' : (lastError?.message || 'Stability AI failed');
  const replicateMsg = !REPLICATE_API_KEY ? 'Replicate API key missing' : 'Replicate not attempted';
  
  throw new Error(`No AI services available. Stability AI: ${errorMsg}. Replicate: ${replicateMsg}`);
}