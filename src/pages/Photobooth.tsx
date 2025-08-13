// src/pages/Photobooth.tsx
// Enhanced Photobooth component with SDXL Inpainting + ControlNet integration

import React, { useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, ImageIcon, Wand2, AlertCircle, Video, RefreshCw, Users, UserX, Lightbulb, Eye, User } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { uploadPhoto } from '../lib/supabase';
import { generateWithStability } from '../lib/stableDiffusion';
import { 
  loadFaceApiModels, 
  generateSmartFaceMask, 
  generateFallbackMask 
} from '../lib/faceDetection';
import { getActiveOverlay, applyOverlayToImage, shouldApplyOverlay } from '../lib/overlayUtils';

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
  
  const webcamRef = React.useRef<Webcam>(null);

  // Enhanced image resizing for SDXL optimal input
  const resizeImage = (dataUrl: string, targetSize: number = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Cannot create canvas context'));
          return;
        }

        // Calculate dimensions to maintain aspect ratio
        const { width, height } = img;
        let newWidth = targetSize;
        let newHeight = targetSize;
        
        if (width > height) {
          newHeight = Math.round((height / width) * targetSize);
        } else {
          newWidth = Math.round((width / height) * targetSize);
        }

        canvas.width = newWidth;
        canvas.height = newHeight;

        // Use high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw the resized image
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        resolve(canvas.toDataURL('image/png', 0.95));
      };
      
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.src = dataUrl;
    });
  };

  // Environment variable checker for debugging
  useEffect(() => {
    const checkEnv = () => {
      console.log('🔍 Using secure Supabase Edge Functions for SDXL Inpainting');
      console.log('✅ API keys are now securely stored server-side');
    };
    
    checkEnv();
    
    // Load face detection models
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
    };
  }, [processedMedia]);

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
          
          // Dispatch gallery event immediately
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

    // Upload immediately - no delays
    automaticUploadNow();

  }, [processedMedia, config, currentModelType]);

  const capturePhoto = React.useCallback(() => {
    try {
      setError(null);
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture photo');
      }
      
      console.log('📷 Photo captured:', {
        format: imageSrc.substring(0, 30) + '...',
        size: imageSrc.length
      });
      
      setMediaData(imageSrc);
      setProcessedMedia(null);
      setGenerationAttempts(0);
      setShowInstructions(false);
      setDebugInfo(null);
      setProcessingState({ stage: 'detecting', progress: 0, message: 'Ready to generate...' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture photo';
      console.error('Error capturing photo:', err);
      setError(errorMessage);
      setMediaData(null);
    }
  }, [webcamRef]);

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
    if (processedMedia && processedMedia.startsWith('blob:')) {
      URL.revokeObjectURL(processedMedia);
    }
    // Clear session storage for this session
    sessionStorage.clear();
  };

  const handleWebcamError = (err: string | DOMException) => {
    const errorMessage = err instanceof DOMException ? err.message : err;
    console.error('Webcam error:', errorMessage);
    setError(`Camera error: ${errorMessage}`);
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

  // Processing indicator component
  const ProcessingIndicator = ({ state }: { state: ProcessingState }) => (
    <div className="text-center space-y-3">
      <div className="text-sm font-medium text-white">{state.message}</div>
      <div className="w-full bg-gray-700 rounded-full h-3">
        <div 
          className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-500" 
          style={{ width: `${state.progress}%` }}
        />
      </div>
      <div className="text-xs text-gray-400">{state.progress}% Complete</div>
      <div className="text-xs text-purple-300">
        {state.stage === 'detecting' && '🔍 Analyzing image...'}
        {state.stage === 'masking' && '🎭 Generating face mask...'}
        {state.stage === 'generating' && '🎨 Creating with SDXL Inpainting...'}
        {state.stage === 'uploading' && '📤 Saving to gallery...'}
        {state.stage === 'complete' && '✅ Complete!'}
      </div>
    </div>
  );

  // ENHANCED processMedia function with SDXL Inpainting
  const processMedia = async () => {
    if (!mediaData) {
      setError('No photo captured');
      return;
    }

    if (!config) {
      setError('Application configuration not loaded');
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

      console.log('🚀 Starting SDXL Inpainting generation process...');
      console.log('📋 Generation details:', {
        prompt: config.global_prompt,
        modelType: currentModelType,
        faceMode: config.face_preservation_mode || 'preserve_face',
        attempt: generationAttempts + 1
      });

      // Stage 1: Resize image for SDXL optimal input
      setProcessingState({ stage: 'detecting', progress: 10, message: 'Preparing image for SDXL...' });
      console.log('🖼️ Resizing image for SDXL optimal input...');
      const processedContent = await resizeImage(mediaData, 1024);
      
      if (!processedContent || !processedContent.startsWith('data:image/')) {
        throw new Error('Image resizing failed - invalid output format');
      }
      
      console.log('✅ Image resized for SDXL:', {
        originalSize: mediaData.length,
        processedSize: processedContent.length,
        resolution: '1024x1024 optimized'
      });

      // Stage 2: Generate smart face mask for SDXL Inpainting
      setProcessingState({ stage: 'masking', progress: 30, message: 'Analyzing facial features...' });
      
      let maskData: string | undefined;
      const faceMode = config.face_preservation_mode || 'preserve_face';
      
      try {
        // Create image element for face detection
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image for face detection'));
          img.src = processedContent;
        });

        console.log('🔍 Generating smart face mask for SDXL Inpainting...');
        maskData = await generateSmartFaceMask(
          img,
          faceMode === 'preserve_face', // true = preserve faces, false = replace faces
          25,  // feather radius for smooth blending
          1.4  // expansion factor for better face coverage
        );
        
        console.log('✅ Smart face mask generated successfully for SDXL');
        
      } catch (faceDetectionError) {
        console.warn('⚠️ Face detection failed, using fallback mask:', faceDetectionError);
        
        // Generate fallback mask if face detection fails
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image for fallback mask'));
          img.src = processedContent;
        });
        
        maskData = generateFallbackMask(img.naturalWidth, img.naturalHeight);
        console.log('✅ Fallback mask generated for SDXL');
      }

      // Stage 3: Generate AI content with SDXL Inpainting
      setProcessingState({ stage: 'generating', progress: 50, message: 'Generating with SDXL Inpainting...' });
      
      console.log('🎨 Starting SDXL Inpainting generation...');
      
      let aiContent: string;

      if (currentModelType === 'video') {
        // For video, we'd need to use Replicate or another service
        throw new Error('Video generation with SDXL Inpainting not supported. Please use image mode or switch to Replicate provider.');
      } else {
        // Enhanced prompting for SDXL Inpainting
        const enhancedPrompt = faceMode === 'preserve_face' 
          ? `${config.global_prompt}, photorealistic portrait, highly detailed face, natural skin texture, sharp facial features, professional photography lighting, 8k quality`
          : `${config.global_prompt}, creative character transformation, artistic interpretation, detailed features`;

        console.log(`🎭 Using ${faceMode} mode with SDXL Inpainting...`);
        console.log('🎯 Enhanced prompt:', enhancedPrompt);
        
        const generationPromise = generateWithStability({
          prompt: enhancedPrompt,
          imageData: processedContent,
          mode: 'inpaint', // Always use inpainting for best face preservation
          maskData: maskData,
          facePreservationMode: faceMode,
          strength: faceMode === 'preserve_face' ? 0.4 : 0.7, // Optimized for SDXL
          cfgScale: 8.0,  // Good balance for SDXL
          steps: 25       // Optimal for SDXL quality/speed
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('SDXL Inpainting generation timed out. Please try again.')), 180000);
        });

        setProcessingState({ stage: 'generating', progress: 70, message: 'SDXL processing...' });
        aiContent = await Promise.race([generationPromise, timeoutPromise]);
      }
      
      // Stage 4: Validate generated content
      setProcessingState({ stage: 'generating', progress: 80, message: 'Validating result...' });
      
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
        preview: aiContent.substring(0, 100) + '...'
      });

      // Test if the generated image can be loaded
      if (aiContent.startsWith('data:')) {
        const testImg = new Image();
        await new Promise<void>((resolve, reject) => {
          testImg.onload = () => {
            console.log('✅ SDXL generated image loads successfully:', {
              width: testImg.width,
              height: testImg.height,
              model: 'SDXL Inpainting'
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

      // Stage 5: Finalize
      setProcessingState({ stage: 'uploading', progress: 85, message: 'Finalizing...' });

      console.log('✅ SDXL Inpainting generation completed successfully:', {
        type: currentModelType,
        format: aiContent.startsWith('data:') ? 'data URL' : 'blob URL',
        size: aiContent.length,
        faceMode: faceMode,
        model: 'SDXL Inpainting'
      });

      // Update UI - this will trigger the automatic upload via useEffect
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
            errorType: 'server_error'
          };
        } else if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
          errorMessage = 'API authentication failed. Please check your Stability AI API key.';
          debugDetails = { errorType: 'auth_error' };
        } else if (message.includes('credits') || message.includes('insufficient') || message.includes('402')) {
          errorMessage = 'Insufficient Stability AI credits. Please check your account balance.';
          debugDetails = { errorType: 'credits_error' };
        } else if (message.includes('rate limit') || message.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
          debugDetails = { errorType: 'rate_limit_error' };
        } else if (message.includes('timeout')) {
          errorMessage = 'SDXL generation timed out. Please try again with a simpler prompt.';
          debugDetails = { errorType: 'timeout_error' };
        } else if (message.includes('face detection')) {
          errorMessage = 'Face detection failed. Please ensure the photo shows clear facial features.';
          debugDetails = { errorType: 'face_detection_error' };
        } else if (message.includes('mask')) {
          errorMessage = 'Mask generation failed. Please try taking a new photo.';
          debugDetails = { errorType: 'mask_error' };
        } else {
          errorMessage = `SDXL Inpainting error: ${error.message}`;
          debugDetails = { errorType: 'general_error', originalMessage: error.message };
        }
      }

      setError(errorMessage);
      setDebugInfo(debugDetails);
      setProcessedMedia(null);
      
    } finally {
      setProcessing(false);
    }
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
              {/* Model Type Badge */}
              <div className="bg-gray-800 px-3 py-1 rounded-lg text-xs flex items-center gap-1">
                {currentModelType === 'video' ? (
                  <>
                    <Video className="w-3 h-3 text-purple-400" />
                    <span>Video Mode</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-3 h-3 text-blue-400" />
                    <span>SDXL Image</span>
                  </>
                )}
              </div>
              
              {/* Face Mode Badge */}
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
              
              {/* Upload Status */}
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
        {/* Photography Instructions */}
        {showInstructions && !mediaData && (
          <div className="mb-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Get the Best SDXL Results
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
                  <span className="text-white font-medium">Chest Up Shot:</span>
                  <span className="text-gray-300"> Frame from chest to head for best SDXL results</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wand2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">SDXL Inpainting:</span>
                  <span className="text-gray-300"> Advanced AI for superior face preservation</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main View - Camera Preview or AI Result */}
        <div className="bg-gray-800 rounded-xl overflow-hidden mb-6 shadow-2xl">
          <div className="aspect-square bg-black relative">
            {processedMedia ? (
              // Show AI generated result
              currentModelType === 'video' ? (
                <video
                  src={processedMedia}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={processedMedia}
                  alt="SDXL Generated"
                  className="w-full h-full object-contain"
                />
              )
            ) : mediaData ? (
              // Show captured photo
              <img
                src={mediaData}
                alt="Captured"
                className="w-full h-full object-contain"
              />
            ) : error ? (
              // Show error state
              <ErrorDisplay error={error} attempts={generationAttempts} />
            ) : (
              // Show webcam
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/png"
                className="w-full h-full object-cover"
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  facingMode: "user"
                }}
                onUserMediaError={handleWebcamError}
              />
            )}
            
            {/* Processing overlay */}
            {processing && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
                <div className="text-center max-w-sm mx-auto p-6">
                  <Wand2 className="w-16 h-16 mx-auto mb-4 text-purple-400 animate-pulse" />
                  <ProcessingIndicator state={processingState} />
                </div>
              </div>
            )}

            {/* Status badges */}
            {processedMedia && (
              <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-purple-400" />
                <span className="text-purple-400">SDXL Generated</span>
                {uploading && (
                  <RefreshCw className="w-3 h-3 text-blue-400 animate-spin ml-1" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4 mb-6">
          {!mediaData ? (
            <button
              onClick={capturePhoto}
              disabled={!!error}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-xl hover:opacity-90 transition disabled:opacity-50 text-lg font-semibold shadow-lg"
              style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
            >
              <Camera className="w-7 h-7" />
              Take Photo
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={processMedia}
                disabled={processing || !!error || generationAttempts >= 3}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-xl transition disabled:opacity-50 text-lg font-semibold shadow-lg"
                style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
              >
                <Wand2 className="w-7 h-7" />
                {processing ? 'Creating with SDXL...' : `Generate with SDXL Inpainting`}
              </button>
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gray-600 rounded-xl hover:bg-gray-700 transition font-medium"
              >
                <Camera className="w-5 h-5" />
                Take New Photo
              </button>
            </div>
          )}

          {/* Auto-upload status message */}
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

        {/* Enhanced Debug Info */}
        {(process.env.NODE_ENV === 'development' || debugInfo) && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg text-xs text-gray-400 space-y-2">
            <p><span className="text-purple-400 font-semibold">Model:</span> SDXL Inpainting + ControlNet</p>
            <p><span className="text-blue-400 font-semibold">Mode:</span> {currentModelType}</p>
            <p><span className="text-green-400 font-semibold">Face Mode:</span> {config?.face_preservation_mode || 'preserve_face'}</p>
            <p><span className="text-yellow-400 font-semibold">Attempts:</span> {generationAttempts}/3</p>
            <p><span className="text-indigo-400 font-semibold">Strength:</span> {config?.face_preservation_mode === 'preserve_face' ? '0.4' : '0.7'}</p>
            <p><span className="text-pink-400 font-semibold">CFG Scale:</span> 8.0</p>
            <p><span className="text-cyan-400 font-semibold">Resolution:</span> 1024x1024 SDXL Native</p>
            <p><span className="text-orange-400 font-semibold">Steps:</span> 25 (SDXL Optimized)</p>
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