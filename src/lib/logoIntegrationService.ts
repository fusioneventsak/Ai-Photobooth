import Replicate from 'replicate';

const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

// Maximum number of retries for fetch operations
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // milliseconds

interface LogoIntegrationOptions {
  logoImage: string | File; // URL or File object
  logoDescription: string;
  destinationPrompt: string;
}

export async function integrateLogoWithReplicate({
  logoImage,
  logoDescription,
  destinationPrompt
}: LogoIntegrationOptions): Promise<string> {
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
    throw new Error('Valid Replicate API key not found. Please check your environment variables.');
  }

  try {
    console.log('Starting logo integration with Replicate...');
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Process the logo image - could be a URL, base64 string, or File
    let logoUrl: string;
    
    if (typeof logoImage === 'string') {
      // If it's a data URL, we need to upload it to Replicate
      if (logoImage.startsWith('data:')) {
        console.log('Converting data URL to file...');
        const file = await dataURLtoFile(logoImage, 'logo.png');
        logoUrl = await uploadFileToReplicate(file);
      } else {
        // It's already a URL
        logoUrl = logoImage;
      }
    } else {
      // It's a File object
      logoUrl = await uploadFileToReplicate(logoImage);
    }

    // Run the model
    console.log('Running Flux-in-Context model...');
    let output;
    try {
      output = await replicate.run(
        "lucataco/flux-in-context:703f38c44b9c2820b79b54f96ef5f6554240b3ec4035a0cf80ba04e1f87ae307",
        {
          input: {
            logo_image: logoUrl,
            logo_description: logoDescription,
            destination_prompt: destinationPrompt
          }
        }
      );
    } catch (error) {
      console.error('Replicate model run error:', error);
      if (error instanceof Error && error.message.includes('failed')) {
        throw new Error('Logo integration failed. The service may be temporarily unavailable. Please try again later.');
      }
      throw error;
    }

    if (!output) {
      throw new Error('Received empty response from Replicate API');
    }

    // The output should be a URL to the generated image
    console.log('Received output from Replicate:', typeof output);
    
    if (typeof output !== 'string' || !output.startsWith('http')) {
      console.error('Unexpected output format:', output);
      throw new Error('Invalid output format from Replicate. Expected an image URL.');
    }

    // Download the image
    console.log('Downloading generated image...');
    const response = await retryFetch(output, {});
    if (!response.ok) {
      throw new Error(`Failed to download image (${response.status}): ${response.statusText}`);
    }
    
    const imageBlob = await response.blob();
    if (imageBlob.size === 0) {
      throw new Error('Received empty image file from Replicate');
    }
    
    return URL.createObjectURL(imageBlob);
  } catch (error) {
    console.error('Logo Integration Error:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to integrate logo. Please try again later.');
    }
  }
}

// Helper function to upload a file to Replicate and get a URL
async function uploadFileToReplicate(file: File): Promise<string> {
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
  console.log('Uploading file to Replicate...');
  const uploadFileResponse = await retryFetch(uploadData.upload_url, {
    method: 'PUT',
    body: file
  });
  
  if (!uploadFileResponse.ok) {
    throw new Error(`Failed to upload file (${uploadFileResponse.status}): ${uploadFileResponse.statusText}`);
  }
  
  return uploadData.serving_url;
}

// Helper function to convert data URL to File
async function dataURLtoFile(dataURL: string, filename: string): Promise<File> {
  const arr = dataURL.split(',');
  if (arr.length !== 2) {
    throw new Error('Invalid data URL format');
  }
  
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) {
    throw new Error('Could not determine MIME type from data URL');
  }
  
  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
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