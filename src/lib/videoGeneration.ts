import Replicate from 'replicate';

const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

interface VideoGenerationOptions {
  prompt: string;
  videoData: string;
  duration?: number;
}

// Maximum number of retries for fetch operations
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // milliseconds

export async function generateVideoWithReplicate({ prompt, videoData, duration = 5 }: VideoGenerationOptions): Promise<string> {
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
    throw new Error('Valid Replicate API key not found. Please check your environment variables.');
  }

  try {
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Convert base64 video to blob for upload
    const base64Data = videoData.split(',')[1];
    if (!base64Data || base64Data.trim() === '') {
      throw new Error('Invalid video data. Please try recording again.');
    }
    
    let byteCharacters;
    try {
      byteCharacters = atob(base64Data);
    } catch (e) {
      console.error('Error decoding base64 data:', e);
      throw new Error('Failed to decode video data. Please try recording again.');
    }
    
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    if (byteArray.length === 0) {
      throw new Error('Empty video data. Please try recording again.');
    }
    
    const blob = new Blob([byteArray], { type: 'video/webm' });
    if (blob.size === 0) {
      throw new Error('Created empty video blob. Please try recording again.');
    }
    
    if (blob.size > 50 * 1024 * 1024) { // 50MB limit
      throw new Error('Video size too large. Please record a shorter video.');
    }
    
    const file = new File([blob], 'input.webm', { type: 'video/webm' });
    
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
    console.error('Replicate API Error:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to generate video with Replicate. Please try again later.');
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