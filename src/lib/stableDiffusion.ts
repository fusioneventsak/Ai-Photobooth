import axios, { AxiosError } from 'axios';
import { detectFaces, createFaceMask, loadFaceApiModels } from './faceDetection';

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
    console.log('🎭 Using face-api.js for precise face detection and masking...');
    
    // Ensure face detection models are loaded
    await loadFaceApiModels();
    
    // Create precise face mask using face-api.js
    const preciseMask = await createPreciseFaceMask(originalContent);
    
    // Use inpainting with the precise face mask
    const result = await inpaintAroundFace(prompt, originalContent, preciseMask);
    return result;
    
  } catch (error) {
    console.error('Face-api.js processing failed, using fallback:', error);
    
    // If face detection fails completely, fall back to image-to-image
    console.log('🔄 Falling back to image-to-image generation...');
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

async function createPreciseFaceMask(originalContent: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const img = new Image();
      img.onload = async () => {
        try {
          // Create canvas for processing
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Draw image to canvas for face detection
          ctx.drawImage(img, 0, 0);
          
          // Try to detect faces using face-api.js
          console.log('🔍 Detecting faces with face-api.js...');
          const detections = await detectFaces(canvas);
          
          if (detections && detections.length > 0) {
            console.log(`✅ Found ${detections.length} face(s), creating SHARP landmark-based mask`);
            
            // Create a new canvas for the mask
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = img.width;
            maskCanvas.height = img.height;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) {
              reject(new Error('Failed to get mask canvas context'));
              return;
            }
            
            // Start with white background (areas to modify)
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            
            // NO GRADIENTS! Create sharp, precise face masks using landmarks
            detections.forEach(detection => {
              const landmarks = detection.landmarks;
              
              // Get all facial landmark points
              const jawLine = landmarks.getJawOutline();
              const leftEyebrow = landmarks.getLeftEyeBrow();
              const rightEyebrow = landmarks.getRightEyeBrow();
              
              // Create an expanded face outline that goes slightly beyond landmarks
              const allPoints = [...jawLine, ...leftEyebrow, ...rightEyebrow.reverse()];
              
              // Calculate face center and expand the boundary
              const centerX = detection.detection.box.x + detection.detection.box.width / 2;
              const centerY = detection.detection.box.y + detection.detection.box.height / 2;
              
              // Expand each point outward from center by 10% to ensure full face coverage
              const expandedPoints = allPoints.map(point => {
                const deltaX = point.x - centerX;
                const deltaY = point.y - centerY;
                return {
                  x: centerX + deltaX * 1.1,
                  y: centerY + deltaY * 1.1
                };
              });
              
              // Create SHARP face outline - no gradients
              maskCtx.fillStyle = 'black'; // Preserve area
              maskCtx.beginPath();
              
              expandedPoints.forEach((point, index) => {
                if (index === 0) {
                  maskCtx.moveTo(point.x, point.y);
                } else {
                  maskCtx.lineTo(point.x, point.y);
                }
              });
              
              maskCtx.closePath();
              maskCtx.fill();
            });
            
            const maskDataUrl = maskCanvas.toDataURL('image/png');
            resolve(maskDataUrl);
            
          } else {
            console.log('⚠️ No faces detected, using fallback geometric mask');
            // Fallback to geometric mask
            const fallbackMask = await createFallbackMask(originalContent);
            resolve(fallbackMask);
          }
          
        } catch (faceError) {
          console.log('⚠️ Face detection failed, using fallback mask:', faceError);
          // Fallback to geometric mask
          const fallbackMask = await createFallbackMask(originalContent);
          resolve(fallbackMask);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image for face detection'));
      img.src = originalContent;
      
    } catch (error) {
      reject(new Error('Failed to create precise face mask: ' + error.message));
    }
  });
}

// Fallback geometric mask when face detection fails
async function createFallbackMask(originalContent: string): Promise<string> {
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

        // Create optimized face area
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.37;
        const faceWidth = canvas.width * 0.32;
        const faceHeight = canvas.height * 0.42;

        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, faceWidth * 0.8
        );
        gradient.addColorStop(0, 'black');
        gradient.addColorStop(0.4, 'black');
        gradient.addColorStop(0.7, '#808080');
        gradient.addColorStop(0.9, '#C0C0C0');
        gradient.addColorStop(1, 'white');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, faceWidth/2, faceHeight/2, 0, 0, Math.PI * 2);
        ctx.fill();

        const result = canvas.toDataURL('image/png');
        resolve(result);
      };

      img.onerror = () => reject(new Error('Failed to load image for fallback mask'));
      img.src = originalContent;

    } catch (error) {
      reject(new Error('Failed to create fallback mask'));
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