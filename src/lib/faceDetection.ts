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