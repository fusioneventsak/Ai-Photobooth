import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) {
    return;
  }

  try {
    console.log('Loading face-api.js models...');
    
    // Load lightweight models for face detection
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    
    modelsLoaded = true;
    console.log('✅ Face-api.js models loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load face-api.js models:', error);
    throw new Error('Failed to load face detection models');
  }
}

export async function detectFaces(imageElement: HTMLImageElement | HTMLCanvasElement): Promise<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection; }>[]> {
  if (!modelsLoaded) {
    await loadFaceApiModels();
  }

  try {
    const detections = await faceapi
      .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks();
    
    return detections;
  } catch (error) {
    console.error('Face detection failed:', error);
    throw new Error('Face detection failed');
  }
}

// Enhanced face mask generation with seamless blending
export async function generateSmartFaceMask(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  preserveFaces: boolean = true,
  featherRadius: number = 40,
  expansionFactor: number = 1.2
): Promise<string> {
  try {
    console.log('🎭 Generating smart face mask for SDXL...', {
      preserveFaces,
      featherRadius,
      expansionFactor
    });

    // Detect faces in the image
    const detections = await detectFaces(imageElement);
    
    if (detections.length === 0) {
      console.warn('⚠️ No faces detected, generating fallback mask');
      return generateFallbackMask(imageElement.width || 512, imageElement.height || 512);
    }

    console.log(`✅ Detected ${detections.length} face(s), generating seamless mask...`);

    // Create high-resolution canvas for mask generation
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.width || 1024;
    canvas.height = imageElement.height || 1024;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context for mask generation');
    }

    // Set base color based on preservation mode
    if (preserveFaces) {
      // White background = areas to modify, Black faces = areas to preserve
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      // Black background = areas to preserve, White faces = areas to modify
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Process each detected face with enhanced blending
    detections.forEach((detection, index) => {
      const box = detection.detection.box;
      const landmarks = detection.landmarks;
      
      console.log(`🎭 Processing face ${index + 1} with seamless blending:`, {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height)
      });

      // Calculate face region with more precise boundaries
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      
      // Use more conservative expansion to avoid circular artifacts
      const faceWidth = box.width * expansionFactor;
      const faceHeight = box.height * expansionFactor;
      
      // Create multiple gradient layers for seamless blending
      const createSeamlessGradient = (innerRadius: number, outerRadius: number, opacity: number) => {
        const gradient = ctx.createRadialGradient(
          centerX, centerY, innerRadius,
          centerX, centerY, outerRadius
        );
        
        if (preserveFaces) {
          gradient.addColorStop(0, `rgba(0, 0, 0, ${opacity})`);      // Solid preservation
          gradient.addColorStop(0.3, `rgba(32, 32, 32, ${opacity * 0.8})`);
          gradient.addColorStop(0.6, `rgba(96, 96, 96, ${opacity * 0.5})`);
          gradient.addColorStop(0.8, `rgba(160, 160, 160, ${opacity * 0.3})`);
          gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);         // Transparent edge
        } else {
          gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);  // Solid modification
          gradient.addColorStop(0.3, `rgba(224, 224, 224, ${opacity * 0.8})`);
          gradient.addColorStop(0.6, `rgba(160, 160, 160, ${opacity * 0.5})`);
          gradient.addColorStop(0.8, `rgba(96, 96, 96, ${opacity * 0.3})`);
          gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);              // Transparent edge
        }
        
        return gradient;
      };

      // Apply multiple blending layers for seamless transitions
      ctx.globalCompositeOperation = 'source-over';
      
      // Layer 1: Core face area (tighter)
      const coreRadius = Math.min(faceWidth, faceHeight) * 0.25;
      const midRadius = Math.min(faceWidth, faceHeight) * 0.4;
      ctx.fillStyle = createSeamlessGradient(coreRadius * 0.5, midRadius, 1.0);
      
      ctx.beginPath();
      ctx.ellipse(
        centerX, centerY,
        faceWidth * 0.4, faceHeight * 0.4,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      
      // Layer 2: Extended face area with heavy feathering
      const extendedRadius = Math.min(faceWidth, faceHeight) * 0.5;
      const featheredRadius = extendedRadius + featherRadius;
      ctx.fillStyle = createSeamlessGradient(midRadius, featheredRadius, 0.6);
      
      ctx.beginPath();
      ctx.ellipse(
        centerX, centerY,
        faceWidth * 0.5, faceHeight * 0.5,
        0, 0, Math.PI * 2
      );
      ctx.fill();

      // Enhanced landmark-based detail preservation
      if (preserveFaces && landmarks) {
        const enhanceFeature = (points: any[], featureName: string, scale: number = 1.0) => {
          if (points.length === 0) return;
          
          const featureCenter = points.reduce((acc, point) => ({
            x: acc.x + point.x,
            y: acc.y + point.y
          }), { x: 0, y: 0 });
          
          featureCenter.x /= points.length;
          featureCenter.y /= points.length;
          
          // Calculate feature bounds
          const minX = Math.min(...points.map(p => p.x));
          const maxX = Math.max(...points.map(p => p.x));
          const minY = Math.min(...points.map(p => p.y));
          const maxY = Math.max(...points.map(p => p.y));
          
          const featureWidth = (maxX - minX) * scale;
          const featureHeight = (maxY - minY) * scale;
          
          // Apply precise feature preservation
          const featureGradient = ctx.createRadialGradient(
            featureCenter.x, featureCenter.y, Math.min(featureWidth, featureHeight) * 0.2,
            featureCenter.x, featureCenter.y, Math.max(featureWidth, featureHeight) * 0.8
          );
          
          featureGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
          featureGradient.addColorStop(0.6, 'rgba(64, 64, 64, 0.8)');
          featureGradient.addColorStop(1, 'rgba(128, 128, 128, 0)');
          
          ctx.fillStyle = featureGradient;
          ctx.beginPath();
          ctx.ellipse(
            featureCenter.x, featureCenter.y,
            featureWidth / 2, featureHeight / 2,
            0, 0, Math.PI * 2
          );
          ctx.fill();
          
          console.log(`🎯 Enhanced ${featureName} preservation at (${Math.round(featureCenter.x)}, ${Math.round(featureCenter.y)})`);
        };
        
        // Enhance key facial features with precise preservation
        enhanceFeature(landmarks.getLeftEye(), 'left eye', 1.3);
        enhanceFeature(landmarks.getRightEye(), 'right eye', 1.3);
        enhanceFeature(landmarks.getNose(), 'nose', 1.2);
        enhanceFeature(landmarks.getMouth(), 'mouth', 1.1);
      }
    });

    // Apply post-processing blur for even smoother transitions
    ctx.filter = 'blur(2px)';
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';

    const maskDataUrl = canvas.toDataURL('image/png');
    console.log('✅ Seamless face mask generated successfully');
    
    return maskDataUrl;
  } catch (error) {
    console.error('❌ Mask generation failed:', error);
    throw error;
  }
}

// Enhanced fallback mask with natural blending
export function generateFallbackMask(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to create fallback mask canvas');
  }
  
  console.log('🔄 Generating enhanced fallback mask...');
  
  // White background = areas to modify
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  
  // Natural face positioning (avoid perfect center to prevent circular look)
  const centerX = width * 0.5;
  const centerY = height * 0.42; // Slightly higher for natural face position
  const radiusX = width * 0.22;  // More conservative sizing
  const radiusY = height * 0.28;
  
  // Create natural multi-layer gradient
  const layers = [
    { inner: 0.3, outer: 0.7, opacity: 1.0 },
    { inner: 0.5, outer: 1.0, opacity: 0.7 },
    { inner: 0.7, outer: 1.4, opacity: 0.4 }
  ];
  
  layers.forEach(layer => {
    const gradient = ctx.createRadialGradient(
      centerX, centerY, Math.min(radiusX, radiusY) * layer.inner,
      centerX, centerY, Math.max(radiusX, radiusY) * layer.outer
    );
    
    gradient.addColorStop(0, `rgba(0, 0, 0, ${layer.opacity})`);
    gradient.addColorStop(0.4, `rgba(64, 64, 64, ${layer.opacity * 0.8})`);
    gradient.addColorStop(0.7, `rgba(128, 128, 128, ${layer.opacity * 0.5})`);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX * layer.outer, radiusY * layer.outer, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Apply final smoothing
  ctx.filter = 'blur(3px)';
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';
  
  console.log('✅ Enhanced fallback mask generated');
  return canvas.toDataURL('image/png');
}

// Enhanced image preprocessing for better SDXL results
export function preprocessImageForSDXL(imageElement: HTMLImageElement): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to create preprocessing canvas');
    }
    
    // SDXL optimal resolution
    canvas.width = 1024;
    canvas.height = 1024;
    
    // Apply subtle preprocessing for better face results
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw with slight contrast enhancement
    ctx.filter = 'contrast(1.05) brightness(1.02) saturate(1.03)';
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    
    resolve(canvas.toDataURL('image/jpeg', 0.92));
  });
}

// Legacy function for backward compatibility
export function createFaceMask(
  canvas: HTMLCanvasElement,
  detections: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection; }>[]
): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Create white background (areas to modify)
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Create black masks for detected faces (areas to preserve)
  ctx.fillStyle = 'black';
  
  detections.forEach(detection => {
    const box = detection.detection.box;
    const expansion = 1.2;
    const expandedWidth = box.width * expansion;
    const expandedHeight = box.height * expansion;
    const x = box.x - (expandedWidth - box.width) / 2;
    const y = box.y - (expandedHeight - box.height) / 2;
    
    ctx.beginPath();
    ctx.ellipse(
      x + expandedWidth / 2,
      y + expandedHeight / 2,
      expandedWidth / 2,
      expandedHeight / 2,
      0, 0, Math.PI * 2
    );
    ctx.fill();
  });

  return canvas.toDataURL('image/png');
}