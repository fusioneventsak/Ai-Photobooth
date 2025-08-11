import React, { useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Image as ImageIcon, Wand2, AlertCircle, Video, RefreshCw } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { uploadPhoto } from '../lib/supabase';
import { generateImage } from '../lib/stableDiffusion';

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
  }, []);

  // Update current model type when config changes
  useEffect(() => {
    if (config?.model_type) {
      // Only reset if model type has changed
      if (currentModelType !== config.model_type) {
        setCurrentModelType(config.model_type);
        reset(); // Reset state when model type changes
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
      
      // Handle image load timeout
      const timeout = setTimeout(() => {
        img.src = '';
        reject(new Error('Image loading timed out. Please try again.'));
      }, 10000); // 10 second timeout

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Use 1024x1024 for Stability AI compatibility
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

          // Center the image
          const x = (targetWidth - drawWidth) / 2;
          const y = (targetHeight - drawHeight) / 2;

          // Draw the image centered and maintaining aspect ratio
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

  const processMedia = async () => {
    if (!mediaData) {
      setError('No photo captured');
      return;
    }

    if (!config) {
      setError('Application configuration not loaded');
      return;
    }

    // Don't allow more than 3 attempts
    if (generationAttempts >= 3) {
      setError('Maximum generation attempts reached. Please try capturing a new photo.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Resize the captured photo to 1024x1024
      console.log('Resizing captured image...');
      const processedContent = await resizeImage(mediaData);

      console.log(`Generating AI ${currentModelType} with prompt:`, config.global_prompt);
      
      // Add timeout wrapper for the generation
      const generationPromise = generateImage(
        config.global_prompt,
        processedContent,
        currentModelType,
        config.video_duration
      );

      // Set a timeout for the entire generation process (3 minutes)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Generation timed out. Please try again.')), 180000);
      });

      const aiContent = await Promise.race([generationPromise, timeoutPromise]);
      
      if (!aiContent) {
        throw new Error('Generated content is empty. Please try again.');
      }

      setProcessedMedia(aiContent);
      setGenerationAttempts(prev => prev + 1);

      // Convert content to blob for upload
      let file: File;
      try {
        if (currentModelType === 'video') {
          // Handle video blob URL
          if (aiContent.startsWith('blob:')) {
            const response = await fetch(aiContent);
            if (!response.ok) {
              throw new Error(`Failed to process generated video: ${response.statusText}`);
            }
            const blob = await response.blob();
            if (blob.size === 0) {
              throw new Error('Received empty video file');
            }
            file = new File([blob], 'video.mp4', { type: 'video/mp4' });
          } else {
            throw new Error('Invalid video content format');
          }
        } else {
          // Handle image data URL or blob URL
          if (aiContent.startsWith('data:')) {
            // Convert data URL to blob
            const response = await fetch(aiContent);
            if (!response.ok) {
              throw new Error(`Failed to process generated image: ${response.statusText}`);
            }
            const blob = await response.blob();
            if (blob.size === 0) {
              throw new Error('Received empty image file');
            }
            file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
          } else if (aiContent.startsWith('blob:')) {
            const response = await fetch(aiContent);
            if (!response.ok) {
              throw new Error(`Failed to process generated image: ${response.statusText}`);
            }
            const blob = await response.blob();
            if (blob.size === 0) {
              throw new Error('Received empty image file');
            }
            file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
          } else {
            throw new Error('Invalid image content format');
          }
        }
      } catch (err) {
        console.error('Error creating file:', err);
        throw new Error(`Failed to process ${currentModelType} data for upload: ${
          err instanceof Error ? err.message : String(err)
        }`);
      }

      // Upload to gallery
      console.log('Uploading to gallery...');
      const result = await uploadPhoto(file, config.global_prompt);
      if (!result) {
        throw new Error('Failed to save to gallery');
      }

      console.log('✅ Generation and upload completed successfully');

    } catch (error) {
      console.error('Error processing media:', error);
      
      // Enhanced error handling with specific error messages
      let errorMessage = 'An unexpected error occurred';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
        // API-specific errors
        if (message.includes('api key') || message.includes('unauthorized')) {
          errorMessage = 'API authentication failed. Please check your API keys in the configuration.';
        } else if (message.includes('credits') || message.includes('billing')) {
          errorMessage = 'Account credits depleted. Please check your API account balance.';
        } else if (message.includes('rate limit') || message.includes('too many requests')) {
          errorMessage = 'Too many requests. Please wait a few minutes and try again.';
        } else if (message.includes('timeout') || message.includes('timed out')) {
          errorMessage = 'Request timed out. The AI service might be busy. Please try again.';
        } else if (message.includes('network') || message.includes('connection')) {
          errorMessage = 'Network connection issue. Please check your internet and try again.';
        } else if (message.includes('temporarily unavailable') || message.includes('service')) {
          errorMessage = 'AI service is temporarily unavailable. Please try again in a few minutes.';
        } else if (message.includes('empty') || message.includes('invalid')) {
          errorMessage = 'Invalid response from AI service. Please try capturing a new photo.';
        } else if (message.includes('both ai services failed')) {
          errorMessage = 'All AI services are currently unavailable. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setError(errorMessage);
      setProcessedMedia(null);
      
      // Log detailed error for debugging
      console.error('Detailed error info:', {
        error: error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        timestamp: new Date().toISOString()
      });
      
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
                <span className="text-white">Image Generation Mode</span>
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
                      <p className="text-white">Processing your {currentModelType}...</p>
                      <p className="text-gray-400 text-sm mt-2">This may take 1-2 minutes</p>
                    </div>
                  ) : error ? (
                    <div className="text-center p-4">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
                      <p className="text-red-500 max-w-md">{error}</p>
                      {generationAttempts > 0 && generationAttempts < 3 && (
                        <p className="text-gray-400 text-sm mt-2">
                          You can try again ({3 - generationAttempts} attempts remaining)
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {currentModelType === 'video' ? (
                          <Video className="w-8 h-8" />
                        ) : (
                          <ImageIcon className="w-8 h-8" />
                        )}
                      </div>
                      <p>AI generated {currentModelType} will appear here</p>
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
              className="flex items-center gap-2 px-6 py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
            >
              <Camera className="w-5 h-5" />
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
                className="flex items-center gap-2 px-6 py-3 rounded-lg transition disabled:opacity-50"
                style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
              >
                <Wand2 className="w-5 h-5" />
                {processing ? 'Processing...' : `Generate AI ${currentModelType}`}
              </button>
            </>
          )}
        </div>

        {/* Current prompt display */}
        {config?.global_prompt && (
          <div className="mt-8 bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-medium mb-2">Current Generation Prompt:</h3>
            <p className="text-gray-300 text-sm">{config.global_prompt}</p>
          </div>
        )}
      </div>
    </div>
  );
}