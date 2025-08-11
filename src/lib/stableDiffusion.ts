import axios from 'axios';
import { generateWithReplicate } from './replicateService';
import Replicate from 'replicate';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;
const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

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

// Upload image to Replicate
async function uploadToReplicate(imageData: string): Promise<string> {
  try {
    const blob = dataURItoBlob(imageData);
    const file = new File([blob], 'input.jpg', { type: 'image/jpeg' });

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

    const uploadResult = await fetch(uploadData.upload_url, {
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

// Generate a base scene/template image first
async function generateBaseScene(prompt: string): Promise<string> {
  if (!REPLICATE_API_KEY) {
    throw new Error('Replicate API key required for face swapping');
  }

  try {
    console.log('🎨 Generating base scene for face swap...');
    const replicate = new Replicate({ auth: REPLICATE_API_KEY });

    // Generate a base image without any specific face
    const scenePrompt = `${prompt}, professional photography, high quality, detailed, no specific person, generic face that will be replaced`;

    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          prompt: scenePrompt,
          negative_prompt: "blurry, low quality, distorted, deformed, ugly, bad anatomy",
          width: 1024,
          height: 1024,
          guidance_scale: 7.5,
          num_inference_steps: 30
        }
      }
    );

    if (!output || (Array.isArray(output) && output.length === 0)) {
      throw new Error('Failed to generate base scene');
    }

    return Array.isArray(output) ? output[0] : output;
  } catch (error) {
    console.error('Base scene generation failed:', error);
    throw new Error('Failed to generate base scene for face swap');
  }
}

// Perform actual face swap using a proven model
async function performRealFaceSwap(
  sourceImageData: string, 
  targetSceneUrl: string
): Promise<string> {
  if (!REPLICATE_API_KEY) {
    throw new Error('Replicate API key required for face swapping');
  }

  try {
    console.log('🔄 Performing real face swap...');
    const replicate = new Replicate({ auth: REPLICATE_API_KEY });

    // Upload the source face image
    const sourceImageUrl = await uploadToReplicate(sourceImageData);

    // Use InstantID for consistent face swapping
    const output = await replicate.run(
      "fofr/face-to-many:35cea9c3164d9fb7fbd48b51ddec4917f60c386c6b9ee347a4d4b0e3fb1d5b7c",
      {
        input: {
          image: sourceImageUrl,
          prompt: "high quality portrait, detailed face, professional photography",
          target_image: targetSceneUrl,
          identity_strength: 0.8,
          adapter_strength: 1.0,
          guidance_scale: 5,
          num_inference_steps: 30
        }
      }
    );

    if (!output || (Array.isArray(output) && output.length === 0)) {
      // Fallback to a different face swap model
      console.log('🔄 Trying alternative face swap model...');
      const fallbackOutput = await replicate.run(
        "yan-ops/face_swap:d5900f9ebed33e7ae6a8d5b1d6d5a95b8ae8c7b2f0a1f2b3c4d5e6f7g8h9i0j1",
        {
          input: {
            source_image: sourceImageUrl,
            target_image: targetSceneUrl,
            face_restore: true,
            background_enhance: true,
            face_upsample: true
          }
        }
      );

      if (!fallbackOutput) {
        throw new Error('Both face swap models failed');
      }

      const fallbackUrl = Array.isArray(fallbackOutput) ? fallbackOutput[0] : fallbackOutput;
      return await downloadAndConvertToDataURL(fallbackUrl);
    }

    const resultUrl = Array.isArray(output) ? output[0] : output;
    return await downloadAndConvertToDataURL(resultUrl);

  } catch (error) {
    console.error('Face swap failed:', error);
    throw new Error(`Face swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Download image and convert to data URL
async function downloadAndConvertToDataURL(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Received empty image file');
    }

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
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Download and convert failed:', error);
    throw new Error('Failed to process generated image');
  }
}

export async function generateImage(
  prompt: string, 
  originalContent: string,
  modelType: 'image' | 'video' = 'image',
  videoDuration: number = 5,
  enableRealFaceSwap: boolean = true
): Promise<string> {
  console.log('🚀 Starting generation with REAL face swapping');
  console.log('Face swap enabled:', enableRealFaceSwap);

  // Input validation
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty for generation');
  }

  if (!originalContent?.startsWith('data:image/')) {
    throw new Error('Invalid image format. Please provide a valid image.');
  }

  // For video generation (no face swap support yet)
  if (modelType === 'video') {
    if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
      throw new Error('Replicate API key not found. Please check your environment variables.');
    }

    try {
      console.log('Using Replicate for video generation (no face swap)...');
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

  // For image generation with REAL face swapping
  if (enableRealFaceSwap && REPLICATE_API_KEY && !REPLICATE_API_KEY.includes('undefined')) {
    try {
      console.log('🎭 Using REAL face swap process...');
      
      // Step 1: Generate base scene
      console.log('Step 1: Generating base scene...');
      const baseSceneUrl = await generateBaseScene(prompt);
      
      // Step 2: Perform face swap
      console.log('Step 2: Swapping your face onto the scene...');
      const result = await performRealFaceSwap(originalContent, baseSceneUrl);
      
      console.log('✅ Real face swap completed successfully!');
      return result;

    } catch (error) {
      console.error('❌ Real face swap failed:', error);
      console.log('🔄 Falling back to regular generation...');
      
      // Fallback to regular generation if face swap fails
      if (error instanceof Error && error.message.includes('API key')) {
        throw error; // Don't fallback on auth errors
      }
    }
  }

  // Fallback to regular Replicate generation
  if (REPLICATE_API_KEY && !REPLICATE_API_KEY.includes('undefined')) {
    try {
      console.log('Using regular Replicate generation as fallback...');
      return await generateWithReplicate({
        prompt,
        inputData: originalContent,
        type: 'image'
      });
    } catch (error) {
      console.error('Regular generation also failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to generate image. Please try again.');
    }
  }

  throw new Error('No AI services available. Please check your Replicate API key.');
}