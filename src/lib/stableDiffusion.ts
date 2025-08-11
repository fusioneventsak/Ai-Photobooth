import axios from 'axios';
import Replicate from 'replicate';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;
const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

const API_ENDPOINTS = {
  image: 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-1/image-to-image'
};

interface StabilityConfig {
  imageStrength: number;
  cfgScale: number;
  steps: number;
}

const DEFAULT_CONFIG: StabilityConfig = {
  imageStrength: 0.35,
  cfgScale: 7,
  steps: 30
};

// Maximum number of retries
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 2000; // Start with 2 seconds

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
      if (status && ![404, 500, 502, 503, 504].includes(status)) {
        throw error;
      }
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));

    // Retry with exponential backoff
    return retryWithExponentialBackoff(operation, retries - 1, delay * 2);
  }
}

// Upload file to Replicate
async function uploadToReplicate(imageData: string): Promise<string> {
  if (!REPLICATE_API_KEY) {
    throw new Error('Replicate API key not found');
  }

  // Convert base64 to blob
  const base64Data = imageData.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid image data format');
  }

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/jpeg' });
  const file = new File([blob], 'input.jpg', { type: 'image/jpeg' });

  // Get upload URL from Replicate
  const uploadResponse = await fetch('https://api.replicate.com/v1/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ purpose: 'input' })
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to get upload URL: ${errorText}`);
  }

  const uploadData = await uploadResponse.json();
  if (!uploadData?.upload_url || !uploadData?.serving_url) {
    throw new Error('Invalid upload response from Replicate');
  }

  // Upload the file
  const uploadResult = await fetch(uploadData.upload_url, {
    method: 'PUT',
    body: file
  });

  if (!uploadResult.ok) {
    throw new Error(`Failed to upload file: ${uploadResult.statusText}`);
  }

  return uploadData.serving_url;
}

export async function generateImage(
  prompt: string, 
  originalContent: string,
  modelType: 'image' | 'video' = 'image',
  videoDuration: number = 5
): Promise<string> {
  if (modelType === 'video') {
    if (!REPLICATE_API_KEY) {
      throw new Error('Replicate API key not found. Please check your environment variables.');
    }

    try {
      // Upload image to Replicate
      const imageUrl = await uploadToReplicate(originalContent);

      // Initialize Replicate client
      const replicate = new Replicate({
        auth: REPLICATE_API_KEY,
      });

      // Run Flux's image-to-video model
      const output = await replicate.run(
        "lucataco/flux-in-context:703f38c44b9c2820b79b54f96ef5f6554240b3ec4035a0cf80ba04e1f87ae307",
        {
          input: {
            image: imageUrl,
            prompt: prompt,
            num_frames: 24 * videoDuration,
            fps: 24,
            guidance_scale: 7.5,
            num_inference_steps: 50,
            negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy"
          }
        }
      );

      if (!output || typeof output !== 'string' || !output.startsWith('http')) {
        console.error('Unexpected output from Replicate:', output);
        throw new Error('Invalid response from Replicate');
      }

      // Download the video
      const response = await fetch(output);
      if (!response.ok) {
        throw new Error(`Failed to download generated video: ${response.statusText}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Received empty video file');
      }

      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Video generation error:', error);
      
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('Invalid API key')) {
          throw new Error('Invalid Replicate API key. Please check your configuration.');
        } else if (error.message.includes('rate limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        } else if (error.message.includes('insufficient credits')) {
          throw new Error('Insufficient Replicate credits. Please check your account.');
        }
        throw error;
      }
      
      throw new Error('Failed to generate video. Please try again.');
    }
  }

  // Image generation with Stability AI
  if (!STABILITY_API_KEY) {
    throw new Error('Stability API key not found. Please check your environment variables.');
  }

  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty for image generation');
  }

  if (!originalContent?.startsWith('data:image/')) {
    throw new Error('Invalid image format. Please provide a valid image.');
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

    // Prepare form data
    const formData = new FormData();
    formData.append('init_image', imageBlob);
    formData.append('image_strength', DEFAULT_CONFIG.imageStrength.toString());
    formData.append('cfg_scale', DEFAULT_CONFIG.cfgScale.toString());
    formData.append('steps', DEFAULT_CONFIG.steps.toString());
    formData.append('samples', '1');
    formData.append('text_prompts[0][text]', prompt);
    formData.append('text_prompts[0][weight]', '1');
    formData.append('text_prompts[1][text]', 'blurry, low quality, distorted, deformed, ugly, bad anatomy');
    formData.append('text_prompts[1][weight]', '-1');

    // Make API request with retry logic
    const response = await retryWithExponentialBackoff(async () => {
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
          timeout: 30000
        }
      );

      if (!result?.data) {
        throw new Error('Empty response from Stability AI');
      }

      return result;
    });

    // Handle response
    const artifact = response.data?.artifacts?.[0];
    if (!artifact?.base64) {
      throw new Error('Invalid response format from Stability AI. Please try again.');
    }

    return `data:image/png;base64,${artifact.base64}`;
  } catch (error) {
    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message;

      if (!error.response) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }

      switch (status) {
        case 400:
          if (message?.includes('dimensions')) {
            throw new Error('Invalid image dimensions. Please try capturing the photo again.');
          }
          throw new Error(`Invalid request: ${message || 'Please try again.'}`);
        case 401:
          throw new Error('Invalid API key. Please check your configuration.');
        case 402:
          throw new Error('Account credits depleted. Please check your Stability AI account.');
        case 404:
          throw new Error('The AI model is temporarily unavailable. Please wait a moment and try again.');
        case 429:
          throw new Error('Too many requests. Please wait a moment and try again.');
        case 500:
        case 502:
        case 503:
        case 504:
          throw new Error('Stability AI service is temporarily unavailable. Please wait a moment and try again.');
        default:
          throw new Error(message || 'An unexpected error occurred. Please try again.');
      }
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('An unexpected error occurred. Please try again.');
  }
}