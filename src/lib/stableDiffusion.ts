import { detectFaces, createFaceMask, loadFaceApiModels } from './faceDetection';
import { getActiveOverlay, applyOverlayToImage, shouldApplyOverlay } from './overlayUtils';
import { supabase } from './supabase';


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
  console.log(`🎯 Starting generation - ${facePreservationMode} mode for ${modelType} transformation`);
 
  // Input validation
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty for generation');
  }
 
  if (!originalContent?.startsWith('data:image/')) {
    throw new Error('Invalid image format. Please provide a valid image.');
  }

  try {
    let generatedResult: string;

    // Generate the base image/video first
    if (modelType === 'video') {
      console.log('🎬 Generating video...');
      generatedResult = await generateVideoWithIdeogram(prompt, originalContent, videoDuration, preserveFace, facePreservationMode);
    } else {
      console.log('🖼️ Generating image...');
      if (facePreservationMode === 'preserve_face') {
        generatedResult = await generateWithFacePreservation(prompt, originalContent);
      } else {
        generatedResult = await generateWithFaceReplacement(prompt, originalContent);
      }
    }

    console.log('✅ Base generation completed successfully, result length:', generatedResult.length);

    // **ENHANCED: Apply overlay if one is configured (only for images, not videos)**
    if (modelType === 'image') {
      console.log('🔍 Checking for overlay application...');
      
      try {
        // Check if overlay should be applied
        const shouldApply = shouldApplyOverlay();
        console.log('🎯 Should apply overlay:', shouldApply);
        
        if (shouldApply) {
          console.log('🎨 Overlay detected - applying to generated image...');
          
          const overlayConfig = getActiveOverlay();
          console.log('📋 Overlay config:', {
            hasConfig: !!overlayConfig,
            name: overlayConfig?.name,
            type: overlayConfig?.type,
            borderId: overlayConfig?.borderId,
            position: overlayConfig?.settings?.position,
            scale: overlayConfig?.settings?.scale,
            opacity: overlayConfig?.settings?.opacity
          });
          
          if (overlayConfig) {
            console.log('🖼️ Applying overlay to generated image...');
            const startTime = Date.now();
            
            const imageWithOverlay = await applyOverlayToImage(generatedResult, overlayConfig);
            
            const endTime = Date.now();
            console.log(`✅ Overlay applied successfully in ${endTime - startTime}ms!`);
            console.log('📊 Final result:', {
              originalLength: generatedResult.length,
              overlayLength: imageWithOverlay.length,
              hasOverlay: imageWithOverlay !== generatedResult
            });
            
            return imageWithOverlay;
          } else {
            console.warn('⚠️ shouldApplyOverlay returned true but getActiveOverlay returned null');
          }
        } else {
          console.log('ℹ️ No overlay configured - returning original image');
        }
      } catch (overlayError) {
        console.error('❌ Overlay application failed:', overlayError);
        console.error('Stack trace:', overlayError);
        console.log('📤 Returning original generated image without overlay');
        // Return original image if overlay fails - don't break the flow
      }
    } else {
      console.log('ℹ️ Skipping overlay for video generation');
    }

    console.log('📤 Returning final result (no overlay applied), length:', generatedResult.length);
    return generatedResult;

  } catch (error) {
    console.error(`❌ ${modelType} generation with ${facePreservationMode} failed:`, error);
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
  try {
    console.log('🎬 Generating video using browser-compatible approach...');
   
    // Call Supabase Edge Function for video generation
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt: prompt,
        inputData: originalContent,
        type: 'video',
        duration: videoDuration,
        preserveFace: preserveFace
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Failed to generate video');
    }

    if (!data?.success || !data?.result) {
      throw new Error(data?.error || 'Invalid response from video generation service');
    }

    console.log('✅ Video generation successful');
    return data.result;

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

// Existing image generation functions for Stability AI
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
    
      let enhancedPrompt = prompt;
      let negativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy, extra limbs';
    
      if (preserveFace) {
        enhancedPrompt = `${prompt}, preserve person's exact face and identity, keep same facial features, transform everything else completely, new outfit new background new setting, natural face integration, high quality, photorealistic`;
        negativePrompt = 'different person, changed face, face swap, different identity, circular mask artifacts, dark rings, halo effects, mask boundaries, original clothes, original background, blurry, low quality';
      } else {
        enhancedPrompt = `${prompt}, generate new face that fits the scene, transform the person`;
        negativePrompt = 'preserve original face, same identity, blurry, low quality, distorted';
      }
      
      console.log('📡 Making request to Stability AI...');
    
      // Call Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('generate-stability-image', {
        body: {
          prompt: enhancedPrompt,
          imageData: originalContent,
          mode: 'image-to-image',
          strength: preserveFace ? 0.8 : strength,
          cfgScale: preserveFace ? 10 : 7,
          negativePrompt: negativePrompt
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to generate image');
      }

      if (!data?.success || !data?.imageData) {
        throw new Error(data?.error || 'Invalid response from image generation service');
      }

      const result = data.imageData;
      console.log('✅ Image generation successful');
      return result;
    } catch (error) {
      console.error(`Image-to-image generation failed (attempt ${attempt}):`, error);
    
      if (attempt === MAX_RETRIES) {
        throw new Error(error instanceof Error ? error.message : 'Failed to generate with image-to-image');
      }
    
      console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
      await sleep(RETRY_DELAY * attempt);
    }
  }
  throw new Error('Failed to generate image after all retry attempts');
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
    
      const enhancedPrompt = `${prompt}, completely transform the background and environment, change all clothing and accessories, new setting, new location, dramatic scene change, keep the person's face exactly the same, seamlessly blended face, natural integration, no visible boundaries`;
      const negativePrompt = 'preserve original background, keep original clothing, maintain original setting, same environment, face changes, different person, facial modifications, visible mask edges, blending artifacts, halo effects, dark rings, unnatural transitions, blurry, low quality';

      // Call Supabase Edge Function for inpainting
      const { data, error } = await supabase.functions.invoke('generate-stability-image', {
        body: {
          prompt: enhancedPrompt,
          imageData: originalContent,
          mode: 'inpaint',
          maskData: maskContent,
          strength: 0.85,
          cfgScale: 10,
          negativePrompt: negativePrompt
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to generate image');
      }

      if (!data?.success || !data?.imageData) {
        throw new Error(data?.error || 'Invalid response from inpainting service');
      }

      const result = data.imageData;
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