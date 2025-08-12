import { detectFaces, createFaceMask, loadFaceApiModels } from './faceDetection';
import { getActiveOverlay, applyOverlayToImage, shouldApplyOverlay } from './overlayUtils';
import { supabase } from './supabase';

// Enhanced error handling and retry logic
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Maximum image size to prevent memory issues
const MAX_IMAGE_SIZE = 4096 * 4096;
const MAX_BASE64_SIZE = 50 * 1024 * 1024; // 50MB

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

  // Validate image size to prevent stack overflow
  if (originalContent.length > MAX_BASE64_SIZE) {
    throw new Error('Image too large. Please use a smaller image.');
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
 
  // Word wrap prompt (with length limit to prevent issues)
  const words = prompt.slice(0, 200).split(' ');
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
  
    // Create precise face mask using face-api.js with error handling
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
      console.log(`🔄 Using edge function for image-to-image with strength ${strength} (preserve face: ${preserveFace})... Attempt ${attempt}/${MAX_RETRIES}`);
    
      // Sanitize prompt to prevent issues
      const sanitizedPrompt = prompt.slice(0, 1000).trim();
      
      let enhancedPrompt = sanitizedPrompt;
      let negativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy, extra limbs';
    
      if (preserveFace) {
        enhancedPrompt = `${sanitizedPrompt}, preserve person's exact face and identity, keep same facial features, transform everything else completely, new outfit new background new setting, natural face integration, high quality, photorealistic`;
        negativePrompt = 'different person, changed face, face swap, different identity, circular mask artifacts, dark rings, halo effects, mask boundaries, original clothes, original background, blurry, low quality';
      } else {
        enhancedPrompt = `${sanitizedPrompt}, generate new face that fits the scene, transform the person`;
        negativePrompt = 'preserve original face, same identity, blurry, low quality, distorted';
      }
      
      console.log('📡 Making request to edge function...');
    
      // Call Supabase Edge Function with proper error handling
      const { data, error } = await supabase.functions.invoke('generate-stability-image', {
        body: {
          prompt: enhancedPrompt,
          imageData: originalContent,
          mode: 'image-to-image',
          strength: Math.max(0.1, Math.min(1.0, preserveFace ? 0.8 : strength)),
          cfgScale: Math.max(1, Math.min(20, preserveFace ? 10 : 7)),
          negativePrompt: negativePrompt
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        
        // Enhanced error handling
        const errorMessage = error.message || 'Unknown edge function error';
        
        if (errorMessage.includes('too large')) {
          throw new Error('Image size too large. Please try with a smaller image.');
        } else if (errorMessage.includes('timeout')) {
          throw new Error('Request timed out. Please try again.');
        } else if (errorMessage.includes('Invalid API key')) {
          throw new Error('Invalid API key configuration.');
        } else if (errorMessage.includes('Insufficient')) {
          throw new Error('Insufficient API credits.');
        } else if (errorMessage.includes('Rate limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment.');
        }
        
        throw new Error(errorMessage);
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(errorMessage);
      }
    
      console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
      await sleep(RETRY_DELAY * attempt);
    }
  }
  throw new Error('Failed to generate image after all retry attempts');
}

async function createPreciseFaceMask(originalContent: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      reject(new Error('Face mask creation timeout'));
    }, 30000); // 30 second timeout

    try {
      const img = new Image();
      
      img.onload = async () => {
        try {
          // Clear timeout since we got a response
          clearTimeout(timeoutId);
          
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
          
            // Fill with white background (areas to transform)
            maskCtx.fillStyle = 'white';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
          
            // Process each face with bounds checking
            detections.forEach((detection, index) => {
              try {
                const landmarks = detection.landmarks;
                const jawLine = landmarks.getJawOutline();
                const leftEyebrow = landmarks.getLeftEyeBrow();
                const rightEyebrow = landmarks.getRightEyeBrow();
                
                // Create safe copy to avoid modifying original and prevent recursion
                const rightEyebrowCopy = Array.from(rightEyebrow);
                rightEyebrowCopy.reverse();
                
                // Limit points to prevent stack overflow
                const maxPoints = 50;
                const allPoints = [...jawLine, ...leftEyebrow, ...rightEyebrowCopy].slice(0, maxPoints);
                
                // Validate we have enough points
                if (allPoints.length < 3) {
                  console.warn(`Face ${index}: Not enough points, using bounding box`);
                  const box = detection.detection.box;
                  maskCtx.fillStyle = 'black';
                  maskCtx.fillRect(box.x, box.y, box.width, box.height);
                  return;
                }
                
                const centerX = detection.detection.box.x + detection.detection.box.width / 2;
                const centerY = detection.detection.box.y + detection.detection.box.height / 2;
                
                // Expand points safely with bounds checking
                const expandedPoints = allPoints.map(point => {
                  if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
                    return { x: centerX, y: centerY }; // Fallback to center
                  }
                  
                  const deltaX = point.x - centerX;
                  const deltaY = point.y - centerY;
                  return {
                    x: centerX + deltaX * 1.15,
                    y: centerY + deltaY * 1.15
                  };
                });
                
                // Draw face mask
                maskCtx.fillStyle = 'black';
                maskCtx.beginPath();
                
                expandedPoints.forEach((point, pointIndex) => {
                  if (point && typeof point.x === 'number' && typeof point.y === 'number') {
                    if (pointIndex === 0) {
                      maskCtx.moveTo(point.x, point.y);
                    } else {
                      maskCtx.lineTo(point.x, point.y);
                    }
                  }
                });
                
                maskCtx.closePath();
                maskCtx.fill();
                
              } catch (faceError) {
                console.warn(`Face ${index} processing failed:`, faceError);
                // Fallback to bounding box
                const box = detection.detection.box;
                maskCtx.fillStyle = 'black';
                maskCtx.fillRect(box.x, box.y, box.width, box.height);
              }
            });
          
            // Apply blur safely
            try {
              const blurRadius = Math.min(Math.round(maskCanvas.width * 0.02), 20); // Limit blur
              console.log(`Applying Gaussian blur with radius ${blurRadius}px for soft mask edges`);
            
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = maskCanvas.width;
              tempCanvas.height = maskCanvas.height;
              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                tempCtx.drawImage(maskCanvas, 0, 0);
                
                maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                maskCtx.filter = `blur(${blurRadius}px)`;
                maskCtx.drawImage(tempCanvas, 0, 0);
                maskCtx.filter = 'none'; // Reset filter
              }
            } catch (blurError) {
              console.warn('Blur application failed, using sharp mask:', blurError);
            }
          
            const maskDataUrl = maskCanvas.toDataURL('image/png');
            resolve(maskDataUrl);
          
          } else {
            console.log('⚠️ No faces detected, using fallback geometric mask');
            const fallbackMask = await createFallbackMask(originalContent);
            resolve(fallbackMask);
          }
        
        } catch (faceError) {
          console.log('⚠️ Face detection failed, using fallback mask:', faceError);
          try {
            const fallbackMask = await createFallbackMask(originalContent);
            resolve(fallbackMask);
          } catch (fallbackError) {
            reject(new Error('Both face detection and fallback failed: ' + fallbackError.message));
          }
        }
      };
    
      img.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('Failed to load image for face detection'));
      };
      
      img.src = originalContent;
    
    } catch (error) {
      clearTimeout(timeoutId);
      reject(new Error('Failed to create precise face mask: ' + (error instanceof Error ? error.message : 'Unknown error')));
    }
  });
}

async function createFallbackMask(originalContent: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Fallback mask creation timeout'));
    }, 10000);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        clearTimeout(timeout);
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        try {
          clearTimeout(timeout);
          
          canvas.width = img.width;
          canvas.height = img.height;
         
          // White background (transform area)
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
         
          // Create face-like mask in center
          const centerX = canvas.width / 2;
          const centerY = canvas.height * 0.37;
          const faceWidth = Math.min(canvas.width * 0.32, 200);
          const faceHeight = Math.min(canvas.height * 0.42, 250);
         
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
        } catch (canvasError) {
          reject(new Error('Canvas processing failed: ' + (canvasError instanceof Error ? canvasError.message : 'Unknown error')));
        }
      };
     
      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load image for fallback mask'));
      };
      
      img.src = originalContent;
    } catch (error) {
      clearTimeout(timeout);
      reject(new Error('Failed to create fallback mask: ' + (error instanceof Error ? error.message : 'Unknown error')));
    }
  });
}

async function inpaintAroundFace(prompt: string, originalContent: string, maskContent: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🖌️ Inpainting around face area (preserving face region)... Attempt ${attempt}/${MAX_RETRIES}`);
    
      // Sanitize inputs
      const sanitizedPrompt = prompt.slice(0, 1000).trim();
      const enhancedPrompt = `${sanitizedPrompt}, completely transform the background and environment, change all clothing and accessories, new setting, new location, dramatic scene change, keep the person's face exactly the same, seamlessly blended face, natural integration, no visible boundaries`;
      const negativePrompt = 'preserve original background, keep original clothing, maintain original setting, same environment, face changes, different person, facial modifications, visible mask edges, blending artifacts, halo effects, dark rings, unnatural transitions, blurry, low quality';

      // Call Supabase Edge Function for inpainting
      const { data, error } = await supabase.functions.invoke('generate-stability-image', {
        body: {
          prompt: enhancedPrompt,
          imageData: originalContent,
          mode: 'inpaint',
          maskData: maskContent,
          strength: Math.max(0.1, Math.min(1.0, 0.85)),
          cfgScale: Math.max(1, Math.min(20, 10)),
          negativePrompt: negativePrompt
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        
        // Enhanced error handling
        const errorMessage = error.message || 'Unknown edge function error';
        
        if (errorMessage.includes('too large')) {
          throw new Error('Image or mask size too large. Please try with smaller images.');
        } else if (errorMessage.includes('timeout')) {
          throw new Error('Inpainting request timed out. Please try again.');
        } else if (errorMessage.includes('Invalid API key')) {
          throw new Error('Invalid API key configuration.');
        } else if (errorMessage.includes('Insufficient')) {
          throw new Error('Insufficient API credits.');
        } else if (errorMessage.includes('Rate limit')) {
          throw new Error('Rate limit exceeded. Please wait a moment.');
        }
        
        throw new Error(errorMessage);
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

// Utility function to validate image size
function validateImageSize(imageData: string): boolean {
  try {
    if (!imageData || !imageData.startsWith('data:image/')) {
      return false;
    }
    
    if (imageData.length > MAX_BASE64_SIZE) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Export utility functions for external use
export {
  validateImageSize,
  createSimpleFallbackImage
};