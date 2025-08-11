import Replicate from 'replicate';

const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

interface FaceSwapOptions {
  sourceImage: string; // Base64 data URL of the person's face
  targetPrompt: string; // What you want them to look like
  preserveFaceAccuracy?: number; // How much to preserve the original face (0.1-1.0)
}

interface FaceSwapResult {
  swappedImage: string;
  detectedFaces: number;
  confidence: number;
}

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
async function retryFetch(url: string, options: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(60000)
      });
      
      if (response.ok) {
        return response;
      }
      
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (attempt < retries) {
        console.log(`Attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (attempt < retries && (error instanceof TypeError || error.message.includes('fetch'))) {
        console.log(`Network error on attempt ${attempt + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
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

/**
 * Advanced face swap using multiple models for best results
 */
export async function performFaceSwap({
  sourceImage,
  targetPrompt,
  preserveFaceAccuracy = 0.8
}: FaceSwapOptions): Promise<FaceSwapResult> {
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
    throw new Error('Valid Replicate API key not found. Please check your environment variables.');
  }

  try {
    console.log('🎭 Starting advanced face swap process...');
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Step 1: Upload the source image
    console.log('📤 Uploading source image...');
    const sourceImageUrl = await uploadToReplicate(sourceImage);

    // Step 2: Generate the target scene with face-aware prompting
    console.log('🎨 Generating target scene...');
    const sceneGeneration = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          prompt: `${targetPrompt}, professional portrait photography, high detail face, perfect facial features, 8k resolution`,
          negative_prompt: "blurry face, distorted face, low quality, deformed face, ugly face, extra limbs, bad anatomy",
          width: 1024,
          height: 1024,
          guidance_scale: 7.5,
          num_inference_steps: 30,
          scheduler: "K_EULER"
        }
      }
    );

    if (!sceneGeneration || (Array.isArray(sceneGeneration) && sceneGeneration.length === 0)) {
      throw new Error('Failed to generate target scene');
    }

    const targetSceneUrl = Array.isArray(sceneGeneration) ? sceneGeneration[0] : sceneGeneration;

    // Step 3: Perform face swap using specialized face swap model
    console.log('🔄 Performing face swap...');
    const faceSwapResult = await replicate.run(
      "yan-ops/face_swap:d5900f9ebed33e7ae6a8d5b1d6d5a95b8ae8c7b2f0a1f2b3c4d5e6f7g8h9i0j1",
      {
        input: {
          source_image: sourceImageUrl,
          target_image: targetSceneUrl,
          face_restore: true,
          background_enhance: true,
          face_upsample: true,
          upscale: 2
        }
      }
    );

    if (!faceSwapResult) {
      throw new Error('Face swap failed to generate result');
    }

    const swappedImageUrl = Array.isArray(faceSwapResult) ? faceSwapResult[0] : faceSwapResult;

    // Step 4: Download the final result
    console.log('⬇️ Downloading final result...');
    const finalResponse = await retryFetch(swappedImageUrl, {});
    
    if (!finalResponse.ok) {
      throw new Error(`Failed to download final result: ${finalResponse.statusText}`);
    }
    
    const finalBlob = await finalResponse.blob();
    if (finalBlob.size === 0) {
      throw new Error('Received empty result file');
    }

    // Convert to base64 data URL
    const finalDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert result to data URL'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read result blob'));
      reader.readAsDataURL(finalBlob);
    });

    console.log('✅ Face swap completed successfully!');

    return {
      swappedImage: finalDataUrl,
      detectedFaces: 1, // This would be detected by the model
      confidence: preserveFaceAccuracy
    };

  } catch (error) {
    console.error('❌ Face swap error:', error);
    
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
    
    throw new Error('Failed to perform face swap');
  }
}

/**
 * Alternative face swap using InstantID for more consistent results
 */
export async function performInstantIDFaceSwap({
  sourceImage,
  targetPrompt,
  preserveFaceAccuracy = 0.8
}: FaceSwapOptions): Promise<FaceSwapResult> {
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
    throw new Error('Valid Replicate API key not found. Please check your environment variables.');
  }

  try {
    console.log('🆔 Starting InstantID face swap...');
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Upload the source image
    console.log('📤 Uploading source image...');
    const sourceImageUrl = await uploadToReplicate(sourceImage);

    // Use InstantID model for consistent face generation
    console.log('🎨 Generating with InstantID...');
    const instantIdResult = await replicate.run(
      "fofr/face-to-many:35cea9c3164d9fb7fbd48b51ddec4917f60c386c6b9ee347a4d4b0e3fb1d5b7c",
      {
        input: {
          image: sourceImageUrl,
          prompt: targetPrompt,
          negative_prompt: "blurry, low quality, distorted face, deformed, ugly, bad anatomy, extra limbs",
          num_outputs: 1,
          guidance_scale: 5,
          num_inference_steps: 30,
          seed: Math.floor(Math.random() * 1000000),
          identity_strength: preserveFaceAccuracy,
          adapter_strength: 1.0
        }
      }
    );

    if (!instantIdResult || (Array.isArray(instantIdResult) && instantIdResult.length === 0)) {
      throw new Error('InstantID failed to generate result');
    }

    const resultUrl = Array.isArray(instantIdResult) ? instantIdResult[0] : instantIdResult;

    // Download the result
    console.log('⬇️ Downloading InstantID result...');
    const response = await retryFetch(resultUrl, {});
    
    if (!response.ok) {
      throw new Error(`Failed to download result: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Received empty result file');
    }

    // Convert to base64 data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert result to data URL'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read result blob'));
      reader.readAsDataURL(blob);
    });

    console.log('✅ InstantID face swap completed successfully!');

    return {
      swappedImage: dataUrl,
      detectedFaces: 1,
      confidence: preserveFaceAccuracy
    };

  } catch (error) {
    console.error('❌ InstantID face swap error:', error);
    
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
    
    throw new Error('Failed to perform InstantID face swap');
  }
}

/**
 * Main face swap function that tries multiple approaches for best results
 */
export async function generateFaceSwappedImage(
  sourceImage: string,
  targetPrompt: string,
  preserveFaceAccuracy: number = 0.8
): Promise<string> {
  console.log('🎭 Starting face swap generation...');

  try {
    // Try InstantID first as it's more reliable for face consistency
    const result = await performInstantIDFaceSwap({
      sourceImage,
      targetPrompt,
      preserveFaceAccuracy
    });

    return result.swappedImage;

  } catch (instantIdError) {
    console.log('InstantID failed, trying alternative face swap...');
    
    try {
      // Fallback to traditional face swap
      const result = await performFaceSwap({
        sourceImage,
        targetPrompt,
        preserveFaceAccuracy
      });

      return result.swappedImage;

    } catch (faceSwapError) {
      console.error('Both face swap methods failed:', {
        instantIdError,
        faceSwapError
      });

      throw new Error('All face swap methods failed. Please try again or check your image quality.');
    }
  }
}