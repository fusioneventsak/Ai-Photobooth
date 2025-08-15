// src/pages/Photobooth.tsx
// Enhanced Photobooth component with seamless SDXL Inpainting integration

import React, { useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, ImageIcon, Wand2, AlertCircle, Video, RefreshCw, Users, UserX, Lightbulb, Eye, User } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { uploadPhoto } from '../lib/supabase';
import { generateWithStability } from '../lib/stabilityService';
import { generateWithReplicate } from '../lib/replicateService';
import { 
  loadFaceApiModels, 
  generateSmartFaceMask, 
  generateFallbackMask,
  preprocessImageForSDXL
} from '../lib/faceDetection';

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

  // Enhanced image resizing with better framing to avoid long necks
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

        // Set SDXL optimal dimensions
        canvas.width = targetSize;
        canvas.height = targetSize;

        // Calculate smart cropping to avoid long necks
        const { width, height } = img;
        let sourceX = 0, sourceY = 0, sourceWidth = width, sourceHeight = height;
        
        // For portrait images, focus on upper portion to avoid long necks
        if (height > width) {
          // Crop from top 70% of the image to avoid showing too much body
          sourceHeight = Math.min(height, width * 1.2); // Limit height relative to width
          sourceY = Math.max(0, height * 0.1); // Start from 10% down, not the very top
        } else {
          // For landscape, center the crop
          sourceWidth = Math.min(width, height);
          sourceX = (width - sourceWidth) / 2;
        }

        // High-quality scaling with subtle enhancements
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Apply subtle preprocessing for better SDXL results
        ctx.filter = 'contrast(1.02) brightness(1.01) saturate(1.02)';
        
        // Draw the intelligently cropped and resized image
        ctx.drawImage(
          img, 
          sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle
          0, 0, canvas.width, canvas.height              // Destination rectangle
        );
        
        // Reset filter
        ctx.filter = 'none';
        
        console.log('✅ Smart image preprocessing completed:', {
          originalDimensions: `${width}x${height}`,
          processedDimensions: `${canvas.width}x${canvas.height}`,
          cropArea: `${sourceWidth}x${sourceHeight} from (${sourceX}, ${sourceY})`,
          aspectRatioOptimized: true
        });
        
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      
      img.onerror = () => reject(new Error('Failed to load image for processing'));
      img.src = dataUrl;
    });
  };

  // Environment setup and model loading
  useEffect(() => {
    const initializeModels = async () => {
      console.log('🚀 Initializing enhanced SDXL Photobooth...');
      console.log('✅ Using secure Supabase Edge Functions for seamless generation');
      
      try {
        await loadFaceApiModels();
        console.log('✅ Face detection models loaded successfully');
      } catch (error) {
        console.warn('⚠️ Face detection models failed to load:', error);
      }
    };
    
    initializeModels();
  }, []);

  // Update model type when config changes
  useEffect(() => {
    if (config?.model_type && currentModelType !== config.model_type) {
      setCurrentModelType(config.model_type);
      reset();
    }
  }, [config?.model_type, currentModelType]);

  // Cleanup resources
  useEffect(() => {
    return () => {
      if (processedMedia && processedMedia.startsWith('blob:')) {
        URL.revokeObjectURL(processedMedia);
      }
    };
  }, [processedMedia]);

  // Enhanced automatic upload with better error handling
  useEffect(() => {
    if (!processedMedia || !config) return;

    const autoUpload = async () => {
      if (uploading) return; // Prevent duplicate uploads
      
      console.log('📸 Starting automatic gallery upload...');
      
      try {
        setUploading(true);
        setUploadAttempts(prev => prev + 1);
        setProcessingState({ stage: 'uploading', progress: 95, message: 'Saving to gallery...' });
        
        const uploadResult = await uploadPhoto(
          processedMedia,
          config.global_prompt || 'AI Generated with SDXL',
          currentModelType
        );
        
        if (uploadResult) {
          console.log('✅ Auto-upload successful:', uploadResult.id);
          
          // Dispatch gallery update event
          window.dispatchEvent(new CustomEvent('galleryUpdate', {
            detail: { 
              newPhoto: uploadResult,
              source: 'automatic_seamless_generation'
            }
          }));
          
          setUploadSuccess(true);
          setProcessingState({ stage: 'complete', progress: 100, message: 'Complete!' });
          
          // Clear success state after delay
          setTimeout(() => {
            setUploadSuccess(false);
            setProcessingState({ stage: 'detecting', progress: 0, message: 'Ready for next photo...' });
          }, 3000);
          
        } else {
          throw new Error('Upload returned null result');
        }
        
      } catch (error) {
        console.error('❌ Auto-upload failed:', error);
        setError('Failed to save to gallery. Photo generated successfully but not saved.');
        
        // Still show the generated image even if upload fails
        setProcessingState({ stage: 'complete', progress: 100, message: 'Generated (save failed)' });
      } finally {
        setUploading(false);
      }
    };

    // Small delay to ensure UI state is updated
    const uploadTimer = setTimeout(autoUpload, 100);
    return () => clearTimeout(uploadTimer);

  }, [processedMedia, config, currentModelType, uploading]);

  const capturePhoto = React.useCallback(() => {
    try {
      setError(null);
      
      // Check if webcam ref exists and is ready
      if (!webcamRef.current) {
        throw new Error('Camera not ready. Please wait a moment and try again.');
      }
      
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture photo. Please ensure camera permissions are granted and try again.');
      }
      
      // Validate the captured image data
      if (!imageSrc.startsWith('data:image/')) {
        throw new Error('Invalid image format captured. Please try again.');
      }
      
      console.log('📷 Photo captured for SDXL processing:', {
        format: 'PNG data URL',
        size: `${Math.round(imageSrc.length / 1024)}KB`,
        dataLength: imageSrc.length
      });
      
      setMediaData(imageSrc);
      setProcessedMedia(null);
      setGenerationAttempts(0);
      setUploadAttempts(0);
      setShowInstructions(false);
      setDebugInfo(null);
      setUploadSuccess(false);
      setProcessingState({ stage: 'detecting', progress: 0, message: 'Photo captured - ready to generate...' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture photo';
      console.error('❌ Photo capture error:', err);
      setError(errorMessage);
      setMediaData(null);
    }
  }, []);

  const reset = () => {
    console.log('🔄 Resetting photobooth for new session...');
    
    // Cleanup blob URLs
    if (processedMedia && processedMedia.startsWith('blob:')) {
      URL.revokeObjectURL(processedMedia);
    }
    
    setMediaData(null);
    setProcessedMedia(null);
    setError(null);
    setGenerationAttempts(0);
    setUploadAttempts(0);
    setShowInstructions(true);
    setUploading(false);
    setUploadSuccess(false);
    setDebugInfo(null);
    setProcessingState({ stage: 'detecting', progress: 0, message: 'Ready for new photo...' });
    
    // Clear any cached data
    sessionStorage.clear();
  };

  const handleWebcamError = (err: string | DOMException) => {
    const errorMessage = err instanceof DOMException ? err.message : err;
    console.error('❌ Webcam error:', errorMessage);
    setError(`Camera error: ${errorMessage}`);
  };

  // Enhanced error display with better categorization
  const getErrorIcon = (error: string) => {
    if (error.includes('API') || error.includes('key')) return '🔑';
    if (error.includes('credits') || error.includes('balance')) return '💳';
    if (error.includes('network') || error.includes('connection')) return '🌐';
    if (error.includes('timeout')) return '⏱️';
    if (error.includes('rate limit')) return '🚦';
    if (error.includes('face') || error.includes('mask')) return '🎭';
    if (error.includes('blending') || error.includes('seamless')) return '🎨';
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

  // Enhanced processing indicator
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
        {state.stage === 'detecting' && '🔍 Optimizing image for SDXL...'}
        {state.stage === 'masking' && '🎭 Creating seamless face mask...'}
        {state.stage === 'generating' && '🎨 Generating with enhanced SDXL...'}
        {state.stage === 'uploading' && '📤 Saving to gallery...'}
        {state.stage === 'complete' && '✅ Complete!'}
      </div>
    </div>
  );

  // Enhanced media processing with seamless blending
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

      console.log('🚀 Starting enhanced SDXL generation with seamless blending...');
      console.log('📋 Enhanced generation parameters:', {
        prompt: config.global_prompt,
        modelType: currentModelType,
        faceMode: config.face_preservation_mode || 'preserve_face',
        attempt: generationAttempts + 1,
        enhancements: ['smart_cropping', 'seamless_blending', 'anti_long_neck']
      });

      // Stage 1: Enhanced image preprocessing
      setProcessingState({ stage: 'detecting', progress: 15, message: 'Optimizing image with smart cropping...' });
      console.log('🖼️ Applying smart preprocessing for better proportions...');
      
      const processedContent = await resizeImage(mediaData, 1024);
      
      if (!processedContent || !processedContent.startsWith('data:image/')) {
        throw new Error('Smart preprocessing failed - invalid output format');
      }
      
      console.log('✅ Smart preprocessing completed:', {
        originalSize: `${Math.round(mediaData.length / 1024)}KB`,
        processedSize: `${Math.round(processedContent.length / 1024)}KB`,
        optimizations: 'smart_crop + contrast_enhancement'
      });

      // Stage 2: Advanced face mask generation
      setProcessingState({ stage: 'masking', progress: 35, message: 'Creating seamless face mask...' });
      
      let maskData: string | undefined;
      const faceMode = config.face_preservation_mode || 'preserve_face';
      
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load processed image for face detection'));
          img.src = processedContent;
        });

        console.log('🔍 Generating seamless face mask...');
        
        // Enhanced masking parameters for better blending
        maskData = await generateSmartFaceMask(
          img,
          faceMode === 'preserve_face',
          config.sdxl_feather_radius || 40,    // Increased feathering for seamless blending
          config.sdxl_face_expansion || 1.2    // Conservative expansion to avoid circular artifacts
        );
        
        console.log('✅ Seamless face mask generated successfully');
        
      } catch (faceDetectionError) {
        console.warn('⚠️ Face detection failed, using enhanced fallback mask:', faceDetectionError);
        
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load image for fallback mask'));
          img.src = processedContent;
        });
        
        maskData = generateFallbackMask(img.naturalWidth, img.naturalHeight);
        console.log('✅ Enhanced fallback mask generated');
      }

      // Stage 3: Enhanced SDXL generation
      setProcessingState({ stage: 'generating', progress: 55, message: 'Generating with enhanced SDXL...' });
      
      console.log('🎨 Starting enhanced SDXL generation...');
      
      let aiContent: string;

      if (currentModelType === 'video') {
        console.log('🎬 Video generation with face preservation...');
        
        const videoPromise = generateWithReplicate({
          prompt: config.global_prompt,
          inputData: processedContent,
          type: 'video',
          duration: config.video_duration || 5,
          preserveFace: faceMode === 'preserve_face'
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Video generation timed out. Please try again.')), 300000);
        });

        setProcessingState({ stage: 'generating', progress: 75, message: 'Generating video with face preservation...' });
        aiContent = await Promise.race([videoPromise, timeoutPromise]);
        
      } else {
        // Enhanced prompt engineering for better body proportions
        const enhancedPrompt = faceMode === 'preserve_face' 
          ? `${config.global_prompt}, photorealistic portrait, natural body proportions, proper neck length, detailed facial features, natural skin texture, professional photography, balanced composition, no elongated neck, realistic anatomy, 8k quality`
          : `${config.global_prompt}, creative character transformation, natural proportions, balanced anatomy, no elongated features, professional digital art, seamless integration`;

        console.log(`🎭 Using enhanced ${faceMode} mode with anti-distortion measures...`);
        console.log('🎯 Enhanced prompt with proportion controls:', enhancedPrompt.slice(0, 150) + '...');
        
        // Enhanced generation parameters
        const generationParams = {
          prompt: enhancedPrompt,
          imageData: processedContent,
          mode: 'inpaint' as const,
          maskData: maskData,
          facePreservationMode: faceMode,
          // Conservative strength to maintain proportions
          strength: faceMode === 'preserve_face' ? 
            (config.sdxl_strength || 0.32) :  // Very conservative for face preservation
            (config.sdxl_strength || 0.65),   // Moderate for transformation
          cfgScale: config.sdxl_cfg_scale || 7.5,
          steps: config.sdxl_steps || 25,
          useControlNet: config.use_controlnet ?? true,
          controlNetType: config.controlnet_type || 'auto',
          // Enhanced negative prompt targeting distortions
          negativePrompt: [
            'elongated neck', 'long neck', 'stretched neck', 'distorted anatomy',
            'unnatural proportions', 'deformed body', 'bad anatomy', 'extra limbs',
            'blurry', 'low quality', 'visible seams', 'harsh transitions',
            'circular mask', 'mask artifacts', 'face swap artifacts'
          ].join(', ')
        };

        console.log('🔧 Enhanced generation parameters:', {
          strength: generationParams.strength,
          cfgScale: generationParams.cfgScale,
          antiDistortion: 'enabled',
          seamlessBlending: 'enabled'
        });
        
        const generationPromise = generateWithStability(generationParams);

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => 
            reject(new Error('Enhanced SDXL generation timed out. Please try again.')), 
            config.generation_timeout || 120000
          );
        });

        setProcessingState({ stage: 'generating', progress: 80, message: 'Enhanced SDXL with seamless blending...' });
        aiContent = await Promise.race([generationPromise, timeoutPromise]);
      }
      
      // Stage 4: Enhanced validation
      setProcessingState({ stage: 'generating', progress: 90, message: 'Validating enhanced result...' });
      
      if (!aiContent) {
        throw new Error('Enhanced generation produced empty result');
      }

      if (!aiContent.startsWith('data:') && !aiContent.startsWith('blob:')) {
        console.error('❌ Invalid AI content format:', aiContent.substring(0, 100));
        throw new Error('Invalid enhanced generation format received');
      }

      console.log('🔍 Validating enhanced SDXL result...', {
        contentType: typeof aiContent,
        length: aiContent.length,
        format: aiContent.startsWith('data:') ? 'data URL' : 'blob URL'
      });

      // Enhanced validation for image content
      if (aiContent.startsWith('data:')) {
        await new Promise<void>((resolve, reject) => {
          const testImg = new Image();
          testImg.onload = () => {
            console.log('✅ Enhanced SDXL result validated:', {
              width: testImg.naturalWidth,
              height: testImg.naturalHeight,
              aspectRatio: (testImg.naturalWidth / testImg.naturalHeight).toFixed(2),
              model: 'Enhanced SDXL with Seamless Blending'
            });
            resolve();
          };
          testImg.onerror = () => {
            console.error('❌ Enhanced result validation failed');
            reject(new Error('Enhanced generated image is corrupted'));
          };
          testImg.src = aiContent;
          
          setTimeout(() => {
            reject(new Error('Enhanced result validation timeout'));
          }, 5000);
        });
      }

      console.log('✅ Enhanced SDXL generation completed successfully:', {
        type: currentModelType,
        size: `${Math.round(aiContent.length / 1024)}KB`,
        faceMode: faceMode,
        model: 'Enhanced SDXL with Seamless Blending',
        antiDistortion: 'enabled'
      });

      // Update UI - this triggers automatic upload
      setProcessedMedia(aiContent);
      setError(null);

      console.log('🎯 Enhanced SDXL process completed - auto-upload will begin...');

    } catch (error) {
      console.error('❌ === ENHANCED SDXL GENERATION FAILED ===');
      console.error('📊 Enhanced generation error:', error);

      let errorMessage = 'Enhanced generation failed. Please try again.';
      let debugDetails: any = null;
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        if (message.includes('seamless') || message.includes('blending')) {
          errorMessage = 'Seamless blending failed. Please ensure clear facial features in the photo.';
          debugDetails = { errorType: 'seamless_blending_error' };
        } else if (message.includes('preprocessing') || message.includes('smart')) {
          errorMessage = 'Smart preprocessing failed. Please try with better lighting.';
          debugDetails = { errorType: 'preprocessing_error' };
        } else if (message.includes('face detection')) {
          errorMessage = 'Enhanced face detection failed. Please ensure clear facial features.';
          debugDetails = { errorType: 'enhanced_face_detection_error' };
        } else if (message.includes('mask')) {
          errorMessage = 'Seamless mask generation failed. Please try taking a new photo.';
          debugDetails = { errorType: 'seamless_mask_error' };
        } else if (message.includes('api key') || message.includes('unauthorized')) {
          errorMessage = 'API authentication failed. Please check your Stability AI API key.';
          debugDetails = { errorType: 'auth_error' };
        } else if (message.includes('credits') || message.includes('insufficient')) {
          errorMessage = 'Insufficient Stability AI credits. Please check your account balance.';
          debugDetails = { errorType: 'credits_error' };
        } else if (message.includes('timeout')) {
          errorMessage = 'Enhanced generation timed out. Please try again.';
          debugDetails = { errorType: 'timeout_error' };
        } else {
          errorMessage = `Enhanced SDXL error: ${error.message}`;
          debugDetails = { errorType: 'general_error', originalMessage: error.message };
        }
      }
      
      setError(errorMessage);
      if (config?.enable_debug_mode && debugDetails) {
        setDebugInfo(debugDetails);
      }
      setProcessedMedia(null);
      
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Enhanced Header */}
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
              {config?.brand_name || 'Enhanced AI Photobooth'}
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
                    <span>Enhanced SDXL</span>
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
        {/* Enhanced Photography Instructions */}
        {showInstructions && !mediaData && (
          <div className="mb-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Get Perfect Enhanced SDXL Results
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Optimal Lighting:</span>
                  <span className="text-gray-300"> Even, soft lighting on your face for best results</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Perfect Framing:</span>
                  <span className="text-gray-300"> Chest-up shot, face centered for optimal composition</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Natural Proportions:</span>
                  <span className="text-gray-300"> Smart cropping prevents distortion and maintains natural anatomy</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wand2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Enhanced SDXL:</span>
                  <span className="text-gray-300"> Seamless blending with advanced face preservation technology</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Camera/Result View */}
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
                  alt="Enhanced SDXL Generated"
                  className="w-full h-full object-contain"
                />
              )
            ) : mediaData ? (
              // Show captured photo
              <img
                src={mediaData}
                alt="Captured Photo"
                className="w-full h-full object-contain"
              />
            ) : error ? (
              // Show error state
              <ErrorDisplay error={error} attempts={generationAttempts} />
            ) : (
              // Show webcam feed
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/png"
                screenshotQuality={0.92}
                className="w-full h-full object-cover"
                videoConstraints={{
                  width: 1280,
                  height: 720,
                  facingMode: "user"
                }}
                onUserMedia={() => {
                  console.log('✅ Webcam initialized successfully');
                }}
                onUserMediaError={handleWebcamError}
                style={{ filter: 'none' }}
              />
            )}
            
            {/* Enhanced Processing Overlay */}
            {processing && (
              <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center">
                <div className="text-center max-w-sm mx-auto p-6">
                  <Wand2 className="w-16 h-16 mx-auto mb-4 text-purple-400 animate-pulse" />
                  <ProcessingIndicator state={processingState} />
                </div>
              </div>
            )}

            {/* Enhanced Status Badges */}
            {processedMedia && (
              <div className="absolute top-3 left-3 space-y-2">
                <div className="bg-black/80 text-white px-3 py-1 rounded-lg text-xs flex items-center gap-2">
                  <Wand2 className="w-3 h-3 text-purple-400" />
                  <span className="text-purple-400">Enhanced SDXL</span>
                  {uploading && (
                    <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                  )}
                  {uploadSuccess && (
                    <ImageIcon className="w-3 h-3 text-green-400" />
                  )}
                </div>
                <div className="bg-black/80 text-white px-3 py-1 rounded-lg text-xs flex items-center gap-2">
                  <User className="w-3 h-3 text-blue-400" />
                  <span className="text-blue-400">Seamless Blending</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Action Buttons */}
        <div className="space-y-4 mb-6">
          {!mediaData ? (
            <button
              onClick={capturePhoto}
              disabled={!!error || !webcamRef.current}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-xl hover:opacity-90 transition disabled:opacity-50 text-lg font-semibold shadow-lg"
              style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
            >
              <Camera className="w-7 h-7" />
              {!webcamRef.current ? 'Initializing Camera...' : 'Take Photo for Enhanced SDXL'}
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
                {processing ? 'Creating with Enhanced SDXL...' : 'Generate with Enhanced SDXL'}
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

          {/* Enhanced Auto-upload Status */}
          {processedMedia && (
            <div className="text-center text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3">
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400 inline mr-2" />
                  <span className="text-blue-400">
                    Auto-saving to Gallery... {uploadAttempts > 0 && `(Attempt ${uploadAttempts})`}
                  </span>
                </>
              ) : uploadSuccess ? (
                <>
                  <ImageIcon className="w-4 h-4 text-green-400 inline mr-2" />
                  <span className="text-green-400">Successfully saved to Gallery!</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-purple-400 inline mr-2" />
                  <span className="text-purple-400">Enhanced generation complete - preparing to save...</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Enhanced Debug Information */}
        {(config?.enable_debug_mode || debugInfo) && (
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg text-xs text-gray-400 space-y-2">
            <h4 className="text-white font-semibold mb-2">Enhanced SDXL Debug Info</h4>
            <p><span className="text-purple-400 font-semibold">Model:</span> Enhanced SDXL with Seamless Blending</p>
            <p><span className="text-blue-400 font-semibold">Mode:</span> {currentModelType}</p>
            <p><span className="text-green-400 font-semibold">Face Mode:</span> {config?.face_preservation_mode || 'preserve_face'}</p>
            <p><span className="text-yellow-400 font-semibold">Attempts:</span> {generationAttempts}/3</p>
            <p><span className="text-indigo-400 font-semibold">Strength:</span> {config?.face_preservation_mode === 'preserve_face' ? '0.32 (Conservative)' : '0.65 (Moderate)'}</p>
            <p><span className="text-pink-400 font-semibold">CFG Scale:</span> {config?.sdxl_cfg_scale || '7.5'}</p>
            <p><span className="text-cyan-400 font-semibold">Resolution:</span> 1024x1024 SDXL Native</p>
            <p><span className="text-orange-400 font-semibold">Steps:</span> {config?.sdxl_steps || '25'}</p>
            <p><span className="text-teal-400 font-semibold">Enhancements:</span> Smart Cropping, Anti-Distortion, Seamless Blending</p>
            <p><span className="text-violet-400 font-semibold">Upload Attempts:</span> {uploadAttempts}</p>
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