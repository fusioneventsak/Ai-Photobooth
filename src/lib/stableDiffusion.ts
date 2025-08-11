import axiosInstance from './axiosConfig';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;

export async function generateImage(
  prompt: string, 
  originalContent: string,
  modelType: 'image' | 'video' = 'image',
  videoDuration: number = 5,
  preserveFace: boolean = true,
  facePreservationMode: 'preserve_face' | 'replace_face' = 'preserve_face'
): Promise<string> {
  console.log(`🎯 Using ${facePreservationMode} mode for image transformation`);

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
    if (facePreservationMode === 'preserve_face') {
      return await generateWithFacePreservation(prompt, originalContent);
    } else {
      return await generateWithFaceReplacement(prompt, originalContent);
    }
  } catch (error) {
    console.error(`${facePreservationMode} generation failed:`, error);
    throw new Error(error instanceof Error ? error.message : `Failed to generate image with ${facePreservationMode}`);
  }
}

async function generateWithFacePreservation(prompt: string, originalContent: string): Promise<string> {
  try {
    console.log('🎭 Preserving face using advanced image-to-image approach...');
    
    // Skip inpainting entirely for now and use a refined image-to-image approach
    // This avoids the circular mask issue completely
    
    const result = await generateWithImageToImage(prompt, originalContent, 0.55, true);
    return result;
    
  } catch (error) {
    console.error('Face preservation failed:', error);
    
    // Fallback to even lower strength
    console.log('🔄 Falling back to minimal transformation...');
    return await generateWithImageToImage(prompt, originalContent, 0.35, true);
  }
}

async function generateWithFaceReplacement(prompt: string, originalContent: string): Promise<string> {
  try {
    console.log('🔄 Replacing face, preserving background/clothing...');
    
    // Step 1: Create a face mask (modify face, protect everything else)
    const faceMask = await createFaceMask(originalContent);
    
    // Step 2: Use inpainting to modify ONLY the face area
    return await inpaintFaceArea(prompt, originalContent, faceMask);
    
  } catch (error) {
    console.error('Face replacement failed:', error);
    
    // Fallback to high-strength image-to-image with face-focused prompts
    console.log('🔄 Falling back to face-focused image-to-image...');
    return await generateWithImageToImage(prompt, originalContent, 0.65, false);
  }
}

async function createInvertedFaceMask(originalContent: string): Promise<string> {
  // Creates a mask where face area is BLACK (preserved) and everything else is WHITE (modified)
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

        // Create white background (areas to modify - everything)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Create a much smaller, more precise black area for just the face
        ctx.fillStyle = 'black';
        ctx.save();
        
        // Much smaller face area - just the core facial features
        const faceWidth = canvas.width * 0.25; // Reduced from 0.4
        const faceHeight = canvas.height * 0.3; // Reduced from 0.45
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.32; // Slightly higher

        // Create a more precise face mask with feathered edges
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, faceWidth / 2);
        gradient.addColorStop(0, 'black');     // Core face - preserve
        gradient.addColorStop(0.7, 'black');   // Still preserve
        gradient.addColorStop(0.9, 'gray');    // Transition zone
        gradient.addColorStop(1, 'white');     // Modify everything else

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY,
          faceWidth / 2,
          faceHeight / 2,
          0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        const result = canvas.toDataURL('image/png');
        resolve(result);
      };

      img.onerror = () => reject(new Error('Failed to load image for inverted mask creation'));
      img.src = originalContent;

    } catch (error) {
      reject(new Error('Failed to create inverted face mask'));
    }
  });
}

async function createFaceMask(originalContent: string): Promise<string> {
  // Creates a mask where face area is WHITE (modified) and everything else is BLACK (preserved)
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

        // Create white oval for face area (areas to modify)
        ctx.fillStyle = 'white';
        ctx.save();
        
        // Face detection area - upper center portion
        const faceWidth = canvas.width * 0.4;
        const faceHeight = canvas.height * 0.45;
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.35; // Upper third for face

        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY,
          faceWidth / 2,
          faceHeight / 2,
          0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        const result = canvas.toDataURL('image/png');
        resolve(result);
      };

      img.onerror = () => reject(new Error('Failed to load image for face mask creation'));
      img.src = originalContent;

    } catch (error) {
      reject(new Error('Failed to create face mask'));
    }
  });
}

async function inpaintAroundFace(prompt: string, originalContent: string, maskContent: string): Promise<string> {
  try {
    console.log('🖌️ Inpainting around face area (preserving minimal face region)...');
    
    const originalBlob = base64ToBlob(originalContent);
    const maskBlob = base64ToBlob(maskContent);

    const formData = new FormData();
    formData.append('image', originalBlob, 'original.png');
    formData.append('mask', maskBlob, 'mask.png');
    formData.append('prompt', `${prompt}, completely transform the background and environment, change all clothing and accessories, only preserve the core facial features`);
    formData.append('negative_prompt', 'preserve original background, keep original clothing, maintain original setting, preserve body, same environment');
    formData.append('strength', '0.95'); // Very high strength for maximum transformation
    formData.append('cfg_scale', '9'); // Higher for better prompt adherence
    formData.append('output_format', 'png');

    const response = await axiosInstance.post(
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
    console.error('Inpainting around face failed:', error);
    throw new Error(`Inpainting around face failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function inpaintFaceArea(prompt: string, originalContent: string, maskContent: string): Promise<string> {
  try {
    console.log('🎭 Inpainting face area (replacing face)...');
    
    const originalBlob = base64ToBlob(originalContent);
    const maskBlob = base64ToBlob(maskContent);

    const formData = new FormData();
    formData.append('image', originalBlob, 'original.png');
    formData.append('mask', maskBlob, 'mask.png');
    formData.append('prompt', `${prompt}, generate new face and head that fits the scene, maintain body and background`);
    formData.append('negative_prompt', 'original face, same person, preserve identity, deformed body');
    formData.append('strength', '0.9'); // Higher strength for face replacement
    formData.append('cfg_scale', '9');
    formData.append('output_format', 'png');

    const response = await axiosInstance.post(
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
    console.error('Inpainting face area failed:', error);
    throw new Error(`Inpainting face area failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateWithImageToImage(
  prompt: string, 
  originalContent: string, 
  strength: number = 0.5, 
  preserveFace: boolean = true
): Promise<string> {
  try {
    console.log(`🔄 Using image-to-image with strength ${strength} (preserve face: ${preserveFace})...`);
    
    const imageBlob = base64ToBlob(originalContent);
    
    let enhancedPrompt = prompt;
    let negativePrompt = 'blurry, low quality, distorted';
    
    if (preserveFace) {
      enhancedPrompt = `${prompt}, keep the exact same person, same facial features, same face shape, same eyes, same nose, same mouth, preserve facial identity completely, transform background completely, change clothing completely, new environment, new setting`;
      negativePrompt = 'different face, different person, face changes, facial distortions, face swap, changed identity, face modifications, altered facial features, preserve original background, keep original clothing, same environment, original setting';
    } else {
      enhancedPrompt = `${prompt}, generate new face that fits the scene, transform the person`;
      negativePrompt = 'preserve original face, same identity, blurry, low quality';
    }

    const formData = new FormData();
    formData.append('image', imageBlob, 'image.png');
    formData.append('prompt', enhancedPrompt);
    formData.append('negative_prompt', negativePrompt);
    formData.append('strength', strength.toString());
    formData.append('cfg_scale', preserveFace ? '8' : '7'); // Moderate CFG for better stability
    formData.append('output_format', 'png');

    const response = await axiosInstance.post(
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
    throw new Error(`Image-to-image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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