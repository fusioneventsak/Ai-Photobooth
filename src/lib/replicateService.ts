import Replicate from 'replicate';

const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'image' | 'video';
  duration?: number;
}

// Maximum number of retries for fetch operations
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // milliseconds

// Helper function to convert data URI to blob
function dataURItoBlob(dataURI: string): Blob {
  try {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  } catch (error) {
    console.error('Error converting data URI to blob:', error);
    throw new Error('Failed to process image data');
  }
}

// Retry fetch with exponential backoff
async function retryFetch(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(60000) // 60 second timeout
      });
      
      if (response.ok) {
        return response;
      }
      
      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Retry on server errors (5xx) or network issues
      if (attempt < retries) {
        console.log(`Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (attempt < retries && (error instanceof TypeError || error.message.includes('fetch'))) {
        console.log(`Network error on attempt ${attempt + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('All retry attempts failed');
}

// Upload image to Replicate
async function uploadToReplicate(imageData: string): Promise<string> {
  try {
    // Convert base64 to blob
    const blob = dataURItoBlob(imageData);
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
    const uploadResult = await retryFetch(uploadData.upload_url, {
      method: 'PUT',
      body: file
    });

    if (!uploadResult.ok) {
      throw new Error(`Failed to upload file: ${uploadResult.statusText}`);
    }

    return uploadData.serving_url;
  } catch (error) {
    console.error('Error uploading to Replicate:', error);
    throw new Error('Failed to upload image to Replicate service');
  }
}

async function generateVideo(
  replicate: Replicate, 
  prompt: string, 
  imageData: string, 
  duration: number = 5
): Promise<string> {
  try {
    // Upload image to Replicate first
    console.log('Uploading image to Replicate...');
    const imageUrl = await uploadToReplicate(imageData);

    // Run video generation model
    console.log('Running video generation model...');
    const output = await replicate.run(
      "lucataco/flux-in-context:703f38c44b9c2820b79b54f96ef5f6554240b3ec4035a0cf80ba04e1f87ae307",
      {
        input: {
          image: imageUrl,
          prompt: prompt,
          num_frames: Math.min(24 * duration, 120), // Cap at 120 frames (5 seconds at 24fps)
          fps: 24,
          guidance_scale: 7.5,
          num_inference_steps: 50,
          negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text"
        }
      }
    );

    if (!output || typeof output !== 'string' || !output.startsWith('http')) {
      console.error('Unexpected video output from Replicate:', output);
      throw new Error('Invalid video response from Replicate API');
    }

    // Download the video
    console.log('Downloading generated video...');
    const response = await retryFetch(output, {});
    
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    
    const videoBlob = await response.blob();
    if (videoBlob.size === 0) {
      throw new Error('Received empty video file');
    }
    
    return URL.createObjectURL(videoBlob);

  } catch (error) {
    console.error('Video generation error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (error.message.includes('insufficient credits')) {
        throw new Error('Insufficient Replicate credits. Please check your account.');
      } else if (error.message.includes('Invalid API key')) {
        throw new Error('Invalid Replicate API key. Please check your configuration.');
      }
      throw error;
    }
    
    throw new Error('Failed to generate video with Replicate');
  }
}

async function generateImage(
  replicate: Replicate, 
  prompt: string, 
  imageData: string
): Promise<string> {
  try {
    // Upload image to Replicate first
    console.log('Uploading image to Replicate...');
    const imageUrl = await uploadToReplicate(imageData);

    // Run image-to-image generation model
    console.log('Running image generation model...');
    const output = await replicate.run(
      "stability-ai/stable-diffusion-3",
      {
        input: {
          image: imageUrl,
          prompt: prompt,
          negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, logo",
          strength: 0.4, // How much to transform the original image
          num_inference_steps: 30,
          guidance_scale: 7.5,
          output_format: "png",
          output_quality: 90
        }
      }
    );

    if (!output) {
      throw new Error('Received empty response from Replicate API');
    }

    // Handle different output formats
    let imageUrl: string;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0];
    } else if (typeof output === 'string') {
      imageUrl = output;
    } else {
      console.error('Unexpected image output format:', typeof output, output);
      throw new Error('Invalid image response format from Replicate API');
    }

    if (!imageUrl.startsWith('http')) {
      throw new Error('Invalid image URL from Replicate API');
    }

    // Download the generated image
    console.log('Downloading generated image...');
    const response = await retryFetch(imageUrl, {});
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const imageBlob = await response.blob();
    if (imageBlob.size === 0) {
      throw new Error('Received empty image file');
    }

    // Convert blob to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert image to data URL'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read image blob'));
      reader.readAsDataURL(imageBlob);
    });

  } catch (error) {
    console.error('Image generation error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (error.message.includes('insufficient credits')) {
        throw new Error('Insufficient Replicate credits. Please check your account.');
      } else if (error.message.includes('Invalid API key')) {
        throw new Error('Invalid Replicate API key. Please check your configuration.');
      }
      throw error;
    }
    
    throw new Error('Failed to generate image with Replicate');
  }
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  duration = 5 
}: GenerationOptions): Promise<string> {
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
    throw new Error('Valid Replicate API key not found. Please check your environment variables.');
  }

  try {
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    if (type === 'video') {
      return await generateVideo(replicate, prompt, inputData, duration);
    } else {
      return await generateImage(replicate, prompt, inputData);
    }
  } catch (error) {
    console.error('Replicate API Error:', error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to generate ${type} with Replicate API`);
    }
  }
}