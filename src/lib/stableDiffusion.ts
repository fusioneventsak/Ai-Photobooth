import axios, { AxiosError } from 'axios';
import { detectFaces, createFaceMask, loadFaceApiModels } from './faceDetection';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;
const REPLICATE_API_KEY = import.meta.env.VITE_REPLICATE_API_KEY;

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
  console.log(`🎯 Using ${facePreservationMode} mode for ${modelType} transformation`);
  
  // Input validation
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty for generation');
  }
  
  if (!originalContent?.startsWith('data:image/')) {
    throw new Error('Invalid image format. Please provide a valid image.');
  }

  try {
    if (modelType === 'video') {
      return await generateVideoWithIdeogram(prompt, originalContent, videoDuration, preserveFace, facePreservationMode);
    } else {
      if (facePreservationMode === 'preserve_face') {
        return await generateWithFacePreservation(prompt, originalContent);
      } else {
        return await generateWithFaceReplacement(prompt, originalContent);
      }
    }
  } catch (error) {
    console.error(`${modelType} generation with ${facePreservationMode} failed:`, error);
    throw new Error(error instanceof Error ? error.message : `Failed to generate ${modelType} with ${facePreservationMode}`);
  }
}

async function generateVideoWithIdeogram(
  prompt: string,
  originalContent: string,
  videoDuration: number,
  preserveFace: boolean,
  facePreservationMode: 'preserve_face' | 'replace_face'
): Promise<string> {
  // Video generation requires Replicate API key
  if (!REPLICATE_API_KEY || REPLICATE_API_KEY.includes('undefined')) {
    throw new Error('Replicate API key is required for video generation. Please add VITE_REPLICATE_API_KEY to your .env file.');
  }

  try {
    console.log('🎬 Generating video using Ideogram Character approach...');
    
    // Import Replicate dynamically
    const { default: Replicate } = await import('replicate');
    
    const replicate = new Replicate({
      auth: REPLICATE_API_KEY,
    });

    // Step 1: Generate a character-consistent image
    console.log('🎭 Step 1: Creating character-consistent image...');
    
    let characterImageUrl: string;
    
    try {
      if (facePreservationMode === 'preserve_face') {
        characterImageUrl = await generateCharacterPreservationImage(replicate, prompt, originalContent);
      } else {
        characterImageUrl = await generateCharacterTransformationImage(replicate, prompt, originalContent);
      }
    } catch (characterError) {
      console.error('Character generation failed:', characterError);
      // Create a fallback image if character generation fails
      characterImageUrl = await createSimpleFallbackImage(prompt);
    }

    // Step 2: Convert to video using Stable Video Diffusion
    console.log('🎬 Step 2: Converting character image to video...');
    
    try {
      const output = await replicate.run(
        "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb1a4c069b4bb91bc25be5667a0b525e63c21e2257",
        {
          input: {
            cond_aug: 0.02,
            decoding_t: 14,
            video_length: "14_frames_with_svd",
            sizing_strategy: "maintain_aspect_ratio",
            motion_bucket_id: 127,
            frames_per_second: 6,
            image: characterImageUrl
          }
        }
      );

      if (!output || typeof output !== 'string' || !output.startsWith('http')) {
        throw new Error('Video generation returned invalid output');
      }

      const videoUrl = await downloadAndCreateBlobUrl(output, 'video');
      console.log('✅ Video generation successful');
      return videoUrl;
      
    } catch (videoError) {
      console.error('Video generation failed:', videoError);
      throw new Error('Video generation model failed. Please try again later.');
    }

  } catch (error) {
    console.error('Video generation error:', error);
    
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
    
    throw new Error('Failed to generate video: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Generate character image while preserving identity
async function generateCharacterPreservationImage(replicate: any, prompt: string, originalContent: string): Promise<string> {
  try {
    console.log('🎭 Using Ideogram Character for identity preservation...');
    
    // Try Ideogram Character first (best for face preservation)
    const output = await replicate.run(
      "ideogram-ai/ideogram-character",
      {
        input: {
          prompt: `${prompt}, photorealistic, high quality, cinematic lighting, detailed`,
          character_reference_image: originalContent
        }
      }
    );

    if (output && output.url && typeof output.url === 'function') {
      const imageUrl = output.url();
      console.log('✅ Ideogram Character generated image:', imageUrl);
      return imageUrl;
    }
    
    // Handle array output (fallback)
    if (output && Array.isArray(output) && output.length > 0) {
      return output[0];
    }
    
    throw new Error('No valid output from Ideogram Character');
    
  } catch (error) {
    console.error('Ideogram Character failed:', error);
    
    // Fallback to Ideogram v3
    console.log('🔄 Falling back to Ideogram v3...');
    return await generateWithIdeogramV3(replicate, prompt);
  }
}

// Generate transformed character image
async function generateCharacterTransformationImage(replicate: any, prompt: string, originalContent: string): Promise<string> {
  console.log('🎨 Using Ideogram v3 for character transformation...');
  
  return await generateWithIdeogramV3(replicate, prompt);
}

// Generate image using Ideogram v3
async function generateWithIdeogramV3(replicate: any, prompt: string): Promise<string> {
  try {
    const output = await replicate.run(
      "ideogram-ai/ideogram-v3-quality",
      {
        input: {
          prompt: `${prompt}, photorealistic, high quality, cinematic lighting, detailed`,
          aspect_ratio: "1:1",
          magic_prompt: true
        }
      }
    );

    if (output && output.url && typeof output.url === 'function') {
      const imageUrl = output.url();
      console.log('✅ Ideogram v3 generated image:', imageUrl);
      return imageUrl;
    }
    
    // Handle array output (fallback)
    if (output && Array.isArray(output) && output.length > 0) {
      return output[0];
    }
    
    throw new Error('No valid output from Ideogram v3');
    
  } catch (error) {
    console.error('Ideogram v3 failed:', error);
    throw new Error('Image generation failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Create a simple fallback image when all else fails
async function createSimpleFallbackImage(prompt: string): Promise<string> {
  console.log('🎨 Creating fallback image...');
  
  // Create a simple canvas image
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Cannot create fallback image - canvas context unavailable');
  }
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  
  // Add text
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Generated Image', 256, 200);
  ctx.font = '16px Arial';
  ctx.fillText('Video Preview', 256, 230);
  
  // Word wrap prompt
  const words = prompt.split(' ');
  let line = '';
  let y = 280;
  
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    
    if (testWidth > 400 && n > 0) {
      ctx.fillText(line, 256, y);
      line = words[n] + ' ';
      y += 20;
    } else {
      line = testLine;
    }
    
    if (y > 450) break; // Don't overflow
  }
  ctx.fillText(line, 256, y);
  
  // Convert to data URL
  return canvas.toDataURL('image/png');
}

async function downloadAndCreateBlobUrl(url: string, type: 'image' | 'video'): Promise<string> {
  try {
    console.log(`⬇️ Downloading generated ${type}...`);
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(120000) // 2 minute timeout
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download ${type}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error(`Received empty ${type} file`);
    }
    
    if (type === 'video') {
      // For videos, return blob URL for direct playback
      return URL.createObjectURL(blob);
    } else {
      // For images, convert to base64 data URL
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
    }
  } catch (error) {
    throw new Error(`Failed to download ${type}: ` + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Existing image generation functions for Stability AI
async function generateWithFacePreservation(prompt: string, originalContent: string): Promise<string> {
  if (!STABILITY_API_KEY || STABILITY_API_KEY.includes('undefined')) {
    throw new Error('Stability AI API key not found. Please check your .env file and make sure VITE_STABILITY_API_KEY is set.');
  }

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
  if (!STABILITY_API_KEY || STABILITY_API_KEY.includes('undefined')) {
    throw new Error('Stability AI API key not found. Please check your .env file and make sure VITE_STABILITY_API_KEY is set.');
  }

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
     
      console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
      await sleep(RETRY_DELAY * attempt);
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
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
         
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
         
          ctx.drawImage(img, 0, 0);
         
          console.log('🔍 Detecting faces with face-api.js...');
          const detections = await detectFaces(canvas);
         
          if (detections && detections.length > 0) {
            console.log(`✅ Found ${detections.length} face(s), creating precise landmark-based mask with soft edges`);
           
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = img.width;
            maskCanvas.height = img.height;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) {
              reject(new Error('Failed to get mask canvas context'));
              return;
            }
           
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
           
            detections.forEach(detection => {
              const landmarks = detection.landmarks;
              const jawLine = landmarks.getJawOutline();
              const leftEyebrow = landmarks.getLeftEyeBrow();
              const rightEyebrow = landmarks.getRightEyeBrow();
              const allPoints = [...jawLine, ...leftEyebrow, ...rightEyebrow.reverse()];
             
              const centerX = detection.detection.box.x + detection.detection.box.width / 2;
              const centerY = detection.detection.box.y + detection.detection.box.height / 2;
             
              const expandedPoints = allPoints.map(point => {
                const deltaX = point.x - centerX;
                const deltaY = point.y - centerY;
                return {
                  x: centerX + deltaX * 1.15,
                  y: centerY + deltaY * 1.15
                };
              });
             
              maskCtx.fillStyle = 'black';
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
           
            const blurRadius = Math.round(maskCanvas.width * 0.02);
            console.log(`Applying Gaussian blur with radius ${blurRadius}px for soft mask edges`);
           
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = maskCanvas.width;
            tempCanvas.height = maskCanvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
              reject(new Error('Failed to get temp canvas context'));
              return;
            }
            tempCtx.drawImage(maskCanvas, 0, 0);
           
            maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            maskCtx.filter = `blur(${blurRadius}px)`;
            maskCtx.drawImage(tempCanvas, 0, 0);
           
            const maskDataUrl = maskCanvas.toDataURL('image/png');
            resolve(maskDataUrl);
           
          } else {
            console.log('⚠️ No faces detected, using fallback geometric mask');
            const fallbackMask = await createFallbackMask(originalContent);
            resolve(fallbackMask);
          }
         
        } catch (faceError) {
          console.log('⚠️ Face detection failed, using fallback mask:', faceError);
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
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.37;
        const faceWidth = canvas.width * 0.32;
        const faceHeight = canvas.height * 0.42;
        
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, faceWidth * 0.8
        );
        gradient.addColorStop(0, 'black');
        gradient.addColorStop(0.3, 'black');
        gradient.addColorStop(0.6, '#404040');
        gradient.addColorStop(0.8, '#A0A0A0');
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
      formData.append('prompt', `${prompt}, completely transform the background and environment, change all clothing and accessories, new setting, new location, dramatic scene change, keep the person's face exactly the same, seamlessly blended face, natural integration, no visible boundaries`);
      formData.append('negative_prompt', 'preserve original background, keep original clothing, maintain original setting, same environment, face changes, different person, facial modifications, visible mask edges, blending artifacts, halo effects, dark rings, unnatural transitions, blurry, low quality');
      formData.append('strength', '0.85');
      formData.append('cfg_scale', '10');
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
     
      console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
      await sleep(RETRY_DELAY * attempt);
    }
  }
 
  throw new Error('Failed to inpaint around face area after all retry attempts');
}