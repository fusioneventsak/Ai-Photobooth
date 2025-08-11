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

export async function generateWithReplicate({ prompt, inputData, type, duration = 5 }: GenerationOptions): Promise<string> {
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
      throw new Error(`Failed to generate ${type} with Replicate. Please try again later.`);
    }
  }
}

// Helper function to retry fetch operations
async function retryFetch(url: string, options: RequestInit, maxRetries = MAX_RETRIES): Promise<Response> {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        // Add a cache buster to prevent caching issues
        headers: {
          ...options.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // If it's a network error or server error, retry
      if (!response.ok && (response.status === 0 || response.status >= 500)) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      // Don't retry client errors
      if (error instanceof Error) {
        const statusMatch = error.message.match(/(\d{3})/); // Extract status code if present
        if (statusMatch) {
          const status = parseInt(statusMatch[1], 10);
          if (status >= 400 && status < 500) {
            throw error; // Don't retry client errors
          }
        }
      }
      
      // If we've exhausted our retries, throw the last error
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff delay
      const delay = RETRY_DELAY * Math.pow(2, attempt);
      console.log(`Retry fetch attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

async function generateVideo(replicate: Replicate, prompt: string, videoData: string, duration: number): Promise<string> {
  // For Replicate we need to convert the base64 video data to a File object
  // that can be uploaded via fetch
  let blob: Blob;
  try {
    blob = dataURItoBlob(videoData);
    if (blob.size === 0) {
      throw new Error('Created empty blob from video data');
    }
  } catch (error) {
    console.error('Error converting video data to blob:', error);
    throw new Error('Failed to process video data. Please try recording again.');
  }
  
  const file = new File([blob], 'input.webm', { type: 'video/webm' });
  
  try {
    // Get the upload URL from Replicate
    console.log('Getting upload URL from Replicate...');
    const uploadResponse = await retryFetch('https://api.replicate.com/v1/uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ purpose: 'input' })
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to get upload URL (${uploadResponse.status}): ${errorText}`);
    }
    
    const uploadData = await uploadResponse.json();
    if (!uploadData || !uploadData.upload_url || !uploadData.serving_url) {
      console.error('Invalid upload data response:', uploadData);
      throw new Error('Invalid response from Replicate upload API');
    }
    
    // Upload the file to the URL provided by Replicate
    console.log('Uploading video file to Replicate...');
    const uploadFileResponse = await retryFetch(uploadData.upload_url, {
      method: 'PUT',
      body: file
    });
    
    if (!uploadFileResponse.ok) {
      throw new Error(`Failed to upload video file (${uploadFileResponse.status}): ${uploadFileResponse.statusText}`);
    }
    
    // Now run the video-to-video model using the uploaded file
    console.log('Starting video generation with Replicate...');
    let output;
    try {
      output = await replicate.run(
        "stability-ai/stable-video-diffusion:3d0d3610da454c1fa31e0d07a2049152c30f75b58da9b39686de2843ab4ba923",
        {
          input: {
            video: uploadData.serving_url,
            prompt: prompt,
            video_length: duration,
            fps: 24,
            sizing_strategy: "maintain_aspect_ratio",
            motion_bucket_id: 127,
            frames: duration * 24,
            seed: Math.floor(Math.random() * 2147483647)
          }
        }
      );
    } catch (error) {
      console.error('Replicate model run error:', error);
      if (error instanceof Error && error.message.includes('failed')) {
        throw new Error('Replicate model run failed. The service may be temporarily unavailable. Please try again later.');
      }
      throw error;
    }

    if (!output) {
      throw new Error('Received empty response from Replicate API');
    }

    if (typeof output !== 'string') {
      console.error('Unexpected output type from Replicate:', typeof output, output);
      throw new Error('Invalid response format from Replicate API');
    }

    // Download the video from the returned URL
    console.log('Downloading generated video...');
    const response = await retryFetch(output, {});
    if (!response.ok) {
      throw new Error(`Failed to download video (${response.status}): ${response.statusText}`);
    }
    
    const videoBlob = await response.blob();
    if (videoBlob.size === 0) {
      throw new Error('Received empty video file from Replicate');
    }
    
    return URL.createObjectURL(videoBlob);
  } catch (error) {
    console.error('Video generation error:', error);
    // Rethrow the error to be handled by the caller
    throw error;
  }
}

async function generateImage(replicate: Replicate, prompt: string, imageData: string): Promise<string> {
  // For Replicate we need to convert the base64 image data to a File object
  // that can be uploaded via fetch
  let blob: Blob;
  try {
    blob = dataURItoBlob(imageData);
    if (blob.size === 0) {
      throw new Error('Created empty blob from image data');
    }
  } catch (error) {
    console.error('Error converting image data to blob:', error);
    throw new Error('Failed to process image data. Please try capturing again.');
  }
  
  const file = new File([blob], 'input.jpg', { type: 'image/jpeg' });
  
  try {
    // Get the upload URL from Replicate
    console.log('Getting upload URL from Replicate...');
    const uploadResponse = await retryFetch('https://api.replicate.com/v1/uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ purpose: 'input' })
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to get upload URL (${uploadResponse.status}): ${errorText}`);
    }
    
    const uploadData = await uploadResponse.json();
    if (!uploadData || !uploadData.upload_url || !uploadData.serving_url) {
      console.error('Invalid upload data response:', uploadData);
      throw new Error('Invalid response from Replicate upload API');
    }
    
    // Upload the file to the URL provided by Replicate
    console.log('Uploading image file to Replicate...');
    const uploadFileResponse = await retryFetch(uploadData.upload_url, {
      method: 'PUT',
      body: file
    });
    
    if (!uploadFileResponse.ok) {
      throw new Error(`Failed to upload image file (${uploadFileResponse.status}): ${uploadFileResponse.statusText}`);
    }
    
    // Run the image-to-image model using the uploaded file
    console.log('Starting image generation with Replicate...');
    let output;
    try {
      output = await replicate.run(
        "stability-ai/sdxl:1bfb924045802467cf8869d31ec7c3a3105683a3868f13426becc97eca71d442",
        {
          input: {
            image: uploadData.serving_url,
            prompt: prompt,
            strength: 0.35,
            guidance_scale: 7.5,
            num_inference_steps: 25,
            negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy"
          }
        }
      );
    } catch (error) {
      console.error('Replicate model run error:', error);
      if (error instanceof Error && error.message.includes('failed')) {
        throw new Error('Replicate model run failed. The service may be temporarily unavailable. Please try again later.');
      }
      throw error;
    }

    if (!output) {
      throw new Error('Received empty response from Replicate API');
    }

    // Check output format
    if (!Array.isArray(output) || output.length === 0) {
      console.error('Unexpected output format from Replicate:', output);
      throw new Error('Invalid response format from Replicate API');
    }

    // Get the first output image URL
    const outputUrl = output[0];
    if (typeof outputUrl !== 'string' || !outputUrl.startsWith('http')) {
      console.error('Invalid image URL from Replicate:', outputUrl);
      throw new Error('Invalid image URL received from Replicate');
    }

    // Download the image from the returned URL
    console.log('Downloading generated image...');
    const response = await retryFetch(outputUrl, {});
    if (!response.ok) {
      throw new Error(`Failed to download image (${response.status}): ${response.statusText}`);
    }
    
    const imageBlob = await response.blob();
    if (imageBlob.size === 0) {
      throw new Error('Received empty image file from Replicate');
    }
    
    return URL.createObjectURL(imageBlob);
  } catch (error) {
    console.error('Image generation error:', error);
    // Rethrow the error to be handled by the caller
    throw error;
  }
}

// Helper function to convert a data URI to a Blob
function dataURItoBlob(dataURI: string): Blob {
  try {
    // Validate data URI format
    if (!dataURI || typeof dataURI !== 'string') {
      throw new Error('Invalid data URI: empty or not a string');
    }
    
    // Split the data URI to get the base64 data
    const splitDataURI = dataURI.split(',');
    if (splitDataURI.length !== 2) {
      throw new Error('Invalid data URI format: missing comma separator');
    }
    
    // Validate mime type
    const mimeTypeMatch = splitDataURI[0].match(/:(.*?);/);
    if (!mimeTypeMatch) {
      throw new Error('Invalid data URI format: cannot extract MIME type');
    }
    const mimeString = mimeTypeMatch[1];
    
    const base64Data = splitDataURI[1];
    if (!base64Data) {
      throw new Error('Invalid data URI: missing base64 data');
    }
    
    let byteString: string;
    try {
      byteString = atob(base64Data);
    } catch (e) {
      throw new Error('Failed to decode base64 data: ' + (e instanceof Error ? e.message : String(e)));
    }
    
    if (byteString.length === 0) {
      throw new Error('Decoded base64 data is empty');
    }
    
    // Write the bytes of the string to an ArrayBuffer
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    // Create a Blob with the ArrayBuffer and the appropriate MIME type
    return new Blob([ab], { type: mimeString });
  } catch (error) {
    console.error('Error in dataURItoBlob:', error);
    throw error;
  }
}