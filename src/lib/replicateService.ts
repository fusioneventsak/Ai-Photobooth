import Replicate from 'replicate';

const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'image' | 'video';
  duration?: number;
  preserveFace?: boolean;
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
        signal: AbortSignal.timeout(120000) // 2 minute timeout for video downloads
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
    const file = new File([blob], 'input.png', { type: 'image/png' });

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

    // Upload the file with proper headers
    const uploadResult = await retryFetch(uploadData.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png'
      },
      body: file
    });

    if (!uploadResult.ok) {
      throw new Error(`Failed to upload file: ${uploadResult.statusText}`);
    }

    // Wait a moment for upload processing
    await new Promise(resolve => setTimeout(resolve, 1000));

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
  duration: number = 5,
  preserveFace: boolean = true
): Promise<string> {
  try {
    // Upload image to Replicate first
    console.log('🔄 Uploading image to Replicate...');
    const imageUrl = await uploadToReplicate(imageData);

    // Enhanced prompt based on preservation mode
    let enhancedPrompt = prompt;
    if (preserveFace) {
      enhancedPrompt = `${prompt}, maintain the person's exact facial features and identity, smooth natural movement, high quality video, photorealistic`;
    } else {
      enhancedPrompt = `${prompt}, smooth natural movement, cinematic motion, high quality video, photorealistic`;
    }

    console.log('🎬 Running state-of-the-art video generation model...');
    
    // Try Mochi 1 first (best quality, open-source)
    try {
      const output = await replicate.run(
        "genmoai/mochi-1-preview:394a2937d4f2d0d5071a6b0bdeafe3fe9e3fa99492c165e7edaf89cf79b45b75",
        {
          input: {
            image: imageUrl,
            prompt: enhancedPrompt,
            num_inference_steps: 64,
            guidance_scale: 4.5,
            fps: 30,
            num_frames: Math.min(162, Math.max(25, duration * 30)), // 5.4 seconds max at 30fps
            seed: Math.floor(Math.random() * 2147483647)
          }
        }
      );

      if (output && typeof output === 'string' && output.startsWith('http')) {
        console.log('✅ Mochi 1 generation successful');
        return await downloadVideo(output);
      }
    } catch (mochiError) {
      console.log('⚠️ Mochi 1 unavailable, trying LTX-Video...');
    }

    // Fallback to LTX-Video (ultra-fast)
    try {
      const output = await replicate.run(
        "lightricks/ltx-video:82b7d0d09c04bb4a6e00e48db6c60a6e32bc78e78b2b5b3df6ebc0bc6b0d48cb",
        {
          input: {
            image: imageUrl,
            prompt: enhancedPrompt,
            negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, logo, static image, no movement",
            num_inference_steps: 25,
            guidance_scale: 3.0,
            fps: 24,
            frame_rate: 24,
            width: 768,
            height: 512,
            seed: Math.floor(Math.random() * 2147483647)
          }
        }
      );

      if (output && typeof output === 'string' && output.startsWith('http')) {
        console.log('✅ LTX-Video generation successful');
        return await downloadVideo(output);
      }
    } catch (ltxError) {
      console.log('⚠️ LTX-Video unavailable, trying Stable Video Diffusion...');
    }

    // Final fallback to Stable Video Diffusion
    const output = await replicate.run(
      "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb1a4c069b4bb91bc25be5667a0b525e63c21e2257",
      {
        input: {
          cond_aug: 0.02,
          decoding_t: 14,
          video_length: "14_frames_with_svd",
          sizing_strategy: "maintain_aspect_ratio",
          motion_bucket_id: 127,
          frames_per_second: 6,
          image: imageUrl
        }
      }
    );

    if (!output || typeof output !== 'string' || !output.startsWith('http')) {
      throw new Error('All video generation models failed or returned invalid output');
    }

    console.log('✅ Stable Video Diffusion generation successful');
    return await downloadVideo(output);

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
  imageData: string,
  preserveFace: boolean = true
): Promise<string> {
  try {
    // Upload image to Replicate first
    console.log('🔄 Uploading image to Replicate...');
    const imageUrl = await uploadToReplicate(imageData);

    // Enhanced prompt for better results
    let enhancedPrompt = prompt;
    let negativePrompt = "blurry, low quality, distorted, deformed, ugly, bad anatomy, watermark, text, logo";
    
    if (preserveFace) {
      enhancedPrompt = `${prompt}, preserve the person's exact facial features and identity, keep same face, transform background and clothing, high quality, photorealistic`;
      negativePrompt = "different person, changed face, face swap, different identity, " + negativePrompt;
    }

    console.log('🎨 Running advanced image generation model...');
    
    // Try FLUX.1 Schnell first (fastest, high quality)
    try {
      const output = await replicate.run(
        "black-forest-labs/flux-schnell:bf2f717ca755455c3a0b80a3c0dbfbc1c3f2b79b18b9a60e1b02cbed0b8f8c33",
        {
          input: {
            image: imageUrl,
            prompt: enhancedPrompt,
            strength: preserveFace ? 0.5 : 0.7,
            num_inference_steps: 4, // Very fast
            guidance_scale: 0, // FLUX Schnell doesn't use guidance
            output_format: "png",
            output_quality: 95,
            seed: Math.floor(Math.random() * 2147483647)
          }
        }
      );

      if (output && Array.isArray(output) && output.length > 0) {
        console.log('✅ FLUX Schnell generation successful');
        return await downloadImage(output[0]);
      }
    } catch (fluxError) {
      console.log('⚠️ FLUX Schnell unavailable, trying SDXL...');
    }

    // Fallback to SDXL
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          image: imageUrl,
          prompt: enhancedPrompt,
          negative_prompt: negativePrompt,
          strength: preserveFace ? 0.4 : 0.6,
          num_inference_steps: 25,
          guidance_scale: 7.5,
          output_format: "png",
          output_quality: 95,
          seed: Math.floor(Math.random() * 2147483647)
        }
      }
    );

    if (!output || !Array.isArray(output) || output.length === 0) {
      throw new Error('Received empty response from image generation models');
    }

    console.log('✅ SDXL generation successful');
    return await downloadImage(output[0]);

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

// Download video and create blob URL
async function downloadVideo(videoUrl: string): Promise<string> {
  console.log('⬇️ Downloading generated video...');
  const response = await retryFetch(videoUrl, {});
  
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }
  
  const videoBlob = await response.blob();
  if (videoBlob.size === 0) {
    throw new Error('Received empty video file');
  }
  
  return URL.createObjectURL(videoBlob);
}

// Download image and convert to base64
async function downloadImage(imageUrl: string): Promise<string> {
  console.log('⬇️ Downloading generated image...');
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
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  duration = 5,
  preserveFace = true
}: GenerationOptions): Promise<string> {
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
    throw new Error('Valid Replicate API key not found. Please check your environment variables.');
  }

  try {
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    if (type === 'video') {
      return await generateVideo(replicate, prompt, inputData, duration, preserveFace);
    } else {
      return await generateImage(replicate, prompt, inputData, preserveFace);
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