import axios from 'axios';

const STABILITY_API_KEY = import.meta.env.VITE_STABILITY_API_KEY;

// Simple, working approach: Generate base image then use CSS/Canvas overlay
export async function generateImage(
  prompt: string, 
  originalContent: string,
  modelType: 'image' | 'video' = 'image',
  videoDuration: number = 5
): Promise<string> {
  console.log('🎯 Using template-based approach for true face preservation');

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
    // Step 1: Generate a template/background scene without any person
    const templatePrompt = `${prompt}, empty scene, no people, no faces, high quality background`;
    const backgroundImage = await generateBackgroundOnly(templatePrompt);

    // Step 2: Combine the original face with the generated background
    const combinedImage = await overlayFaceOnBackground(originalContent, backgroundImage);

    return combinedImage;

  } catch (error) {
    console.error('Template-based generation failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate image with face preservation');
  }
}

async function generateBackgroundOnly(prompt: string): Promise<string> {
  try {
    console.log('🎨 Generating background scene...');
    
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('negative_prompt', 'people, faces, persons, humans, man, woman, portrait');
    formData.append('aspect_ratio', '1:1');
    formData.append('output_format', 'png');
    formData.append('style_preset', 'photographic');

    const response = await axios.post(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      formData,
      {
        headers: {
          Accept: 'image/*',
          Authorization: `Bearer ${STABILITY_API_KEY}`,
        },
        responseType: 'arraybuffer',
        timeout: 60000
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
    console.error('Background generation failed:', error);
    throw new Error('Failed to generate background scene');
  }
}

async function overlayFaceOnBackground(originalImage: string, backgroundImage: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      console.log('🎭 Overlaying original face on generated background...');

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = 1024;
      canvas.height = 1024;

      let loadedImages = 0;
      const totalImages = 2;

      const originalImg = new Image();
      const backgroundImg = new Image();

      const checkComplete = () => {
        loadedImages++;
        if (loadedImages === totalImages) {
          try {
            // Draw background
            ctx.drawImage(backgroundImg, 0, 0, 1024, 1024);

            // Extract and overlay the face area from original
            // This is a simple approach - in production you'd use face detection
            const faceSize = 350; // Size of face area to preserve
            const faceX = (1024 - faceSize) / 2; // Center horizontally
            const faceY = 200; // Position face in upper portion

            // Create a circular mask for more natural blending
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            
            // Draw original face in a circular area
            ctx.beginPath();
            ctx.arc(512, 350, faceSize/2, 0, Math.PI * 2);
            ctx.clip();
            
            // Scale and position the original image to fit the face area
            const sourceSize = Math.min(originalImg.width, originalImg.height);
            const sourceX = (originalImg.width - sourceSize) / 2;
            const sourceY = (originalImg.height - sourceSize) / 2;
            
            ctx.drawImage(
              originalImg,
              sourceX, sourceY, sourceSize, sourceSize, // Source rectangle (square from center)
              faceX, faceY, faceSize, faceSize // Destination rectangle
            );
            
            ctx.restore();

            // Add subtle blending around edges
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.1;
            
            // Draw a soft edge around the face area
            const gradient = ctx.createRadialGradient(512, 350, faceSize/2 - 20, 512, 350, faceSize/2);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(512, 350, faceSize/2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();

            // Convert to data URL
            const result = canvas.toDataURL('image/png', 0.95);
            resolve(result);

          } catch (error) {
            console.error('Error in canvas composition:', error);
            reject(new Error('Failed to compose final image'));
          }
        }
      };

      originalImg.onload = checkComplete;
      originalImg.onerror = () => reject(new Error('Failed to load original image'));
      
      backgroundImg.onload = checkComplete;
      backgroundImg.onerror = () => reject(new Error('Failed to load background image'));

      // Start loading images
      originalImg.src = originalImage;
      backgroundImg.src = backgroundImage;

    } catch (error) {
      console.error('Error in overlay function:', error);
      reject(new Error('Failed to overlay face on background'));
    }
  });
}