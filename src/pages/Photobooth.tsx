// src/pages/Photobooth.tsx
// Enhanced Photobooth component with mobile optimization and improved face blending

import React, { useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, ImageIcon, Wand2, AlertCircle, Video, RefreshCw, Users, UserX, Lightbulb, Eye, User, Smartphone } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { uploadPhoto } from '../lib/supabase';
import { generateWithStability } from '../lib/stabilityService';
import { generateWithReplicate } from '../lib/replicateService';
import { 
  loadFaceApiModels, 
  generateSmartFaceMask, 
  generateFallbackMask 
} from '../lib/faceDetection';
import { shouldApplyOverlay, getActiveOverlay, applyOverlayToImage } from '../lib/overlayUtils';

interface ProcessingState {
  stage: 'detecting' | 'masking' | 'generating' | 'uploading' | 'complete';
  progress: number;
  message: string;
}

export default function Photobooth() {
  const { config } = useConfigStore();
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processedMedia, setProcessedMedia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentModelType, setCurrentModelType] = useState<'image' | 'video'>('image');
  const [generationAttempts, setGenerationAttempts] = useState(0);
  const [showInstructions, setShowInstructions] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadAttempts, setUploadAttempts] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    stage: 'detecting',
    progress: 0,
    message: 'Starting...'
  });
  const [cameraKey, setCameraKey] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const [capturedImageDimensions, setCapturedImageDimensions] = useState<{width: number, height: number} | null>(null);
  
  const webcamRef = React.useRef<Webcam>(null);

  // Enhanced mobile device detection
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);
      const isMobileWidth = window.innerWidth <= 768;
      const hasTouch = 'ontouchstart' in window;
      const isMobileDevice = isIOS || isAndroid || (isMobileWidth && hasTouch);
      
      setIsMobile(isMobileDevice);
      
      console.log('📱 Device detection:', {
        isIOS,
        isAndroid,
        isMobileWidth,
        hasTouch,
        finalDecision: isMobileDevice,
        userAgent: userAgent.substring(0, 50)
      });
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Add CSS for gradient animation and mobile enhancements
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes gradient-x {
        0%, 100% {
          background-size: 200% 200%;
          background-position: left center;
        }
        50% {
          background-size: 200% 200%;
          background-position: right center;
        }
      }
      .animate-gradient-x {
        animation: gradient-x 3s ease infinite;
      }
      
      /* Enhanced mobile-specific camera fixes */
      @media (max-width: 768px) {
        .mobile-camera-container {
          height: 70vh;
          min-height: 400px;
          max-height: 600px;
          position: relative;
        }
        
        .mobile-camera-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 12px;
        }
        
        /* iOS specific fixes for better camera quality */
        @supports (-webkit-touch-callout: none) {
          .ios-camera-fix {
            transform: scaleX(-1);
            -webkit-transform: scaleX(-1);
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
        }
        
        /* Android specific optimizations */
        .android-camera-fix {
          image-rendering: optimizeQuality;
          -webkit-image-rendering: optimizeQuality;
        }
      }
      
      /* Extra small screen breakpoint for header text */
      @media (max-width: 400px) {
        .xs\\:hidden {
          display: none !important;
        }
        .xs\\:inline {
          display: inline !important;
        }
      }
      
      /* Desktop camera styling */
      @media (min-width: 769px) {
        .desktop-camera-container {
          aspect-ratio: 1;
          max-width: 500px;
          margin: 0 auto;
        }
        
        .xs\\:hidden {
          display: inline !important;
        }
        .xs\\:inline {
          display: inline !important;
        }
      }
      
      /* Mobile portrait orientation optimization */
      @media (max-width: 768px) and (orientation: portrait) {
        .mobile-camera-container {
          height: 60vh;
          aspect-ratio: 3/4;
        }
      }
      
      /* Mobile landscape orientation optimization */
      @media (max-width: 768px) and (orientation: landscape) {
        .mobile-camera-container {
          height: 80vh;
          aspect-ratio: 4/3;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // FIXED: Proper face size preservation with optimal dimensions
  const resizeImageSmart = (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Cannot create canvas context'));
          return;
        }

        const { width, height } = img;
        const inputAspectRatio = width / height;
        
        console.log('📐 Original capture dimensions:', {
          width,
          height,
          aspectRatio: inputAspectRatio.toFixed(2),
          isMobile
        });
        
        // Store original dimensions for debug info
        setCapturedImageDimensions({ width, height });
        
        // FIXED: Use dimensions that maintain natural face sizes
        let targetWidth, targetHeight;
        
        if (isMobile) {
          // Mobile: Use 1024x1536 for good face detail without overshrinking
          targetWidth = 1024;
          targetHeight = 1536;
        } else {
          // Desktop: Use 1536x1024 for good face detail  
          targetWidth = 1536;
          targetHeight = 1024;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Maximum quality settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Fill with neutral background
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        
        // CRITICAL: Use standard fit scaling to maintain natural face proportions
        const scaleToFitWidth = targetWidth / width;
        const scaleToFitHeight = targetHeight / height;
        
        // Use the SMALLER scale to ensure entire image fits (preserves face proportions)
        const scale = Math.min(scaleToFitWidth, scaleToFitHeight);
        
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        
        // Center the image
        const offsetX = (targetWidth - scaledWidth) / 2;
        const offsetY = (targetHeight - scaledHeight) / 2;
        
        // Draw with natural proportions preserved
        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        
        const result = canvas.toDataURL('image/png', 0.98);
        
        console.log('✅ Natural face proportion resize completed:', {
          originalSize: `${width}x${height}`,
          targetSize: `${targetWidth}x${targetHeight}`,
          scale: scale.toFixed(3),
          scaledSize: `${Math.round(scaledWidth)}x${Math.round(scaledHeight)}`,
          offset: `${Math.round(offsetX)}, ${Math.round(offsetY)}`,
          naturalProportions: true,
          isMobile,
          dataSize: `${(result.length / 1024).toFixed(1)}KB`
        });
        
        resolve(result);
      };
      
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = dataUrl;
    });
  };

  // ENHANCED mobile face mask with FOREHEAD and full head coverage
  const generateMobileFaceMask = async (
    imageElement: HTMLImageElement,
    preserveFaces: boolean = true,
    featherRadius: number = 20,
    expansionFactor: number = 1.5 // Increased for full head coverage
  ): Promise<string> => {
    try {
      console.log('🎭 Generating FULL HEAD mobile face mask...', {
        preserveFaces,
        featherRadius,
        expansionFactor,
        isMobile,
        imageSize: `${imageElement.width}x${imageElement.height}`
      });

      // Load face detection models if not loaded
      await loadFaceApiModels();

      // ENHANCED mobile face detection settings for better small screen performance
      const detectionInputSize = isMobile ? 1024 : 640; // Much higher for mobile reliability
      const scoreThreshold = isMobile ? 0.2 : 0.4; // Much lower threshold for mobile
      
      const detections = await import('face-api.js').then(faceapi => 
        faceapi.detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions({
          inputSize: detectionInputSize,
          scoreThreshold: scoreThreshold
        })).withFaceLandmarks()
      );
      
      if (detections.length === 0) {
        console.warn('⚠️ No faces detected, generating enhanced mobile fallback mask');
        return generateMobileFallbackMask(
          imageElement.width || 512, 
          imageElement.height || 512
        );
      }

      console.log(`✅ Detected ${detections.length} face(s) with enhanced mobile detection`);

      const canvas = document.createElement('canvas');
      canvas.width = imageElement.width;
      canvas.height = imageElement.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context for mask generation');
      }

      // Base color setup
      if (preserveFaces) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // ENHANCED mobile face processing with FULL HEAD coverage
      detections.forEach((detection, index) => {
        const box = detection.detection.box;
        const landmarks = detection.landmarks;
        
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        
        // BALANCED expansion for natural face preservation
        const mobileExpansion = isMobile ? expansionFactor * 1.2 : expansionFactor; // 1.68x total for mobile
        const mobileFeather = isMobile ? featherRadius * 1.0 : featherRadius;
        
        // FULL HEAD coverage including forehead, hair, and chin
        const faceWidth = box.width * mobileExpansion;
        const faceHeight = box.height * mobileExpansion;
        
        // CRITICAL: Move center UP to include forehead properly
        const foreheadOffset = isMobile ? box.height * 0.15 : box.height * 0.1;
        const adjustedCenterY = centerY - foreheadOffset;
        
        console.log(`🎭 FULL HEAD mobile face ${index + 1}:`, {
          originalBox: `${Math.round(box.width)}x${Math.round(box.height)}`,
          fullHeadSize: `${Math.round(faceWidth)}x${Math.round(faceHeight)}`,
          expansion: `${(mobileExpansion * 100).toFixed(0)}%`,
          originalCenter: `${Math.round(centerX)}, ${Math.round(centerY)}`,
          adjustedCenter: `${Math.round(centerX)}, ${Math.round(adjustedCenterY)}`,
          foreheadOffset: Math.round(foreheadOffset),
          featherRadius: mobileFeather
        });
        
        // Create MAXIMUM preservation gradient for full head
        const createFullHeadGradient = (innerRadius: number, outerRadius: number) => {
          const gradient = ctx.createRadialGradient(
            centerX, adjustedCenterY, innerRadius,
            centerX, adjustedCenterY, outerRadius
          );
          
          if (preserveFaces) {
            // MAXIMUM full head preservation
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');        // 100% preserve core
            gradient.addColorStop(0.2, 'rgba(8, 8, 8, 0.98)');   // 98% preserve forehead
            gradient.addColorStop(0.4, 'rgba(16, 16, 16, 0.95)'); // 95% preserve hair
            gradient.addColorStop(0.6, 'rgba(32, 32, 32, 0.85)'); // 85% preserve outer
            gradient.addColorStop(0.75, 'rgba(64, 64, 64, 0.7)'); // 70% preserve edges
            gradient.addColorStop(0.85, 'rgba(128, 128, 128, 0.4)'); // 40% blend
            gradient.addColorStop(0.95, 'rgba(192, 192, 192, 0.15)'); // 15% blend
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');   // Transparent edge
          } else {
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.2, 'rgba(248, 248, 248, 0.98)');
            gradient.addColorStop(0.4, 'rgba(240, 240, 240, 0.95)');
            gradient.addColorStop(0.6, 'rgba(224, 224, 224, 0.85)');
            gradient.addColorStop(0.75, 'rgba(192, 192, 192, 0.7)');
            gradient.addColorStop(0.85, 'rgba(128, 128, 128, 0.4)');
            gradient.addColorStop(0.95, 'rgba(64, 64, 64, 0.15)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          }
          
          return gradient;
        };

        // Apply NATURAL face preservation mask
        const coreRadius = Math.min(faceWidth, faceHeight) * 0.25; // Natural core size
        const blendRadius = coreRadius + mobileFeather;
        
        ctx.fillStyle = createFullHeadGradient(coreRadius, blendRadius);
        ctx.beginPath();
        ctx.ellipse(
          centerX, adjustedCenterY, // Use adjusted center for forehead
          faceWidth * 0.5, faceHeight * 0.55, // Natural mask proportions
          0, 0, Math.PI * 2
        );
        ctx.fill();

        // ENHANCED landmark preservation with FOREHEAD emphasis
        if (preserveFaces && landmarks && isMobile) {
          const enhanceFullFeature = (points: any[], scale: number = 1.4, featureName: string) => {
            if (points.length === 0) return;
            
            const featureCenter = points.reduce((acc, point) => ({
              x: acc.x + point.x,
              y: acc.y + point.y
            }), { x: 0, y: 0 });
            
            featureCenter.x /= points.length;
            featureCenter.y /= points.length;
            
            const minX = Math.min(...points.map(p => p.x));
            const maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxY = Math.max(...points.map(p => p.y));
            
            // LARGER feature protection for mobile
            const featureWidth = (maxX - minX) * scale;
            const featureHeight = (maxY - minY) * scale;
            
            const featureGradient = ctx.createRadialGradient(
              featureCenter.x, featureCenter.y, Math.min(featureWidth, featureHeight) * 0.03,
              featureCenter.x, featureCenter.y, Math.max(featureWidth, featureHeight) * 0.7
            );
            
            // MAXIMUM feature preservation
            featureGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            featureGradient.addColorStop(0.2, 'rgba(4, 4, 4, 0.98)');
            featureGradient.addColorStop(0.4, 'rgba(16, 16, 16, 0.9)');
            featureGradient.addColorStop(0.7, 'rgba(64, 64, 64, 0.6)');
            featureGradient.addColorStop(1, 'rgba(128, 128, 128, 0)');
            
            ctx.fillStyle = featureGradient;
            ctx.beginPath();
            ctx.ellipse(
              featureCenter.x, featureCenter.y,
              featureWidth / 2, featureHeight / 2,
              0, 0, Math.PI * 2
            );
            ctx.fill();
            
            console.log(`👁️ ENHANCED ${featureName} preservation for mobile at (${Math.round(featureCenter.x)}, ${Math.round(featureCenter.y)})`);
          };
          
          // Apply NATURAL feature preservation for mobile
          enhanceFullFeature(landmarks.getLeftEye(), 1.3, 'left eye');
          enhanceFullFeature(landmarks.getRightEye(), 1.3, 'right eye');
          enhanceFullFeature(landmarks.getNose(), 1.2, 'nose');
          enhanceFullFeature(landmarks.getMouth(), 1.1, 'mouth');
          
          // CRITICAL: Add forehead preservation
          if (landmarks.positions && landmarks.positions.length > 0) {
            // Calculate forehead area from facial landmarks
            const eyePoints = [...landmarks.getLeftEye(), ...landmarks.getRightEye()];
            if (eyePoints.length > 0) {
              const avgEyeY = eyePoints.reduce((sum, point) => sum + point.y, 0) / eyePoints.length;
              const foreheadY = avgEyeY - (box.height * 0.3); // Forehead above eyes
              const foreheadX = centerX;
              
              // Create forehead preservation area
              const foreheadGradient = ctx.createRadialGradient(
                foreheadX, foreheadY, box.width * 0.1,
                foreheadX, foreheadY, box.width * 0.4
              );
              
              foreheadGradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
              foreheadGradient.addColorStop(0.5, 'rgba(32, 32, 32, 0.8)');
              foreheadGradient.addColorStop(1, 'rgba(128, 128, 128, 0)');
              
              ctx.fillStyle = foreheadGradient;
              ctx.beginPath();
              ctx.ellipse(
                foreheadX, foreheadY,
                box.width * 0.3, box.height * 0.2,
                0, 0, Math.PI * 2
              );
              ctx.fill();
              
              console.log(`🧠 FOREHEAD preservation added at (${Math.round(foreheadX)}, ${Math.round(foreheadY)})`);
            }
          }
        }
      });

      // Light blur for natural blending
      if (isMobile) {
        ctx.filter = 'blur(1px)'; // Natural blur for mobile
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'none';
      }

      const maskDataUrl = canvas.toDataURL('image/png');
      
      console.log('✅ FULL HEAD mobile face mask generated:', {
        faces: detections.length,
        maskSize: `${(maskDataUrl.length / 1024).toFixed(1)}KB`,
        fullHeadCoverage: true,
        foreheadPreserved: true,
        enhancedForMobile: isMobile,
        resolution: `${canvas.width}x${canvas.height}`
      });
      
      return maskDataUrl;
      
    } catch (error) {
      console.error('❌ Full head mobile face mask generation failed:', error);
      return generateMobileFallbackMask(512, 512);
    }
  };

  // Mobile-optimized fallback mask
  const generateMobileFallbackMask = (width: number, height: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Fill with white (areas to modify)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    
    // Create mobile-optimized center face area
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Adjust for mobile orientation and typical face positioning
    const isPortrait = height > width;
    let faceWidth, faceHeight;
    
    if (isMobile && isPortrait) {
      // Portrait mode - face typically in upper portion
      faceWidth = width * 0.35;
      faceHeight = height * 0.22; // Smaller height ratio for portrait
    } else if (isMobile && !isPortrait) {
      // Landscape mode
      faceWidth = width * 0.25;
      faceHeight = height * 0.4;
    } else {
      // Desktop fallback
      faceWidth = width * 0.35;
      faceHeight = height * 0.35;
    }
    
    const gradient = ctx.createRadialGradient(
      centerX, centerY, Math.min(faceWidth, faceHeight) * 0.2,
      centerX, centerY, Math.max(faceWidth, faceHeight) * 0.8
    );
    
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.4, 'rgba(64, 64, 64, 0.8)');
    gradient.addColorStop(0.7, 'rgba(128, 128, 128, 0.5)');
    gradient.addColorStop(0.9, 'rgba(192, 192, 192, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, faceWidth, faceHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Light blur for mobile
    if (isMobile) {
      ctx.filter = 'blur(2px)';
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
    }
    
    console.log('📱 Mobile fallback mask generated:', {
      dimensions: `${width}x${height}`,
      faceArea: `${Math.round(faceWidth)}x${Math.round(faceHeight)}`,
      isPortrait
    });
    
    return canvas.toDataURL('image/png');
  };

  // Environment variable checker for debugging
  useEffect(() => {
    const checkEnv = () => {
      console.log('🔍 Using secure Supabase Edge Functions for SDXL Inpainting');
      console.log('✅ API keys are now securely stored server-side');
      console.log('📱 Mobile optimization enabled:', isMobile);
    };
    
    checkEnv();
    
    loadFaceApiModels().catch(error => {
      console.warn('Failed to load face detection models:', error);
    });
  }, [isMobile]);

  // Update current model type when config changes
  useEffect(() => {
    if (config?.model_type) {
      if (currentModelType !== config.model_type) {
        setCurrentModelType(config.model_type);
        reset();
      }
    }
  }, [config?.model_type, currentModelType]);

  // Cleanup Blobs when component unmounts or model changes
  useEffect(() => {
    return () => {
      if (processedMedia && processedMedia.startsWith('blob:')) {
        URL.revokeObjectURL(processedMedia);
      }
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    };
  }, [processedMedia, progressInterval]);

  // AUTOMATIC UPLOAD - Triggers immediately after each photo generation
  useEffect(() => {
    if (!processedMedia || !config) {
      return;
    }

    console.log('📸 NEW PHOTO GENERATED - Starting automatic upload');
    
    const automaticUploadNow = async () => {
      try {
        setUploading(true);
        setProcessingState({ stage: 'uploading', progress: 90, message: 'Saving to gallery...' });
        
        console.log('📤 Auto-uploading new photo...');
        console.log('📊 Photo details:', {
          length: processedMedia.length,
          type: processedMedia.startsWith('data:') ? 'data URL' : processedMedia.startsWith('blob:') ? 'blob URL' : 'unknown',
          modelType: currentModelType
        });
        
        const uploadResult = await uploadPhoto(
          processedMedia,
          config.global_prompt || 'AI Generated Image',
          currentModelType
        );
        
        if (uploadResult) {
          console.log('✅ Auto-upload successful:', uploadResult.id);
          
          window.dispatchEvent(new CustomEvent('galleryUpdate', {
            detail: { 
              newPhoto: uploadResult,
              source: 'automatic_after_generation'
            }
          }));
          
          setUploadSuccess(true);
          setProcessingState({ stage: 'complete', progress: 100, message: 'Complete!' });
          setTimeout(() => setUploadSuccess(false), 2000);
          
          console.log('🎯 Gallery should update now with new photo');
          
        } else {
          console.error('❌ Auto-upload returned null');
        }
        
      } catch (error) {
        console.error('❌ Auto-upload failed:', error);
      } finally {
        setUploading(false);
      }
    };

    automaticUploadNow();
  }, [processedMedia, config, currentModelType]);

  // Smooth progress animation function
  const animateProgress = (startProgress: number, endProgress: number, duration: number, stage: ProcessingState['stage'], message: string) => {
    return new Promise<void>((resolve) => {
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      const startTime = Date.now();
      const progressDiff = endProgress - startProgress;
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentProgress = startProgress + (progressDiff * easeProgress);
        
        setProcessingState({
          stage,
          progress: Math.round(currentProgress),
          message
        });
        
        if (progress >= 1) {
          clearInterval(interval);
          setProgressInterval(null);
          resolve();
        }
      }, 50);
      
      setProgressInterval(interval);
    });
  };

  const capturePhoto = React.useCallback(() => {
    try {
      setError(null);
      
      if (!webcamRef.current || !cameraReady) {
        throw new Error('Camera not ready. Please wait a moment and try again.');
      }
      
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture photo. Please ensure camera permissions are granted and try again.');
      }
      
      if (!imageSrc.startsWith('data:image/')) {
        throw new Error('Invalid image format captured. Please try again.');
      }
      
      console.log('📷 Photo captured:', {
        format: imageSrc.substring(0, 30) + '...',
        size: imageSrc.length,
        isMobile
      });
      
      setMediaData(imageSrc);
      setProcessedMedia(null);
      setGenerationAttempts(0);
      setShowInstructions(false);
      setDebugInfo(null);
      setProcessingState({ stage: 'detecting', progress: 0, message: 'Photo captured! Starting AI generation...' });
      
      setTimeout(() => {
        processMediaWithCapturedPhoto(imageSrc);
      }, 500);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture photo';
      console.error('Error capturing photo:', err);
      setError(errorMessage);
      setMediaData(null);
    }
  }, [cameraReady]);

  const reset = () => {
    setMediaData(null);
    setProcessedMedia(null);
    setError(null);
    setGenerationAttempts(0);
    setShowInstructions(true);
    setUploading(false);
    setUploadSuccess(false);
    setUploadAttempts(0);
    setDebugInfo(null);
    setCapturedImageDimensions(null);
    setProcessingState({ stage: 'detecting', progress: 0, message: 'Ready...' });
    setCameraReady(false);
    
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    
    if (processedMedia && processedMedia.startsWith('blob:')) {
      URL.revokeObjectURL(processedMedia);
    }
    
    sessionStorage.clear();
    setCameraKey(prev => prev + 1);
    console.log('🔄 Camera reset - forcing re-initialization');
  };

  const handleWebcamError = (err: string | DOMException) => {
    const errorMessage = err instanceof DOMException ? err.message : err;
    console.error('Webcam error:', errorMessage);
    setError(`Camera error: ${errorMessage}`);
    setCameraReady(false);
    
    setTimeout(() => {
      setCameraKey(prev => prev + 1);
      console.log('🔄 Attempting camera recovery...');
    }, 1000);
  };

  const getErrorIcon = (error: string) => {
    if (error.includes('API') || error.includes('key')) return '🔑';
    if (error.includes('credits') || error.includes('balance')) return '💳';
    if (error.includes('network') || error.includes('connection')) return '🌐';
    if (error.includes('timeout')) return '⏱️';
    if (error.includes('rate limit')) return '🚦';
    return '❌';
  };

  const ErrorDisplay = ({ error, attempts }: { error: string; attempts: number }) => (
    <div className="text-center p-6">
      <div className="text-4xl mb-3">{getErrorIcon(error)}</div>
      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
      <p className="text-red-500 max-w-sm mx-auto text-sm">{error}</p>
      {debugInfo && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-left">
          <p className="text-red-400 text-xs font-mono break-all">
            Debug: {JSON.stringify(debugInfo, null, 2)}
          </p>
        </div>
      )}
      {attempts > 0 && attempts < 3 && (
        <div className="mt-4">
          <p className="text-gray-400 text-xs">
            You can try again ({3 - attempts} attempts remaining)
          </p>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div 
              className="bg-red-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(attempts / 3) * 100}%` }}
            />
          </div>
        </div>
      )}
      {attempts >= 3 && (
        <p className="text-yellow-500 text-xs mt-2">
          Maximum attempts reached. Please capture a new photo.
        </p>
      )}
    </div>
  );

  const ProcessingIndicator = ({ state }: { state: ProcessingState }) => (
    <div className="text-center space-y-4">
      <div className="relative">
        <Wand2 className="w-20 h-20 mx-auto text-purple-400 animate-pulse" />
        <div className="absolute inset-0 w-20 h-20 mx-auto">
          <div className="w-full h-full rounded-full border-4 border-purple-500/30 animate-ping"></div>
        </div>
        <div className="absolute inset-2 w-16 h-16 mx-auto">
          <div className="w-full h-full rounded-full border-2 border-blue-400/50 animate-spin"></div>
        </div>
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
        <div className="absolute -bottom-2 -left-2 w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute top-4 -left-4 w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="text-lg font-medium text-white animate-pulse">{state.message}</div>
      
      <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
        <div 
          className="h-4 rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 animate-gradient-x" 
          style={{ width: `${state.progress}%` }}
        />
      </div>
      
      <div className="text-sm text-gray-300">{state.progress}% Complete</div>
      
      <div className="text-sm text-purple-300 flex items-center justify-center gap-2">
        {state.stage === 'detecting' && (
          <>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <span>🔍 {isMobile ? 'Mobile-optimized analysis...' : 'Preparing your photo with AI magic...'}</span>
          </>
        )}
        {state.stage === 'masking' && (
          <>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <span>🎭 {isMobile ? 'Enhanced mobile face blending...' : 'Crafting the perfect face blend...'}</span>
          </>
        )}
        {state.stage === 'generating' && (
          <>
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-spin"></div>
            <span>✨ Creating AI magic with SDXL...</span>
          </>
        )}
        {state.stage === 'uploading' && (
          <>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
            <span>📤 Adding to your gallery...</span>
          </>
        )}
        {state.stage === 'complete' && (
          <>
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>🎉 Magic complete!</span>
          </>
        )}
      </div>
    </div>
  );

  /**
   * Apply overlay to the generated AI image if one is configured
   */
  const applyConfiguredOverlay = async (generatedImageData: string): Promise<string> => {
    try {
      // Check if overlay should be applied
      if (!shouldApplyOverlay()) {
        console.log('🎨 No overlay configured, returning original image');
        return generatedImageData;
      }

      const overlayConfig = getActiveOverlay();
      if (!overlayConfig) {
        console.log('🎨 No active overlay found, returning original image');
        return generatedImageData;
      }

      console.log('🎨 Applying overlay to AI generated image:', {
        overlayName: overlayConfig.name,
        overlayType: overlayConfig.type,
        borderId: overlayConfig.borderId,
        aspectRatio: overlayConfig.aspectRatio
      });

      // Apply the overlay
      const imageWithOverlay = await applyOverlayToImage(generatedImageData, overlayConfig);
      
      console.log('✅ Overlay applied successfully to AI image');
      return imageWithOverlay;

    } catch (error) {
      console.error('❌ Failed to apply overlay to AI image:', error);
      // Return original image if overlay fails
      return generatedImageData;
    }
  };

  const processMediaWithCapturedPhoto = React.useCallback(async (capturedImageData: string) => {
    if (!capturedImageData) {
      setError('No photo captured');
      return;
    }

    let currentConfig = config;
    if (!currentConfig) {
      console.log('⏳ Config not loaded yet, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      currentConfig = useConfigStore.getState().config;
    }

    if (!currentConfig) {
      setError('Application configuration failed to load. Please refresh the page and try again.');
      return;
    }

    if (generationAttempts >= 3) {
      setError('Maximum generation attempts reached. Please try capturing a new photo.');
      return;
    }

    setProcessing(true);
    setError(null);
    setDebugInfo(null);

    try {
      setGenerationAttempts(prev => prev + 1);

      console.log('🚀 Starting SDXL Inpainting generation process...', {
        isMobile,
        attempt: generationAttempts + 1
      });
      console.log('📋 Generation details:', {
        prompt: currentConfig.global_prompt,
        modelType: currentModelType,
        faceMode: currentConfig.face_preservation_mode || 'preserve_face',
        attempt: generationAttempts + 1,
        mobileOptimized: isMobile
      });

      await animateProgress(0, 15, 1000, 'detecting', isMobile ? 'Analyzing mobile photo...' : 'Analyzing your photo...');
      console.log('🖼️ Smart resizing for proper aspect ratios...');
      const processedContent = await resizeImageSmart(capturedImageData);
      
      if (!processedContent || !processedContent.startsWith('data:image/')) {
        throw new Error('Image resizing failed - invalid output format');
      }
      
      console.log('✅ Smart image resize for SDXL:', {
        originalSize: capturedImageData.length,
        processedSize: processedContent.length,
        resolution: 'Optimized for SDXL',
        mobileOptimized: isMobile
      });

      await animateProgress(15, 35, 1500, 'masking', isMobile ? 'Mobile-optimized face detection...' : 'Detecting facial features...');
      
      let maskData: string | undefined;
      const faceMode = currentConfig.face_preservation_mode || 'preserve_face';
      
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image for face detection'));
          img.src = processedContent;
        });

        console.log('🔍 Generating mobile-optimized face-only mask (excluding clothing)...');
        
        // Use OPTIMAL mask generation for natural face size preservation
        maskData = await generateMobileFaceMask(
          img,
          faceMode === 'preserve_face',
          isMobile ? 15 : 25, // Moderate feathering for natural blending
          isMobile ? 1.4 : 1.3 // Generous but not excessive expansion
        );
        
        console.log('✅ Mobile-optimized face mask generated successfully for SDXL');
        
      } catch (faceDetectionError) {
        console.warn('⚠️ Face detection failed, using mobile-optimized fallback mask:', faceDetectionError);
        
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image for fallback mask'));
          img.src = processedContent;
        });
        
        maskData = generateMobileFallbackMask(img.naturalWidth, img.naturalHeight);
        console.log('✅ Mobile-optimized fallback mask generated for SDXL');
      }

      await animateProgress(35, 45, 800, 'generating', 'Preparing AI magic...');
      
      console.log('🎨 Starting SDXL Inpainting generation with mobile optimizations...');
      
      let aiContent: string;

      if (currentModelType === 'video') {
        await animateProgress(45, 60, 2000, 'generating', 'Initializing video AI...');
        
        console.log('🎬 Starting video generation with Replicate...');
        
        const videoPromise = generateWithReplicate({
          prompt: currentConfig.global_prompt || 'AI Generated Video',
          inputData: processedContent,
          type: 'video',
          duration: currentConfig.video_duration || 5,
          preserveFace: faceMode === 'preserve_face'
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Video generation timed out. Please try again.')), 300000);
        });

        const progressPromise = async () => {
          await animateProgress(60, 75, 8000, 'generating', 'Generating video frames...');
          await animateProgress(75, 85, 6000, 'generating', 'Applying face preservation...');
          await animateProgress(85, 90, 4000, 'generating', 'Finalizing video...');
          return await videoPromise;
        };

        let rawAiContent = await Promise.race([progressPromise(), timeoutPromise]);
        
        // Note: Overlays for video will be applied as a frame overlay in future versions
        // For now, we skip overlay application for videos
        aiContent = rawAiContent;
      } else {
        await animateProgress(45, 55, 1200, 'generating', 'Loading SDXL model...');
        
        const basePrompt = currentConfig.global_prompt || 'AI Generated Portrait';
        const enhancedPrompt = faceMode === 'preserve_face' 
          ? `${basePrompt}, photorealistic portrait, preserve facial features only, exclude clothing and collars, natural skin texture, detailed eyes and mouth, face-focused composition, no shirts or ties visible, professional headshot style, 8k quality${isMobile ? ', mobile photography, sharp details' : ''}`
          : `${basePrompt}, creative character transformation, artistic interpretation, detailed facial features, no clothing elements from original${isMobile ? ', mobile-optimized rendering' : ''}`;

        console.log(`🎭 Using ${faceMode} mode with clothing-free SDXL Inpainting (mobile: ${isMobile})...`);
        console.log('🎯 Enhanced prompt (clothing exclusion + mobile optimization):', enhancedPrompt);
        
        await animateProgress(55, 70, 1500, 'generating', isMobile ? 'Processing with mobile-optimized SDXL...' : 'Processing with SDXL AI...');
        
        // NATURAL face size preservation parameters
        const mobileStrength = isMobile ? 
          (faceMode === 'preserve_face' ? 0.3 : 0.6) : // Natural strength for proper face scale
          (faceMode === 'preserve_face' ? 0.4 : 0.7);
        
        const generationPromise = generateWithStability({
          prompt: enhancedPrompt,
          imageData: processedContent,
          mode: 'inpaint',
          maskData: maskData,
          facePreservationMode: faceMode,
          strength: mobileStrength,
          cfgScale: isMobile ? 7.0 : 8.0, // Balanced CFG for natural results
          steps: 25,
          useControlNet: currentConfig.use_controlnet ?? true,
          controlNetType: currentConfig.controlnet_type || 'auto'
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('SDXL Inpainting generation timed out. Please try again.')), 180000);
        });

        const progressPromise = async () => {
          await animateProgress(70, 80, 3000, 'generating', isMobile ? 'Mobile AI transformation...' : 'Applying AI transformation...');
          await animateProgress(80, 88, 2500, 'generating', 'Refining details...');
          await animateProgress(88, 90, 1000, 'generating', 'Almost done...');
          return await generationPromise;
        };

        let rawAiContent = await Promise.race([progressPromise(), timeoutPromise]);
        
        // CRITICAL: Apply overlay BEFORE setting final content
        console.log('🎨 Applying overlay to AI generated content...');
        await animateProgress(90, 95, 800, 'uploading', 'Applying overlay...');
        aiContent = await applyConfiguredOverlay(rawAiContent);
      }
      
      await animateProgress(95, 98, 500, 'generating', 'Validating result...');
      
      if (!aiContent) {
        throw new Error('Generated content is empty. Please try again.');
      }

      if (!aiContent.startsWith('data:') && !aiContent.startsWith('blob:')) {
        console.error('❌ Invalid AI content format:', aiContent.substring(0, 100));
        throw new Error('Invalid AI content format received.');
      }

      console.log('🔍 Validating SDXL generated content...', {
        contentType: typeof aiContent,
        length: aiContent.length,
        startsWithData: aiContent.startsWith('data:'),
        preview: aiContent.substring(0, 100) + '...',
        mobileOptimized: isMobile
      });

      if (aiContent.startsWith('data:')) {
        const testImg = new Image();
        await new Promise<void>((resolve, reject) => {
          testImg.onload = () => {
            console.log('✅ SDXL generated image loads successfully:', {
              width: testImg.width,
              height: testImg.height,
              model: 'SDXL Inpainting',
              mobileOptimized: isMobile
            });
            resolve();
          };
          testImg.onerror = () => {
            console.error('❌ SDXL generated image failed to load!');
            reject(new Error('Generated image is corrupted'));
          };
          testImg.src = aiContent;
          
          setTimeout(() => {
            reject(new Error('Image validation timeout'));
          }, 5000);
        });
      }

      await animateProgress(98, 100, 600, 'uploading', 'Finalizing magic...');

      console.log('✅ SDXL Inpainting generation completed successfully:', {
        type: currentModelType,
        format: aiContent.startsWith('data:') ? 'data URL' : 'blob URL',
        size: aiContent.length,
        faceMode: faceMode,
        model: 'SDXL Inpainting',
        mobileOptimized: isMobile
      });

      setProcessedMedia(aiContent);
      setError(null);

      console.log('🎯 SDXL Inpainting process completed - automatic upload should trigger via useEffect');

    } catch (error) {
      console.error('❌ === SDXL INPAINTING GENERATION FAILED ===');
      console.error('📊 Generation error details:', error);

      let errorMessage = 'Failed to generate AI content with SDXL Inpainting. Please try again.';
      let debugDetails: any = null;
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('edge function returned a non-2xx status code')) {
          errorMessage = 'Server configuration issue. Please check your Stability AI API settings.';
          debugDetails = {
            issue: 'Edge Function Error',
            suggestion: 'Check STABILITY_API_KEY in Supabase Edge Functions',
            errorType: 'server_error',
            mobile: isMobile
          };
        } else if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
          errorMessage = 'API authentication failed. Please check your Stability AI API key.';
          debugDetails = { errorType: 'auth_error', mobile: isMobile };
        } else if (message.includes('credits') || message.includes('insufficient') || message.includes('402')) {
          errorMessage = 'Insufficient Stability AI credits. Please check your account balance.';
          debugDetails = { errorType: 'credits_error', mobile: isMobile };
        } else if (message.includes('rate limit') || message.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          debugDetails = { errorType: 'rate_limit_error', mobile: isMobile };
        } else if (message.includes('timeout')) {
          errorMessage = 'SDXL generation timed out. Please try again with a simpler prompt.';
          debugDetails = { errorType: 'timeout_error', mobile: isMobile };
        } else if (message.includes('face detection')) {
          errorMessage = isMobile ? 
            'Mobile face detection failed. Please ensure good lighting and face the camera directly.' :
            'Face detection failed. Please ensure the photo shows clear facial features.';
          debugDetails = { errorType: 'face_detection_error', mobile: isMobile };
        } else if (message.includes('mask')) {
          errorMessage = 'Mask generation failed. Please try taking a new photo.';
          debugDetails = { errorType: 'mask_error', mobile: isMobile };
        } else {
          errorMessage = `SDXL Inpainting error: ${error.message}`;
          debugDetails = { errorType: 'general_error', originalMessage: error.message, mobile: isMobile };
        }
      }

      setError(errorMessage);
      setDebugInfo(debugDetails);
      setProcessedMedia(null);
      
    } finally {
      setProcessing(false);
    }
  }, [currentModelType, generationAttempts, config, animateProgress, isMobile]);

  // Enhanced mobile video constraints for better face capture
  const getMobileVideoConstraintsEnhanced = () => {
    if (!isMobile) {
      return {
        width: 1280,
        height: 720,
        facingMode: "user"
      };
    }

    // Optimized for mobile face capture
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    
    return {
      width: { ideal: isIOS ? 1280 : 1920, max: 1920 },
      height: { ideal: isIOS ? 720 : 1080, max: 1920 },
      facingMode: "user",
      frameRate: { ideal: 30, max: 30 },
      // Enhanced mobile camera settings
      ...(isIOS ? {
        // iOS optimizations
        exposureMode: "continuous",
        whiteBalanceMode: "continuous",
        focusMode: "continuous"
      } : {
        // Android optimizations  
        aspectRatio: { ideal: 1.777 } // 16:9
      })
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div 
        className="border-b border-gray-700/50 backdrop-blur-sm sticky top-0 z-10 shadow-xl"
        style={{ 
          backgroundColor: config?.header_bg_color || 'rgba(31, 41, 55, 0.9)',
          borderBottomColor: config?.primary_color ? `${config.primary_color}30` : undefined
        }}
      >
        <div className="container mx-auto px-3 py-3 max-w-lg">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg sm:text-2xl font-bold flex items-center gap-2 min-w-0 flex-shrink">
              <Camera className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0" style={{ color: config?.primary_color }} />
              <span className="truncate">{config?.brand_name || 'AI Photobooth'}</span>
            </h1>
            <div className="flex items-center gap-1 flex-wrap">
              <div className="bg-gray-800 px-2 py-1 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                {currentModelType === 'video' ? (
                  <>
                    <Video className="w-3 h-3 text-purple-400 flex-shrink-0" />
                    <span className="hidden xs:inline">Video Mode</span>
                    <span className="xs:hidden">Video</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    <span className="hidden xs:inline">SDXL Image</span>
                    <span className="xs:hidden">SDXL</span>
                  </>
                )}
              </div>
              
              <div className="bg-gray-800 px-2 py-1 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                {config?.face_preservation_mode === 'preserve_face' ? (
                  <>
                    <Users className="w-3 h-3 text-green-400 flex-shrink-0" />
                    <span className="text-green-400 hidden xs:inline">Face Preserved</span>
                    <span className="text-green-400 xs:hidden">Face+</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3 h-3 text-orange-400 flex-shrink-0" />
                    <span className="text-orange-400 hidden xs:inline">New Character</span>
                    <span className="text-orange-400 xs:hidden">New</span>
                  </>
                )}
              </div>
              
              {isMobile && (
                <div className="bg-gray-800 px-2 py-1 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                  <Smartphone className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <span className="text-blue-400 hidden xs:inline">Mobile+</span>
                  <span className="text-blue-400 xs:hidden">📱</span>
                </div>
              )}
              
              {processedMedia && (
                <div className="bg-gray-800 px-2 py-1 rounded-lg text-xs flex items-center gap-1 whitespace-nowrap">
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400 flex-shrink-0" />
                      <span className="text-blue-400 hidden xs:inline">Saving...</span>
                      <span className="text-blue-400 xs:hidden">💾</span>
                    </>
                  ) : uploadSuccess ? (
                    <>
                      <ImageIcon className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="text-green-400 hidden xs:inline">Saved!</span>
                      <span className="text-green-400 xs:hidden">✅</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {config?.global_prompt && (
            <p className="text-gray-300 text-xs sm:text-sm mt-2 px-1 leading-relaxed break-words">
              {config.global_prompt}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        {showInstructions && !mediaData && (
          <div className="mb-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              {isMobile ? 'Mobile SDXL Tips' : 'Get the Best SDXL Results'}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">{isMobile ? 'Good Mobile Lighting:' : 'Good Lighting:'}</span>
                  <span className="text-gray-300"> {isMobile ? 'Use natural light, avoid harsh shadows on your face' : 'Face the light source, avoid harsh shadows'}</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">{isMobile ? 'Hold Steady:' : 'Face the Camera:'}</span>
                  <span className="text-gray-300"> {isMobile ? 'Keep phone steady, look directly at front camera' : 'Look directly at the lens for optimal face detection'}</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Face-Only Preservation:</span>
                  <span className="text-gray-300"> Only facial features preserved, clothing like collars and ties excluded</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wand2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">{isMobile ? 'Mobile SDXL:' : 'SDXL Inpainting:'}</span>
                  <span className="text-gray-300"> {isMobile ? 'Optimized AI processing for mobile photos' : 'Advanced AI for superior face preservation'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gray-800 rounded-xl overflow-hidden mb-6 shadow-2xl">
          <div className={`bg-black relative ${isMobile ? 'mobile-camera-container' : 'desktop-camera-container aspect-square'}`}>
            {processedMedia ? (
              currentModelType === 'video' ? (
                <video
                  src={processedMedia}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className={`w-full h-full ${isMobile ? 'object-cover' : 'object-contain'}`}
                />
              ) : (
                <img
                  src={processedMedia}
                  alt="SDXL Generated"
                  className={`w-full h-full ${isMobile ? 'object-cover' : 'object-contain'}`}
                />
              )
            ) : processing || (mediaData && !error) ? (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <div className="text-center max-w-sm mx-auto p-8">
                  <ProcessingIndicator state={processingState} />
                </div>
              </div>
            ) : error ? (
              <ErrorDisplay error={error} attempts={generationAttempts} />
            ) : (
              <Webcam
                key={cameraKey}
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/png"
                screenshotQuality={0.95}
                className={`w-full h-full ${
                  isMobile 
                    ? 'mobile-camera-preview ios-camera-fix android-camera-fix object-cover' 
                    : 'object-cover'
                }`}
                videoConstraints={getMobileVideoConstraintsEnhanced()}
                onUserMedia={() => {
                  console.log('✅ Webcam initialized successfully with mobile optimizations:', {
                    cameraKey,
                    isMobile,
                    constraints: getMobileVideoConstraintsEnhanced()
                  });
                  setCameraReady(true);
                  setError(null);
                }}
                onUserMediaError={handleWebcamError}
                mirrored={isMobile}
              />
            )}
            
            {processedMedia && (
              <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-purple-400" />
                <span className="text-purple-400">SDXL {isMobile ? 'Mobile+' : 'Generated'}</span>
                {uploading && (
                  <RefreshCw className="w-3 h-3 text-blue-400 animate-spin ml-1" />
                )}
              </div>
            )}
            
            {processing && (
              <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-purple-400 animate-spin" />
                <span className="text-purple-400">{isMobile ? 'Mobile AI...' : 'AI Processing...'}</span>
              </div>
            )}
            
            {isMobile && !mediaData && !processedMedia && !processing && (
              <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <Smartphone className="w-3 h-3 text-green-400" />
                <span className="text-green-400">📱 Mobile Optimized</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {!mediaData && !processing && !processedMedia ? (
            <button
              onClick={capturePhoto}
              disabled={!!error || !cameraReady}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-xl hover:opacity-90 transition disabled:opacity-50 text-lg font-semibold shadow-lg"
              style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
            >
              <Camera className="w-7 h-7" />
              {!cameraReady ? 
                (isMobile ? 'Initializing Mobile Camera...' : 'Initializing Camera...') : 
                (isMobile ? 'Take Mobile Photo' : 'Take Photo')
              }
            </button>
          ) : processing ? (
            <div className="text-center text-sm text-gray-400 bg-gray-800/50 rounded-lg p-4">
              <Wand2 className="w-6 h-6 animate-spin text-purple-400 mx-auto mb-2" />
              <span className="text-purple-400">
                {isMobile ? 'Mobile AI is creating your magic...' : 'AI is creating your magic...'}
              </span>
            </div>
          ) : processedMedia ? (
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gray-600 rounded-xl hover:bg-gray-700 transition font-medium"
            >
              <Camera className="w-5 h-5" />
              {isMobile ? 'Take New Mobile Photo' : 'Take New Photo'}
            </button>
          ) : null}

          {processedMedia && (
            <div className="text-center text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3">
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400 inline mr-2" />
                  <span className="text-blue-400">
                    Saving to Gallery... {uploadAttempts > 0 && `(${uploadAttempts}/3)`}
                  </span>
                </>
              ) : uploadSuccess ? (
                <>
                  <ImageIcon className="w-4 h-4 text-green-400 inline mr-2" />
                  <span className="text-green-400">Saved to Gallery!</span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {(process.env.NODE_ENV === 'development' || debugInfo) && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg text-xs text-gray-400 space-y-2">
            <p><span className="text-purple-400 font-semibold">Model:</span> SDXL Inpainting + ControlNet</p>
            <p><span className="text-blue-400 font-semibold">Mode:</span> {currentModelType}</p>
            <p><span className="text-green-400 font-semibold">Face Mode:</span> {config?.face_preservation_mode || 'preserve_face'}</p>
            <p><span className="text-yellow-400 font-semibold">Attempts:</span> {generationAttempts}/3</p>
            <p><span className="text-indigo-400 font-semibold">Strength:</span> {
              isMobile ? 
                (config?.face_preservation_mode === 'preserve_face' ? '0.3 (Natural)' : '0.6 (Mobile)') :
                (config?.face_preservation_mode === 'preserve_face' ? '0.4 (Natural)' : '0.7')
            }</p>
            <p><span className="text-pink-400 font-semibold">CFG Scale:</span> {isMobile ? '7.0 (Balanced)' : '8.0'}</p>
            <p><span className="text-cyan-400 font-semibold">Resolution:</span> {
              capturedImageDimensions ? 
                `${capturedImageDimensions.width}x${capturedImageDimensions.height} → ${isMobile ? '1024x1536 (Natural)' : '1536x1024 (Natural)'}` :
                `${isMobile ? '1024x1536' : '1536x1024'} (Face-Optimized)`
            }</p>
            <p><span className="text-orange-400 font-semibold">Steps:</span> 25 (SDXL Optimized)</p>
            <p><span className="text-teal-400 font-semibold">Approach:</span> Face-Only (No Clothing) {isMobile && '+ Mobile+'}</p>
            <p><span className="text-violet-400 font-semibold">Mask Settings:</span> {
              isMobile ? '15px feather, 1.4x expansion, Natural face preservation' : '25px feather, 1.3x expansion, balanced'
            }</p>
            <p><span className="text-red-400 font-semibold">Camera Key:</span> {cameraKey} {isMobile && '(Mobile Mode)'}</p>
            <p><span className="text-lime-400 font-semibold">Device:</span> {
              isMobile ? 
                `Mobile (${navigator.userAgent.includes('iPhone') ? 'iOS' : navigator.userAgent.includes('Android') ? 'Android' : 'Mobile'})` :
                'Desktop'
            }</p>
            {capturedImageDimensions && (
              <p><span className="text-emerald-400 font-semibold">Capture:</span> {
                capturedImageDimensions.width}x{capturedImageDimensions.height} (AR: {
                (capturedImageDimensions.width / capturedImageDimensions.height).toFixed(2)
              }) {capturedImageDimensions.height > capturedImageDimensions.width ? '📱 Portrait' : '🖥️ Landscape'}
              </p>
            )}
            {debugInfo && (
              <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded">
                <p className="text-red-400 font-mono text-xs">
                  {JSON.stringify(debugInfo, null, 2)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}