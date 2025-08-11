import axios from 'axios';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;

export async function generateImage(
  prompt: string, 
  originalContent: string,
  modelType: 'image' | 'video' = 'image',
  videoDuration: number = 5,
  preserveFace: boolean = true
): Promise<string> {
  console.log('🎯 Using face-preserving image-to-image transformation');

  // Input validation
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty for generation');
  }

  if (!originalContent?.startsWith('data:image/')) {
    throw new Error('Invalid image format. Please provide a valid image.');
  }

  if (modelType === 'video') {
    throw new Error('Video generation temporarily disabled. Please use image generation.');
  }

  if (!STABILITY_API_KEY || STABILITY_API_KEY.includes('undefined')) {
    throw new Error('Stability AI API key not found. Please check your .env file and make sure VITE_STABILITY_API_KEY is set.');
  }

  try {
    if (preserveFace) {
      return await generateWithFacePreservation(prompt, originalContent);
    } else {
      return await generateWithImageToImage(prompt, originalContent);
    }
  } catch (error) {
    console.error('Face-preserving generation failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate image with face preservation');
  }
}

async function generateWithFacePreservation(prompt: string, originalContent: string): Promise<string> {
  try {
    console.log('🎭 Generating with face preservation using image-to-image...');
    
    // Convert base64 to blob
    const base64Data = originalContent.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const imageBlob = new Blob([byteArray], { type: 'image/png' });

    // Create form data
    const formData = new FormData();
    formData.append('image', imageBlob, 'image.png');
    formData.append('prompt', enhancePromptForFacePreservation(prompt));
    formData.append('negative_prompt', 'deformed face, distorted features, different person, face swap, changed identity, blurry face, extra faces, multiple people');
    formData.append('strength', '0.3'); // Lower strength preserves more of the original
    formData.append('cfg_scale', '7'); // Moderate adherence to prompt
    formData.append('output_format', 'png');

    console.log('Enhanced prompt:', enhancePromptForFacePreservation(prompt));
    console.log('Using strength: 0.3 for maximum face preservation');

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/generate/sd3',
      formData,
      {
        headers: {
          Accept: 'image/*',
          Authorization: `Bearer ${STABILITY_API_KEY}`,
        },
        responseType: 'arraybuffer',
        timeout: 120000
      }
    );

    if (!response?.data) {
      throw new Error('Empty response from Stability AI');
    }

    // Convert arraybuffer to base64
    const arrayBuffer = response.data;
    const base64String = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:image/png;base64,${base64String}`;

  } catch (error) {
    console.error('Face preservation failed:', error);
    
    // Fallback to inpainting approach
    console.log('🔄 Falling back to inpainting approach...');
    return await generateWithInpainting(prompt, originalContent);
  }
}

async function generateWithInpainting(prompt: string, originalContent: string): Promise<string> {
  try {
    console.log('🎨 Using inpainting to preserve face while changing background/clothing...');
    
    // Step 1: Create a face mask automatically
    const faceMask = await createFaceMask(originalContent);
    
    // Step 2: Use inpainting to modify everything EXCEPT the masked face area
    return await inpaintAroundFace(prompt, originalContent, faceMask);
    
  } catch (error) {
    console.error('Inpainting approach failed:', error);
    // Final fallback to regular image-to-image with very low strength
    return await generateWithImageToImage(prompt, originalContent, 0.25);
  }
}

async function createFaceMask(originalContent: string): Promise<string> {
  // Create a simple oval mask for the face area
  // In production, you'd use face detection libraries like face-api.js
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        // Create black background (areas to preserve)
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Create white oval for face area (areas to inpaint)
        ctx.fillStyle = 'white';
        ctx.save();
        
        // Assume face is in the upper-center portion
        const faceWidth = canvas.width * 0.6;
        const faceHeight = canvas.height * 0.7;
        const faceX = (canvas.width - faceWidth) / 2;
        const faceY = canvas.height * 0.1;

        ctx.beginPath();
        ctx.ellipse(
          canvas.width / 2,    // center x
          faceY + faceHeight / 3, // center y (upper third)
          faceWidth / 2,       // radius x
          faceHeight / 3,      // radius y (smaller vertical radius for face)
          0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        const result = canvas.toDataURL('image/png');
        resolve(result);
      };

      img.onerror = () => reject(new Error('Failed to load image for mask creation'));
      img.src = originalContent;

    } catch (error) {
      reject(new Error('Failed to create face mask'));
    }
  });
}

async function inpaintAroundFace(prompt: string, originalContent: string, maskContent: string): Promise<string> {
  try {
    console.log('🖌️ Inpainting around face area...');
    
    // Convert base64 images to blobs
    const originalBlob = base64ToBlob(originalContent);
    const maskBlob = base64ToBlob(maskContent);

    const formData = new FormData();
    formData.append('image', originalBlob, 'original.png');
    formData.append('mask', maskBlob, 'mask.png');
    formData.append('prompt', `${prompt}, maintain existing face and head exactly as shown`);
    formData.append('negative_prompt', 'face changes, different person, facial distortions, head modifications');
    formData.append('strength', '0.8'); // Higher strength for background/clothing changes
    formData.append('cfg_scale', '8');
    formData.append('output_format', 'png');

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/edit/inpaint',
      formData,
      {
        headers: {
          Accept: 'image/*',
          Authorization: `Bearer ${STABILITY_API_KEY}`,
        },
        responseType: 'arraybuffer',
        timeout: 120000
      }
    );

    if (!response?.data) {
      throw new Error('Empty response from Stability AI inpaint');
    }

    const arrayBuffer = response.data;
    const base64String = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:image/png;base64,${base64String}`;

  } catch (error) {
    console.error('Inpainting failed:', error);
    throw new Error('Failed to inpaint around face area');
  }
}

async function generateWithImageToImage(prompt: string, originalContent: string, strength: number = 0.5): Promise<string> {
  try {
    console.log(`🔄 Using image-to-image with strength ${strength}...`);
    
    const imageBlob = base64ToBlob(originalContent);

    const formData = new FormData();
    formData.append('image', imageBlob, 'image.png');
    formData.append('prompt', prompt);
    formData.append('negative_prompt', 'deformed face, different person, face distortions');
    formData.append('strength', strength.toString());
    formData.append('cfg_scale', '7');
    formData.append('output_format', 'png');

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/generate/sd3',
      formData,
      {
        headers: {
          Accept: 'image/*',
          Authorization: `Bearer ${STABILITY_API_KEY}`,
        },
        responseType: 'arraybuffer',
        timeout: 120000
      }
    );

    if (!response?.data) {
      throw new Error('Empty response from Stability AI');
    }

    const arrayBuffer = response.data;
    const base64String = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    return `data:image/png;base64,${base64String}`;

  } catch (error) {
    console.error('Image-to-image generation failed:', error);
    throw new Error('Failed to generate with image-to-image');
  }
}

function enhancePromptForFacePreservation(originalPrompt: string): string {
  return `${originalPrompt}, keep the exact same person and facial features, preserve identity, same face and expressions, only change background and clothing, maintain facial structure`;
}

function base64ToBlob(base64Data: string): Blob {
  const base64String = base64Data.split(',')[1];
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/png' });
}