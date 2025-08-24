// src/pages/Photobooth.tsx
// FIXED VERSION - Properly routes Image->Stability, Video->Replicate

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
  
  const webcamRef = React.useRef<Webcam>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);
      const isMobileDevice = isIOS || isAndroid || window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Add CSS for gradient animation
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
      
      /* Mobile-specific camera fixes */
      @media (max-width: 768px) {
        .mobile-camera-container {
          height: 100vw;
          max-height: 80vh;
        }
        
        .mobile-camera-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        /* iOS specific fixes */
        @supports (-webkit-touch-callout: none) {
          .ios-camera-fix {
            transform: scaleX(-1);
            -webkit-transform: scaleX(-1);
          }
        }
      }
      
      /* Desktop camera styling */
      @media (min-width: 769px) {
        .desktop-camera-container {
          aspect-ratio: 1;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // MOBILE 9:16 TO 16:9 CONVERSION: Create landscape generations from portrait mobile photos
  const resizeImageForGeneration = (dataUrl: string): Promise<string> => {
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
        
        console.log('Original capture dimensions:', {
          width,
          height,
          aspectRatio: inputAspectRatio.toFixed(2),
          isMobile,
          isPortrait: height > width
        });
        
        // Always generate 16:9 landscape images for AI generation
        const targetWidth = 1024;
        const targetHeight = 576; // 16:9 aspect ratio
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // High quality settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Fill with neutral background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        
        // Calculate scaling to fit image into landscape canvas
        const scaleToFitWidth = targetWidth / width;
        const scaleToFitHeight = targetHeight / height;
        const scale = Math.min(scaleToFitWidth, scaleToFitHeight);
        
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        
        // Center the image in the landscape canvas
        const offsetX = (targetWidth - scaledWidth) / 2;
        const offsetY = (targetHeight - scaledHeight) / 2;
        
        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        
        const result = canvas.toDataURL('image/png', 0.95);
        
        console.log('Image conversion completed:', {
          originalSize: `${width}x${height}`,
          targetSize: `${targetWidth}x${targetHeight}`,
          scale: scale.toFixed(3),
          scaledSize: `${Math.round(scaledWidth)}x${Math.round(scaledHeight)}`,
          offset: `${Math.round(offsetX)}, ${Math.round(offsetY)}`,
          conversion: height > width ? '9:16 Portrait → 16:9 Landscape' : 'Landscape maintained',
          isMobile,
          dataSize: `${(result.length / 1024).toFixed(1)}KB`
        });
        
        resolve(result);
      };
      
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = dataUrl;
    });
  };

  // Environment variable checker for debugging
  useEffect(() => {
    const checkEnv = () => {
      console.log('Using secure Supabase Edge Functions for AI generation');
      console.log('API keys are securely stored server-side');
    };
    
    checkEnv();
    
    loadFaceApiModels().catch(error => {
      console.warn('Failed to load face detection models:', error);
    });
  }, []);

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

    console.log('NEW PHOTO GENERATED - Starting automatic upload');
    
    const automaticUploadNow = async () => {
      try {
        setUploading(true);
        setProcessingState({ stage: 'uploading', progress: 90, message: 'Saving to gallery...' });
        
        console.log('Auto-uploading new photo...');
        console.log('Photo details:', {
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
          console.log('Auto-upload successful:', uploadResult.id);
          
          window.dispatchEvent(new CustomEvent('galleryUpdate', {
            detail: { 
              newPhoto: uploadResult,
              source: 'automatic_after_generation'
            }
          }));
          
          setUploadSuccess(true);
          setProcessingState({ stage: 'complete', progress: 100, message: 'Complete!' });
          setTimeout(() => setUploadSuccess(false), 2000);
          
          console.log('Gallery should update now with new photo');
          
        } else {
          console.error('Auto-upload returned null');
        }
        
      } catch (error) {
        console.error('Auto-upload failed:', error);
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
      
      console.log('Photo captured:', {
        format: imageSrc.substring(0, 30) + '...',
        size: imageSrc.length
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
    console.log('Camera reset - forcing re-initialization');
  };

  const handleWebcamError = (err: string | DOMException) => {
    const errorMessage = err instanceof DOMException ? err.message : err;
    console.error('Webcam error:', errorMessage);
    setError(`Camera error: ${errorMessage}`);
    setCameraReady(false);
    
    setTimeout(() => {
      setCameraKey(prev => prev + 1);
      console.log('Attempting camera recovery...');
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
            <span>Preparing your photo with AI magic...</span>
          </>
        )}
        {state.stage === 'masking' && (
          <>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <span>Crafting the perfect face blend...</span>
          </>
        )}
        {state.stage === 'generating' && (
          <>
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-spin"></div>
            <span>Creating AI magic...</span>
          </>
        )}
        {state.stage === 'uploading' && (
          <>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
            <span>Adding to your gallery...</span>
          </>
        )}
        {state.stage === 'complete' && (
          <>
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>Magic complete!</span>
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
      if (!shouldApplyOverlay()) {
        console.log('No overlay configured, returning original image');
        return generatedImageData;
      }

      const overlayConfig = getActiveOverlay();
      if (!overlayConfig) {
        console.log('No active overlay found, returning original image');
        return generatedImageData;
      }

      console.log('Applying overlay to AI generated image:', {
        overlayName: overlayConfig.name,
        overlayType: overlayConfig.type,
        borderId: overlayConfig.borderId,
        aspectRatio: overlayConfig.aspectRatio
      });

      const imageWithOverlay = await applyOverlayToImage(generatedImageData, overlayConfig);
      
      console.log('Overlay applied successfully to AI image');
      return imageWithOverlay;

    } catch (error) {
      console.error('Failed to apply overlay to AI image:', error);
      return generatedImageData;
    }
  };

  // FIXED: Process media with corrected provider selection
  const processMediaWithCapturedPhoto = React.useCallback(async (capturedImageData: string) => {
    if (!capturedImageData) {
      setError('No photo captured');
      return;
    }

    let currentConfig = config;
    if (!currentConfig) {
      console.log('Config not loaded yet, waiting...');
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

      // CRITICAL FIX: Proper provider routing
      console.log('Starting AI generation process...', {
        modelType: currentModelType,
        prompt: currentConfig.global_prompt,
        faceMode: currentConfig.face_preservation_mode || 'preserve_face',
        attempt: generationAttempts + 1
      });

      await animateProgress(0, 15, 1000, 'detecting', 'Analyzing your photo...');
      console.log('Converting image for AI generation...');
      
      const processedContent = await resizeImageForGeneration(capturedImageData);
      
      if (!processedContent || !processedContent.startsWith('data:image/')) {
        throw new Error('Image conversion failed - invalid output format');
      }
      
      console.log('Image conversion for AI:', {
        originalSize: capturedImageData.length,
        processedSize: processedContent.length,
        resolution: '1024x576 (16:9 landscape)'
      });

      let aiContent: string;
      const faceMode = currentConfig.face_preservation_mode || 'preserve_face';

      if (currentModelType === 'video') {
        // VIDEO GENERATION - Always use Replicate
        await animateProgress(15, 35, 1500, 'generating', 'Initializing video AI...');
        
        console.log('Starting video generation with Replicate...');

        const videoPromise = generateWithReplicate({
          prompt: currentConfig.global_prompt || 'AI Generated Video',
          inputData: processedContent,
          type: 'video',
          duration: currentConfig.video_duration || 5,
          preserveFace: faceMode === 'preserve_face'
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Replicate video generation timed out. Please try again.')), 300000);
        });

        const progressPromise = async () => {
          await animateProgress(35, 60, 8000, 'generating', 'Generating video frames...');
          await animateProgress(60, 75, 6000, 'generating', 'Applying face preservation...');
          await animateProgress(75, 85, 4000, 'generating', 'Finalizing video...');
          await animateProgress(85, 90, 2000, 'generating', 'Processing with Replicate...');
          return await videoPromise;
        };

        aiContent = await Promise.race([progressPromise(), timeoutPromise]);
        
      } else {
        // IMAGE GENERATION - Always use Stability AI
        await animateProgress(15, 35, 1500, 'masking', 'Detecting facial features...');
        
        let maskData: string | undefined;
        
        // Generate mask for inpainting with Stability AI
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image for face detection'));
            img.src = processedContent;
          });

          console.log('Generating face mask for Stability AI...');
          
          maskData = await generateSmartFaceMask(
            img,
            faceMode === 'preserve_face',
            20,  // feathering value
            1.2  // expansion factor
          );
          
          console.log('Smart face mask generated successfully for Stability AI');
          
        } catch (faceDetectionError) {
          console.warn('Face detection failed, using fallback mask:', faceDetectionError);
          
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image for fallback mask'));
            img.src: processedContent;
          });
          
          maskData = generateFallbackMask(img.naturalWidth, img.naturalHeight);
          console.log('Fallback mask generated for Stability AI');
        }

        await animateProgress(35, 45, 800, 'generating', 'Preparing Stability AI...');
        
        console.log('Starting image generation with Stability AI...');
        
        // STABILITY AI IMAGE GENERATION - Always use for images
        const basePrompt = currentConfig.global_prompt || 'AI Generated Portrait';
        
        const enhancedPrompt = faceMode === 'preserve_face' 
          ? `${basePrompt}, photorealistic portrait, preserve facial features only, exclude clothing and collars, natural skin texture, detailed eyes and mouth, cinematic composition, professional photography, 16:9 landscape format, wide shot, environmental background, no shirts or ties visible, 8k quality`
          : `${basePrompt}, creative character transformation, artistic interpretation, detailed facial features, cinematic landscape composition, 16:9 wide format, environmental setting, no clothing elements from original`;

        console.log(`Using ${faceMode} mode with Stability AI SDXL generation...`);
        console.log('Enhanced prompt:', enhancedPrompt);
        
        const generationPromise = generateWithStability({
          prompt: enhancedPrompt,
          imageData: processedContent,
          mode: 'inpaint',
          maskData: maskData,
          facePreservationMode: faceMode,
          strength: faceMode === 'preserve_face' ? 0.4 : 0.7,
          cfgScale: 8.0,
          steps: 25,
          useControlNet: currentConfig.use_controlnet ?? true,
          controlNetType: currentConfig.controlnet_type || 'auto'
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Stability AI generation timed out. Please try again.')), 180000);
        });

        const progressPromise = async () => {
          await animateProgress(45, 65, 3000, 'generating', 'Processing with Stability AI...');
          await animateProgress(65, 80, 2500, 'generating', 'Applying AI transformation...');
          await animateProgress(80, 88, 1500, 'generating', 'Refining details...');
          await animateProgress(88, 90, 1000, 'generating', 'Almost done...');
          return await generationPromise;
        };

        const rawAiContent = await Promise.race([progressPromise(), timeoutPromise]);
        await animateProgress(90, 95, 800, 'uploading', 'Applying overlay...');
        aiContent = await applyConfiguredOverlay(rawAiContent);
      }
      
      await animateProgress(95, 98, 500, 'generating', 'Validating result...');
      
      if (!aiContent) {
        throw new Error('Generated content is empty. Please try again.');
      }

      if (!aiContent.startsWith('data:') && !aiContent.startsWith('blob:')) {
        console.error('Invalid AI content format:', aiContent.substring(0, 100));
        throw new Error('Invalid AI content format received.');
      }

      console.log('Validating generated content...', {
        provider: currentModelType === 'video' ? 'replicate' : 'stability',
        contentType: typeof aiContent,
        length: aiContent.length,
        startsWithData: aiContent.startsWith('data:'),
        preview: aiContent.substring(0, 100) + '...'
      });

      if (aiContent.startsWith('data:')) {
        const testImg = new Image();
        await new Promise<void>((resolve, reject) => {
          testImg.onload = () => {
            console.log('Generated image loads successfully:', {
              width: testImg.width,
              height: testImg.height,
              provider: currentModelType === 'video' ? 'replicate' : 'stability'
            });
            resolve();
          };
          testImg.onerror = () => {
            console.error('Generated image failed to load!');
            reject(new Error('Generated image is corrupted'));
          };
          testImg.src = aiContent;
          
          setTimeout(() => {
            reject(new Error('Image validation timeout'));
          }, 5000);
        });
      }

      await animateProgress(98, 100, 600, 'uploading', 'Finalizing magic...');

      console.log('AI generation completed successfully:', {
        provider: currentModelType === 'video' ? 'replicate' : 'stability',
        type: currentModelType,
        format: aiContent.startsWith('data:') ? 'data URL' : 'blob URL',
        size: aiContent.length,
        faceMode: faceMode,
        aspectRatio: '16:9 landscape'
      });

      setProcessedMedia(aiContent);
      setError(null);

      console.log('AI generation process completed - automatic upload should trigger via useEffect');

    } catch (error) {
      console.log('AI GENERATION FAILED');
      console.error('Generation error details:', error);

      let errorMessage = 'Failed to generate AI content. Please try again.';
      let debugDetails: any = null;
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('edge function returned a non-2xx status code')) {
          errorMessage = 'Server configuration issue. Please check your API settings.';
          debugDetails = {
            issue: 'Edge Function Error',
            suggestion: 'Check API keys in Supabase Edge Functions',
            errorType: 'server_error'
          };
        } else if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
          errorMessage = 'API authentication failed. Please check your API key configuration.';
          debugDetails = { errorType: 'auth_error' };
        } else if (message.includes('credits') || message.includes('insufficient') || message.includes('402')) {
          errorMessage = 'Insufficient API credits. Please check your account balance.';
          debugDetails = { errorType: 'credits_error' };
        } else if (message.includes('rate limit') || message.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          debugDetails = { errorType: 'rate_limit_error' };
        } else if (message.includes('timeout')) {
          errorMessage = 'AI generation timed out. Please try again with a simpler prompt.';
          debugDetails = { errorType: 'timeout_error' };
        } else if (message.includes('face detection')) {
          errorMessage = 'Face detection failed. Please ensure the photo shows clear facial features.';
          debugDetails = { errorType: 'face_detection_error' };
        } else if (message.includes('mask')) {
          errorMessage = 'Mask generation failed. Please try taking a new photo.';
          debugDetails = { errorType: 'mask_error' };
        } else {
          errorMessage = `AI generation error: ${error.message}`;
          debugDetails = { errorType: 'general_error', originalMessage: error.message };
        }
      }

      setError(errorMessage);
      setDebugInfo(debugDetails);
      setProcessedMedia(null);
      
    } finally {
      setProcessing(false);
    }
  }, [currentModelType, generationAttempts, config, animateProgress]);

  const getMobileVideoConstraints = () => {
    if (!isMobile) {
      return {
        width: 1280,
        height: 720,
        facingMode: "user"
      };
    }

    return {
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      facingMode: "user",
      frameRate: { ideal: 30, max: 30 }
    };
  };

  // Get current provider for display
  const getCurrentProvider = () => {
    if (!config) return 'Unknown';
    return currentModelType === 'image' ? 'Stability AI' : 'Replicate';
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
        <div className="container mx-auto px-4 py-4 max-w-lg">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <Camera className="w-8 h-8" style={{ color: config?.primary_color }} />
              {config?.brand_name || 'AI Photobooth'}
            </h1>
            <div className="flex items-center gap-2">
              <div className="bg-gray-800 px-3 py-1 rounded-lg text-xs flex items-center gap-1">
                {currentModelType === 'video' ? (
                  <>
                    <Video className="w-3 h-3 text-purple-400" />
                    <span>Video Mode</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-3 h-3 text-blue-400" />
                    <span>{getCurrentProvider()}</span>
                  </>
                )}
              </div>
              
              <div className="bg-gray-800 px-3 py-1 rounded-lg text-xs flex items-center gap-1">
                {config?.face_preservation_mode === 'preserve_face' ? (
                  <>
                    <Users className="w-3 h-3 text-green-400" />
                    <span className="text-green-400">Face Preserved</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3 h-3 text-orange-400" />
                    <span className="text-orange-400">New Character</span>
                  </>
                )}
              </div>
              
              {processedMedia && (
                <div className="bg-gray-800 px-3 py-1 rounded-lg text-xs flex items-center gap-1">
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
                      <span className="text-blue-400">Saving...</span>
                    </>
                  ) : uploadSuccess ? (
                    <>
                      <ImageIcon className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">Saved!</span>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {config?.global_prompt && (
            <p className="text-gray-300 text-sm mt-2 px-2">
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
              Get the Best AI Results
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Good Lighting:</span>
                  <span className="text-gray-300"> Face the light source, avoid harsh shadows</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Face the Camera:</span>
                  <span className="text-gray-300"> Look directly at the lens for optimal face detection</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Provider:</span>
                  <span className="text-gray-300"> Using {getCurrentProvider()} for generation</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wand2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">16:9 Format:</span>
                  <span className="text-gray-300"> Creates wide landscape compositions with environmental backgrounds</span>
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
                  alt="AI Generated"
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
                screenshotQuality={0.92}
                className={`w-full h-full ${isMobile ? 'mobile-camera-preview ios-camera-fix object-cover' : 'object-cover'}`}
                videoConstraints={getMobileVideoConstraints()}
                onUserMedia={() => {
                  console.log('Webcam initialized successfully with key:', cameraKey);
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
                <span className="text-purple-400">{getCurrentProvider()} Generated</span>
                {uploading && (
                  <RefreshCw className="w-3 h-3 text-blue-400 animate-spin ml-1" />
                )}
              </div>
            )}
            
            {processing && (
              <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-purple-400 animate-spin" />
                <span className="text-purple-400">AI Processing...</span>
              </div>
            )}
            
            {isMobile && !mediaData && !processedMedia && !processing && (
              <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <span className="text-green-400">Mobile Compatible</span>
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
              {!cameraReady ? 'Initializing Camera...' : 'Take Photo'}
            </button>
          ) : processing ? (
            <div className="text-center text-sm text-gray-400 bg-gray-800/50 rounded-lg p-4">
              <Wand2 className="w-6 h-6 animate-spin text-purple-400 mx-auto mb-2" />
              <span className="text-purple-400">AI is creating your magic...</span>
            </div>
          ) : processedMedia ? (
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-4 bg-gray-600 rounded-xl hover:bg-gray-700 transition font-medium"
            >
              <Camera className="w-5 h-5" />
              Take New Photo
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
            <p><span className="text-purple-400 font-semibold">Provider:</span> {getCurrentProvider()}</p>
            <p><span className="text-blue-400 font-semibold">Mode:</span> {currentModelType}</p>
            <p><span className="text-green-400 font-semibold">Face Mode:</span> {config?.face_preservation_mode || 'preserve_face'}</p>
            <p><span className="text-yellow-400 font-semibold">Attempts:</span> {generationAttempts}/3</p>
            <p><span className="text-cyan-400 font-semibold">Resolution:</span> 1024x576 (16:9 Landscape)</p>
            <p><span className="text-red-400 font-semibold">Camera Key:</span> {cameraKey} {isMobile && '(Mobile Mode)'}</p>
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