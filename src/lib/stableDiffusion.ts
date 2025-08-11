import axios from 'axios';
import { generateWithReplicate } from './replicateService';
import { generateFaceSwappedImage } from './faceSwapService';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;
const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

const API_ENDPOINTS = {
  // Updated to use the newer v2 beta endpoint
  image: 'https://api.stability.ai/v2beta/stable-image/generate/core'
};

interface StabilityConfig {
  imageStrength: number;
  cfgScale: number;
  steps: number;
}

interface GenerationOptions {
  enableFaceSwap?: boolean;
  faceSwapAccuracy?: number; // 0.1 to 1.0
  useAdvancedFaceSwap?: boolean;
}

const DEFAULT_CONFIG: StabilityConfig = {
  imageStrength: 0.35,
  cfgScale: 7,
  steps: 30
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

    // Only retry on specific error conditions
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      
      // Don't retry on these status codes
      if (status && ![404, 500, 502, 503, 504, 429].includes(status)) {
        throw error;
      }
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));

    // Retry with exponential backoff
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
    // Process base64 image
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

    // Prepare form data for v2beta API
    const formData = new FormData();
    formData.append('image', imageBlob, 'input.jpg');
    formData.append('prompt', prompt);
    formData.append('negative_prompt', 'blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text');
    formData.append('aspect_ratio', '1:1'); // Square aspect ratio
    formData.append('output_format', 'png');

    // Make API request with retry logic
    const response = await retryWithExponentialBackoff(async () => {
      console.log('Attempting Stability AI generation...');
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
          timeout: 60000 // Increased timeout for v2 API
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
    console.error('Stability AI error:', error);
    
    // Handle Axios errors
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

export async function generateImage(
  prompt: string, 
  originalContent: string,
  modelType: 'image' | 'video' = 'image',
  videoDuration: number = 5,
  options: GenerationOptions = {}
): Promise<string> {
  console.log(`Starting ${modelType} generation with prompt:`, prompt);

  // Input validation
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty for generation');
  }

  if (!originalContent?.startsWith('data:image/')) {
    throw new Error('Invalid image format. Please provide a valid image.');
  }

  // Default options
  const {
    enableFaceSwap = true, // Enable face swap by default for better results
    faceSwapAccuracy = 0.8,
    useAdvancedFaceSwap = false
  } = options;

  // For video generation, use Replicate
  if (modelType === 'video') {
    if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
      throw new Error('Replicate API key not found. Please check your environment variables.');
    }

    try {
      console.log('Using Replicate for video generation...');
      const result = await generateWithReplicate({
        prompt,
        inputData: originalContent,
        type: 'video',
        duration: videoDuration
      });

      // For video, we could add face swap here too, but it's more complex
      // For now, return the regular video generation result
      return result;

    } catch (error) {
      console.error('Video generation failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to generate video. Please try again.');
    }
  }

  // For image generation with face swap capability
  if (enableFaceSwap && REPLICATE_API_KEY && !REPLICATE_API_KEY.includes('undefined')) {
    try {
      console.log('🎭 Using advanced face swap generation...');
      
      // Use face swap for more realistic results
      const faceSwappedResult = await generateFaceSwappedImage(
        originalContent,
        prompt,
        faceSwapAccuracy
      );

      console.log('✅ Face swap generation completed successfully!');
      return faceSwappedResult;

    } catch (faceSwapError) {
      console.log('Face swap failed, falling back to regular generation...', faceSwapError);
      // Fall through to regular generation methods below
    }
  }

  // Regular image generation fallback
  let lastError: Error | null = null;

  // Try Stability AI first
  if (STABILITY_API_KEY && !STABILITY_API_KEY.includes('undefined')) {
    try {
      console.log('Trying Stability AI...');
      return await generateWithStabilityAI(prompt, originalContent);
    } catch (error) {
      console.log('Stability AI failed, will try Replicate fallback...');
      lastError = error instanceof Error ? error : new Error('Stability AI failed');
      
      // Don't fallback on authentication errors
      if (lastError.message.includes('Invalid API key') || 
          lastError.message.includes('Account credits depleted')) {
        throw lastError;
      }
    }
  } else {
    console.log('No Stability AI key found, using Replicate...');
  }

  // Fallback to Replicate for image generation
  if (REPLICATE_API_KEY && !REPLICATE_API_KEY.includes('undefined')) {
    try {
      console.log('Using Replicate as fallback for image generation...');
      return await generateWithReplicate({
        prompt,
        inputData: originalContent,
        type: 'image'
      });
    } catch (error) {
      console.error('Replicate fallback also failed:', error);
      
      // If both services failed, throw a combined error
      const replicateError = error instanceof Error ? error.message : 'Replicate service failed';
      const stabilityError = lastError ? lastError.message : 'Stability AI not configured';
      
      throw new Error(`Both AI services failed. Stability AI: ${stabilityError}. Replicate: ${replicateError}`);
    }
  }

  // If no services are available
  const errorMsg = !STABILITY_API_KEY ? 'Stability AI key missing' : (lastError?.message || 'Stability AI failed');
  const replicateMsg = !REPLICATE_API_KEY ? 'Replicate API key missing' : 'Replicate not attempted';
  
  throw new Error(`No AI services available. Stability AI: ${errorMsg}. Replicate: ${replicateMsg}`);
}

/**
 * Generate image with explicit face swap enabled
 */
export async function generateImageWithFaceSwap(
  prompt: string,
  originalContent: string,
  faceSwapAccuracy: number = 0.8
): Promise<string> {
  return generateImage(prompt, originalContent, 'image', 5, {
    enableFaceSwap: true,
    faceSwapAccuracy,
    useAdvancedFaceSwap: true
  });
}

/**
 * Generate image without face swap (original behavior)
 */
export async function generateImageWithoutFaceSwap(
  prompt: string,
  originalContent: string
): Promise<string> {
  return generateImage(prompt, originalContent, 'image', 5, {
    enableFaceSwap: false
  });
}