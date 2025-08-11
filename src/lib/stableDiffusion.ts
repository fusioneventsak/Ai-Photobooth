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
    console.log('🎭 Preserving face using advanced image-to-image approach...');
    
    // Use a refined image-to-image approach
    const result = await generateWithImageToImage(prompt, originalContent, 0.65, true);
    return result;
    
  } catch (error) {
    console.error('Face preservation failed:', error);
    
    // Fallback to even lower strength
    console.log('🔄 Falling back to minimal transformation...');
    return await generateWithImageToImage(prompt, originalContent, 0.45, true);
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
        enhancedPrompt = `${prompt}, keep the exact same person, same facial features, same face shape, same eyes, same nose, same mouth, preserve facial identity completely, transform background completely, change clothing completely, new environment, new setting`;
        negativePrompt = 'different face, different person, face changes, facial distortions, face swap, changed identity, face modifications, altered facial features, preserve original background, keep original clothing, same environment, original setting, blurry, low quality';
      } else {
        enhancedPrompt = `${prompt}, generate new face that fits the scene, transform the person`;
        negativePrompt = 'preserve original face, same identity, blurry, low quality, distorted';
      }

      const formData = new FormData();
      formData.append('image', imageBlob, 'image.png');
      formData.append('prompt', enhancedPrompt);
      formData.append('negative_prompt', negativePrompt);
      formData.append('strength', strength.toString());
      formData.append('cfg_scale', preserveFace ? '12' : '7');
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

// Simplified face mask creation (if needed for future enhancements)
async function createFaceMask(originalContent: string): Promise<string> {
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