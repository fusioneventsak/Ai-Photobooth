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
      .detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();
    
    return detections;
  } catch (error) {
    console.error('Face detection failed:', error);
    throw new Error('Face detection failed');
  }
}

// Enhanced face mask generation for SDXL Inpainting
export async function generateSmartFaceMask(
  imageElement: HTMLImageElement | HTMLCanvasElement,
  preserveFaces: boolean = true,
  featherRadius: number = 25,
  expansionFactor: number = 1.4
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

    console.log(`✅ Detected ${detections.length} face(s), generating mask...`);

    // Create canvas for mask generation
    const canvas = document.createElement('canvas');
    canvas.width = imageElement.width || 512;
    canvas.height = imageElement.height || 512;
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

    // Process each detected face
    detections.forEach((detection, index) => {
      const box = detection.detection.box;
      const landmarks = detection.landmarks;
      
      console.log(`🎭 Processing face ${index + 1}:`, {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height)
      });

      // Calculate expanded face region
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const expandedWidth = box.width * expansionFactor;
      const expandedHeight = box.height * expansionFactor;
      
      // Create face mask with smooth edges
      const faceColor = preserveFaces ? 'black' : 'white';
      
      // Create radial gradient for smooth feathering
      const maxRadius = Math.max(expandedWidth, expandedHeight) / 2;
      const gradient = ctx.createRadialGradient(
        centerX, centerY, maxRadius * 0.6,  // Inner radius (solid)
        centerX, centerY, maxRadius + featherRadius  // Outer radius (feathered)
      );
      
      if (preserveFaces) {
        gradient.addColorStop(0, 'black');      // Solid preservation
        gradient.addColorStop(0.7, '#404040');  // Gradual transition
        gradient.addColorStop(1, 'white');      // Full modification
      } else {
        gradient.addColorStop(0, 'white');      // Solid modification
        gradient.addColorStop(0.7, '#C0C0C0');  // Gradual transition
        gradient.addColorStop(1, 'black');      // Full preservation
      }
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(
        centerX, centerY,
        expandedWidth / 2, expandedHeight / 2,
        0, 0, Math.PI * 2
      );
      ctx.fill();
      
      // Add additional detail preservation around key facial features
      if (preserveFaces && landmarks) {
        ctx.fillStyle = 'black';
        
        // Preserve eyes more strongly
        const leftEye = landmarks.getLeftEye();
        const rightEye = landmarks.getRightEye();
        
        [leftEye, rightEye].forEach(eye => {
          if (eye.length > 0) {
            const eyeCenter = eye.reduce((acc, point) => ({
              x: acc.x + point.x / eye.length,
              y: acc.y + point.y / eye.length
            }), { x: 0, y: 0 });
            
            ctx.beginPath();
            ctx.arc(eyeCenter.x, eyeCenter.y, 15, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        
        // Preserve mouth area
        const mouth = landmarks.getMouth();
        if (mouth.length > 0) {
          const mouthCenter = mouth.reduce((acc, point) => ({
            x: acc.x + point.x / mouth.length,
            y: acc.y + point.y / mouth.length
          }), { x: 0, y: 0 });
          
          ctx.beginPath();
          ctx.arc(mouthCenter.x, mouthCenter.y, 20, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    const maskDataUrl = canvas.toDataURL('image/png');
    console.log('✅ Smart face mask generated successfully for SDXL');
    
    return maskDataUrl;
    
  } catch (error) {
    console.error('❌ Smart face mask generation failed:', error);
    throw error;
  }
}

// Fallback mask generation when face detection fails
export function generateFallbackMask(width: number, height: number): string {
  console.log('🎭 Generating fallback mask...', { width, height });
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context for fallback mask');
  }

  // Create a center-focused mask for general face area
  // White background = areas to modify
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  
  // Black center area = area to preserve (likely face location)
  const centerX = width / 2;
  const centerY = height * 0.4; // Slightly higher than center for typical face position
  const radiusX = width * 0.25;
  const radiusY = height * 0.3;
  
  // Create gradient for smooth blending
  const gradient = ctx.createRadialGradient(
    centerX, centerY, Math.min(radiusX, radiusY) * 0.5,
    centerX, centerY, Math.max(radiusX, radiusY) * 1.2
  );
  gradient.addColorStop(0, 'black');    // Preserve center
  gradient.addColorStop(0.6, '#606060'); // Gradual transition
  gradient.addColorStop(1, 'white');     // Modify edges
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  
  console.log('✅ Fallback mask generated');
  return canvas.toDataURL('image/png');
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
    const landmarks = detection.landmarks;
    const jawLine = landmarks.getJawOutline();
    const leftEyebrow = landmarks.getLeftEyeBrow();
    const rightEyebrow = landmarks.getRightEyeBrow();
    
    // Create a more natural face outline using landmarks
    ctx.beginPath();
    
    // Start from jaw line
    jawLine.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    
    // Connect to eyebrows for a more natural face shape
    rightEyebrow.reverse().forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    
    leftEyebrow.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    
    ctx.closePath();
    ctx.fill();
    
    // Add some feathering around the face
    const centerX = detection.detection.box.x + detection.detection.box.width / 2;
    const centerY = detection.detection.box.y + detection.detection.box.height / 2;
    const radius = Math.max(detection.detection.box.width, detection.detection.box.height) * 0.6;
    
    const gradient = ctx.createRadialGradient(
      centerX, centerY, radius * 0.7,
      centerX, centerY, radius
    );
    gradient.addColorStop(0, 'black');
    gradient.addColorStop(0.5, '#808080');
    gradient.addColorStop(1, 'white');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  });

  return canvas.toDataURL('image/png');
}