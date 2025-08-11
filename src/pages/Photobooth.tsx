import React, { useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Image as ImageIcon, Wand2, AlertCircle, Video, RefreshCw, Users, UserX } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { uploadPhoto } from '../lib/supabase';
import { generateImage } from '../lib/stableDiffusion';
import { loadFaceApiModels } from '../lib/faceDetection';

export default function Photobooth() {
  const { config } = useConfigStore();
  const [mediaData, setMediaData] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processedMedia, setProcessedMedia] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentModelType, setCurrentModelType] = useState<'image' | 'video'>('image');
  const [generationAttempts, setGenerationAttempts] = useState(0);
  
  const webcamRef = React.useRef<Webcam>(null);

  // Environment variable checker for debugging
  useEffect(() => {
    const checkEnv = () => {
      const stabilityKey = import.meta.env.VITE_STABILITY_API_KEY;
      const replicateKey = import.meta.env.VITE_REPLICATE_API_KEY;
      
      console.log('🔍 API Keys Status:');
      console.log('Stability AI:', stabilityKey ? 
        `✅ Present (${stabilityKey.substring(0, 10)}...)` : 
        '❌ Missing'
      );
      console.log('Replicate:', replicateKey ? 
        `✅ Present (${replicateKey.substring(0, 10)}...)` : 
        '❌ Missing'
      );

      if (!stabilityKey && !replicateKey) {
        console.warn('⚠️ No AI service keys found - generation will fail');
        setError('No AI service API keys configured. Please check your environment variables.');
      }
    };
    
    checkEnv();
    
    // Load face detection models
    loadFaceApiModels().catch(error => {
      console.warn('Failed to load face detection models:', error);
      // Don't set error state as this is not critical for basic functionality
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

  const resizeImage = async (imageData: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      const timeout = setTimeout(() => {
        img.src = '';
        reject(new Error('Image loading timed out. Please try again.'));
      }, 10000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          const targetWidth = 1024;
          const targetHeight = 1024;

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          // Fill with black background
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Calculate dimensions to maintain aspect ratio
          let drawWidth = targetWidth;
          let drawHeight = targetHeight;
          const aspectRatio = img.width / img.height;

          if (aspectRatio > 1) {
            drawHeight = targetWidth / aspectRatio;
          } else {
            drawWidth = targetHeight * aspectRatio;
          }

          const x = (targetWidth - drawWidth) / 2;
          const y = (targetHeight - drawHeight) / 2;

          ctx.drawImage(img, x, y, drawWidth, drawHeight);

          const resizedImage = canvas.toDataURL('image/jpeg', 0.95);
          if (!resizedImage || resizedImage === 'data:,') {
            reject(new Error('Failed to resize image - invalid output'));
            return;
          }

          resolve(resizedImage);
        } catch (error) {
          console.error('Error resizing image:', error);
          reject(new Error('Failed to resize image: ' + (error instanceof Error ? error.message : String(error))));
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Failed to load image for resizing'));
      };

      img.src = imageData;
    });
  };

  const capturePhoto = React.useCallback(() => {
    try {
      setError(null);
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) {
        throw new Error('Failed to capture photo');
      }
      setMediaData(imageSrc);
      setProcessedMedia(null);
      setGenerationAttempts(0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture photo';
      console.error('Error capturing photo:', err);
      setError(errorMessage);
      setMediaData(null);
    }
  }, [webcamRef]);

  // Helper function for better error icons
  const getErrorIcon = (error: string) => {
    if (error.includes('API') || error.includes('key')) return '🔑';
    if (error.includes('credits') || error.includes('balance')) return '💳';
    if (error.includes('network') || error.includes('connection')) return '🌐';
    if (error.includes('timeout')) return '⏱️';
    if (error.includes('rate limit')) return '🚦';
    return '❌';
  };

  // Enhanced error display component
  const ErrorDisplay = ({ error, attempts }: { error: string; attempts: number }) => (
    <div className="text-center p-4">
      <div className="text-4xl mb-2">{getErrorIcon(error)}</div>
      <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
      <p className="text-red-500 max-w-md mx-auto">{error}</p>
      {attempts > 0 && attempts < 3 && (
        <div className="mt-3">
          <p className="text-gray-400 text-sm">
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
        <p className="text-yellow-500 text-sm mt-2">
          Maximum attempts reached. Please capture a new photo.
        </p>
      )}
    </div>
  );

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

    try {
      // Increment attempt counter
      setGenerationAttempts(prev => prev + 1);

      // Resize the captured photo
      console.log('Resizing captured image...');
      const processedContent = await resizeImage(mediaData);

      console.log(`Generating AI ${currentModelType}...`);
      console.log('Prompt:', config.global_prompt);
      
      let aiContent: string;

      if (currentModelType === 'video') {
        // Video generation
        const generationPromise = generateImage(
          config.global_prompt,
          processedContent,
          'video',
          config.video_duration || 5
        );

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Video generation timed out. Please try again.')), 300000);
        });

        aiContent = await Promise.race([generationPromise, timeoutPromise]);
      } else {
        // Image generation with configurable face processing mode
        const faceMode = config.face_preservation_mode || 'preserve_face';
        console.log(`🎭 Using ${faceMode} mode...`);
        
        const generationPromise = generateImage(
          config.global_prompt,
          processedContent,
          'image',
          5,
          true, // Enable face processing
          faceMode // Pass the face preservation mode
        );

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Generation timed out. Please try again.')), 180000);
        });

        aiContent = await Promise.race([generationPromise, timeoutPromise]);
      }
      
      if (!aiContent) {
        throw new Error('Generated content is empty. Please try again.');
      }

      console.log('✅ AI generation completed successfully');
      setProcessedMedia(aiContent);
      setError(null);

      // Upload to gallery if successful
      try {
        if (config.enable_uploads && aiContent) {
          console.log('Uploading to Supabase...');
          const uploadResult = await uploadPhoto(
            aiContent, 
            config.global_prompt,
            currentModelType
          );
          
          if (uploadResult) {
            console.log('✅ Photo uploaded to gallery successfully');
          }
        }
      } catch (uploadError) {
        console.warn('Upload failed (non-critical):', uploadError);
        // Don't show upload errors to user as the generation was successful
      }

    } catch (error) {
      console.error('❌ Processing failed:', error);

      let errorMessage = 'Failed to generate AI content. Please try again.';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        // Enhanced error message mapping
        if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
          errorMessage = 'API authentication failed. Please check your API key configuration.';
        } else if (message.includes('credits') || message.includes('insufficient') || message.includes('402')) {
          errorMessage = 'Insufficient API credits. Please check your account balance.';
        } else if (message.includes('rate limit') || message.includes('429')) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (message.includes('timeout') || message.includes('timed out')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (message.includes('network') || message.includes('connection') || message.includes('econnaborted') || message.includes('enotfound')) {
          errorMessage = 'Network connection issue. Please check your internet and try again.';
        } else if (message.includes('temporarily unavailable') || message.includes('service') || message.includes('5')) {
          errorMessage = 'AI service is temporarily unavailable. Please try again in a few minutes.';
        } else if (message.includes('empty') || message.includes('invalid')) {
          errorMessage = 'Invalid response from AI service. Please try capturing a new photo.';
        } else if (message.includes('strength') || message.includes('parameter')) {
          errorMessage = 'Invalid generation parameters. Please try again.';
        } else if (message.includes('prompt')) {
          errorMessage = 'Invalid prompt configuration. Please check your settings.';
        } else {
          // Use the original error message if it's user-friendly
          if (error.message.length < 100 && !message.includes('stack') && !message.includes('undefined')) {
            errorMessage = error.message;
          }
        }
      }
      
      setError(errorMessage);
      setProcessedMedia(null);
      
    } finally {
      setProcessing(false);
    }
  };

  const reset = () => {
    setMediaData(null);
    setProcessedMedia(null);
    setError(null);
    setGenerationAttempts(0);
    if (processedMedia && processedMedia.startsWith('blob:')) {
      URL.revokeObjectURL(processedMedia);
    }
  };

  const handleWebcamError = (err: string | DOMException) => {
    const errorMessage = err instanceof DOMException ? err.message : err;
    console.error('Webcam error:', errorMessage);
    
    let userFriendlyMessage = 'Failed to access webcam';
    
    if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
      userFriendlyMessage = 'Camera access denied. Please allow camera access in your browser settings.';
    } else if (errorMessage.includes('NotFoundError') || errorMessage.includes('DevicesNotFoundError')) {
      userFriendlyMessage = 'No camera detected. Please connect a camera and try again.';
    } else if (
      errorMessage.includes('NotReadableError') || 
      errorMessage.includes('TrackStartError') || 
      errorMessage.includes('Device in use') ||
      errorMessage.includes('Could not start video source')
    ) {
      userFriendlyMessage = 'Camera is in use by another application. Please close other applications using the camera.';
    } else if (errorMessage.includes('OverconstrainedError')) {
      userFriendlyMessage = 'Camera resolution not supported. Please try a different camera.';
    }
    
    setError(userFriendlyMessage);
  };

  // Helper functions for dynamic content based on face mode
  const getProcessingText = () => {
    const faceMode = config?.face_preservation_mode || 'preserve_face';
    
    if (currentModelType === 'video') {
      return 'This may take 2-3 minutes';
    }
    
    if (faceMode === 'preserve_face') {
      return 'Preserving your face, transforming the scene...';
    } else {
      return 'Generating new character, preserving pose...';
    }
  };

  const getPreviewText = () => {
    const faceMode = config?.face_preservation_mode || 'preserve_face';
    
    if (currentModelType === 'video') {
      return 'AI generated video will appear here';
    }
    
    if (faceMode === 'preserve_face') {
      return (
        <>
          AI generated image will appear here
          <span className="block text-green-400 text-sm mt-1">with your face preserved</span>
        </>
      );
    } else {
      return (
        <>
          AI generated image will appear here
          <span className="block text-orange-400 text-sm mt-1">with new character/face</span>
        </>
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Model type indicator */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
            {currentModelType === 'video' ? (
              <>
                <Video className="w-5 h-5 text-blue-500" />
                <span className="text-white">Video Generation Mode</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5 text-green-500" />
                <span className="text-white">Smart Face Processing</span>
              </>
            )}
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Webcam section */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="aspect-square bg-black relative">
              {mediaData ? (
                <img 
                  src={mediaData} 
                  alt="Captured" 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover"
                  onUserMediaError={handleWebcamError}
                  videoConstraints={{
                    width: 1024,
                    height: 1024,
                    facingMode: "user"
                  }}
                />
              )}
              
              {/* Generation attempts indicator */}
              {generationAttempts > 0 && (
                <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                  Attempts: {generationAttempts}/3
                </div>
              )}
            </div>
          </div>

          {/* Generated content section */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="aspect-square bg-black relative flex items-center justify-center">
              {processedMedia ? (
                currentModelType === 'video' ? (
                  <video
                    src={processedMedia}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img 
                    src={processedMedia} 
                    alt="AI Generated" 
                    className="w-full h-full object-cover" 
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  {processing ? (
                    <div className="text-center p-4">
                      <RefreshCw className="w-12 h-12 mx-auto mb-3 animate-spin text-blue-500" />
                      <p className="text-white">Creating your AI {currentModelType}...</p>
                      <p className="text-gray-400 text-sm mt-2">
                        {getProcessingText()}
                      </p>
                    </div>
                  ) : error ? (
                    <ErrorDisplay error={error} attempts={generationAttempts} />
                  ) : (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {currentModelType === 'video' ? (
                          <Video className="w-8 h-8" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-green-400" />
                        )}
                      </div>
                      <p>
                        {getPreviewText()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex justify-center gap-4">
          {!mediaData ? (
            <button
              onClick={capturePhoto}
              disabled={!!error}
              className="flex items-center gap-2 px-8 py-4 rounded-lg hover:opacity-90 transition disabled:opacity-50 text-lg font-medium"
              style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
            >
              <Camera className="w-6 h-6" />
              Take Photo
            </button>
          ) : (
            <>
              <button
                onClick={reset}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 rounded-lg hover:bg-gray-700 transition"
              >
                <Camera className="w-5 h-5" />
                Retake Photo
              </button>
              <button
                onClick={processMedia}
                disabled={processing || !!error || generationAttempts >= 3}
                className="flex items-center gap-2 px-8 py-4 rounded-lg transition disabled:opacity-50 text-lg font-medium"
                style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
              >
                <Wand2 className="w-6 h-6" />
                {processing ? 'Creating Magic...' : `Create AI ${currentModelType}`}
              </button>
            </>
          )}
        </div>

        {/* Current prompt display */}
        {config?.global_prompt && (
          <div className="mt-8 bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-medium mb-2 flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              AI Generation Theme:
            </h3>
            <p className="text-gray-300 text-sm">{config.global_prompt}</p>
            {currentModelType === 'image' && (
              <div className="mt-2 flex items-center gap-2">
                {(config.face_preservation_mode || 'preserve_face') === 'preserve_face' ? (
                  <>
                    <Users className="w-4 h-4 text-green-400" />
                    <p className="text-green-400 text-xs">
                      ✨ Preserve Face Mode - Your identity will be maintained
                    </p>
                  </>
                ) : (
                  <>
                    <UserX className="w-4 h-4 text-orange-400" />
                    <p className="text-orange-400 text-xs">
                      🎭 Replace Face Mode - New character will be generated
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}