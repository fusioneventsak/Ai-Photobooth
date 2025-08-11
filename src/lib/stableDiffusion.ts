import axios, { AxiosError } from 'axios';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;

// Enhanced error handling and retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    console.log('🎭 Trying organic mask inpainting first...');
    
    // Try inpainting with improved organic mask
    const invertedMask = await createInvertedFaceMask(originalContent);
    const result = await inpaintAroundFace(prompt, originalContent, invertedMask);
    return result;
    
  } catch (error) {
    console.error('Organic mask inpainting failed, trying image-to-image:', error);
    
    // If inpainting fails or has artifacts, fall back to smart image-to-image
    console.log('🔄 Falling back to high-quality image-to-image...');
    return await generateWithImageToImage(prompt, originalContent, 0.65, true);
  }
}

async function generateWithFaceReplacement(prompt: string, originalContent: string): Promise<string> {
  try {
    console.log('🔄 Replacing face, preserving background/clothing...');
    
    // Use high-strength image-to-image with face-focused prompts
    return await generateWithImageToImage(prompt, originalContent, 0.7, false);
    
  } catch (error) {
    console.error('Face replacement failed:', error);
    
    // Fallback to moderate strength
    console.log('🔄 Falling back to moderate transformation...');
    return await generateWithImageToImage(prompt, originalContent, 0.5, false);
  }
}

async function generateWithImageToImage(
  prompt: string, 
  originalContent: string, 
  strength: number = 0.5, 
  preserveFace: boolean = true
): Promise<string> {
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🔄 Using image-to-image with strength ${strength} (preserve face: ${preserveFace})... Attempt ${attempt}/${MAX_RETRIES}`);
      
      const imageBlob = base64ToBlob(originalContent);
      
      let enhancedPrompt = prompt;
      let negativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy, extra limbs';
      
      if (preserveFace) {
        enhancedPrompt = `${prompt}, preserve person's exact face and identity, keep same facial features, transform everything else completely, new outfit new background new setting, natural face integration, high quality, photorealistic`;
        negativePrompt = 'different person, changed face, face swap, different identity, circular mask artifacts, dark rings, halo effects, mask boundaries, original clothes, original background, blurry, low quality';
      } else {
        enhancedPrompt = `${prompt}, generate new face that fits the scene, transform the person`;
        negativePrompt = 'preserve original face, same identity, blurry, low quality, distorted';
      }

      const formData = new FormData();
      formData.append('image', imageBlob, 'image.png');
      formData.append('prompt', enhancedPrompt);
      formData.append('negative_prompt', negativePrompt);
      formData.append('strength', preserveFace ? '0.8' : strength.toString());
      formData.append('cfg_scale', preserveFace ? '10' : '7');
      formData.append('output_format', 'png');
      formData.append('mode', 'image-to-image');

      console.log('📡 Making request to Stability AI...');
      
      const response = await axios.post(
        'https://api.stability.ai/v2beta/stable-image/generate/sd3',
        formData,
        {
          headers: {
            Accept: 'image/*',
            Authorization: `Bearer ${STABILITY_API_KEY}`,
            'Content-Type': 'multipart/form-data',
          },
          responseType: 'arraybuffer',
          timeout: 120000,
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        }
      );

      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Stability AI API key.');
      }
      
      if (response.status === 402) {
        throw new Error('Insufficient credits. Please check your Stability AI account.');
      }
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      }
      
      if (response.status >= 400) {
        const errorText = new TextDecoder().decode(response.data);
        console.error('API Error Response:', errorText);
        throw new Error(`API Error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      if (!response?.data || response.data.byteLength === 0) {
        throw new Error('Empty response from Stability AI');
      }

      const arrayBuffer = response.data;
      const base64String = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const result = `data:image/png;base64,${base64String}`;
      console.log('✅ Image generation successful');
      return result;

    } catch (error) {
      console.error(`Image-to-image generation failed (attempt ${attempt}):`, error);
      
      if (attempt === MAX_RETRIES) {
        // Final attempt failed
        if (error instanceof AxiosError) {
          if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
            throw new Error('Network connection failed. Please check your internet connection and try again.');
          }
          if (error.response?.status === 401) {
            throw new Error('Invalid API key. Please check your Stability AI API key configuration.');
          }
          if (error.response?.status === 402) {
            throw new Error('Insufficient Stability AI credits. Please check your account.');
          }
          if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please wait a moment and try again.');
          }
        }
        
        throw new Error(error instanceof Error ? error.message : 'Failed to generate with image-to-image');
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
      await sleep(RETRY_DELAY * attempt); // Exponential backoff
    }
  }
  
  throw new Error('Failed to generate image after all retry attempts');
}

function base64ToBlob(base64Data: string): Blob {
  try {
    const base64String = base64Data.split(',')[1];
    if (!base64String) {
      throw new Error('Invalid base64 data format');
    }
    
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/png' });
  } catch (error) {
    throw new Error('Failed to convert base64 to blob: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

async function createInvertedFaceMask(originalContent: string): Promise<string> {
  // Creates a more natural face-shaped mask instead of perfect circle
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

        // Create white background (areas to modify)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        
        // Face parameters
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.37;
        const faceWidth = canvas.width * 0.32;
        const faceHeight = canvas.height * 0.42;

        // Create a more natural face shape using multiple overlapping gradients
        // This mimics a more organic face boundary
        
        // Main face oval
        const mainGradient = ctx.createRadialGradient(
          centerX, centerY, 0, 
          centerX, centerY, faceWidth * 0.8
        );
        mainGradient.addColorStop(0, 'black');
        mainGradient.addColorStop(0.4, 'black');
        mainGradient.addColorStop(0.7, '#808080');
        mainGradient.addColorStop(1, 'white');

        // Draw main face area
        ctx.fillStyle = mainGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, faceWidth/2, faceHeight/2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Add softer outer blending with multiple small gradients to break up the circle
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI * 2) / 8;
          const offsetX = Math.cos(angle) * faceWidth * 0.3;
          const offsetY = Math.sin(angle) * faceHeight * 0.3;
          
          const blendGradient = ctx.createRadialGradient(
            centerX + offsetX, centerY + offsetY, 0,
            centerX + offsetX, centerY + offsetY, faceWidth * 0.4
          );
          blendGradient.addColorStop(0, '#606060');
          blendGradient.addColorStop(0.5, '#A0A0A0');
          blendGradient.addColorStop(1, 'white');

          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = blendGradient;
          ctx.beginPath();
          ctx.ellipse(
            centerX + offsetX, centerY + offsetY, 
            faceWidth * 0.25, faceHeight * 0.25, 
            0, 0, Math.PI * 2
          );
          ctx.fill();
        }

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
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🖌️ Inpainting around face area (preserving face region)... Attempt ${attempt}/${MAX_RETRIES}`);
      
      const originalBlob = base64ToBlob(originalContent);
      const maskBlob = base64ToBlob(maskContent);

      const formData = new FormData();
      formData.append('image', originalBlob, 'original.png');
      formData.append('mask', maskBlob, 'mask.png');
      formData.append('prompt', `${prompt}, completely transform the background and environment, change all clothing and accessories, new setting, new location, dramatic scene change, keep the person's face exactly the same`);
      formData.append('negative_prompt', 'preserve original background, keep original clothing, maintain original setting, same environment, face changes, different person, facial modifications');
      formData.append('strength', '0.95'); // Very high strength for maximum background transformation
      formData.append('cfg_scale', '10'); // Higher for better prompt adherence
      formData.append('output_format', 'png');

      const response = await axios.post(
        'https://api.stability.ai/v2beta/stable-image/edit/inpaint',
        formData,
        {
          headers: {
            Accept: 'image/*',
            Authorization: `Bearer ${STABILITY_API_KEY}`,
            'Content-Type': 'multipart/form-data',
          },
          responseType: 'arraybuffer',
          timeout: 120000,
          validateStatus: (status) => status < 500,
        }
      );

      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Stability AI API key.');
      }
      
      if (response.status === 402) {
        throw new Error('Insufficient credits. Please check your Stability AI account.');
      }
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      }
      
      if (response.status >= 400) {
        const errorText = new TextDecoder().decode(response.data);
        console.error('Inpaint API Error Response:', errorText);
        throw new Error(`Inpaint API Error (${response.status}): ${errorText || 'Unknown error'}`);
      }

      if (!response?.data || response.data.byteLength === 0) {
        throw new Error('Empty response from Stability AI inpaint');
      }

      const arrayBuffer = response.data;
      const base64String = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const result = `data:image/png;base64,${base64String}`;
      console.log('✅ Face preservation inpainting successful');
      return result;

    } catch (error) {
      console.error(`Inpainting around face failed (attempt ${attempt}):`, error);
      
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      
      // Wait before retrying
      console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
      await sleep(RETRY_DELAY * attempt);
    }
  }
  
  throw new Error('Failed to inpaint around face area after all retry attempts');
}