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

  // Update current model type when config changes
  useEffect(() => {
    if (config?.model_type) {
      // Only reset if model type has changed
      if (currentModelType !== config.model_type) {
        setCurrentModelType(config.model_type);
        reset(); // Reset state when model type changes
      }
    }
  }, [config?.model_type]);

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
      img.onload = () => {
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
        reject(new Error('Failed to load image for resizing'));
      };

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
      const processedContent = await resizeImage(mediaData);

      console.log(`Generating AI ${currentModelType} with prompt:`, config.global_prompt);
      const aiContent = await generateImage(
        config.global_prompt,
        processedContent,
        currentModelType,
        config.video_duration
      );

      setProcessedMedia(aiContent);
      setGenerationAttempts(prev => prev + 1);

      // Convert content to blob for upload
      let file: File;
      try {
        if (currentModelType === 'video') {
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
          const response = await fetch(aiContent);
          if (!response.ok) {
            throw new Error(`Failed to process generated image: ${response.statusText}`);
          }
          const blob = await response.blob();
          if (blob.size === 0) {
            throw new Error('Received empty image file');
          }
          file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
        }
      } catch (err) {
        console.error('Error creating file:', err);
        throw new Error(`Failed to process ${currentModelType} data for upload: ${err instanceof Error ? err.message : String(err)}`);
      }

      const result = await uploadPhoto(file, config.global_prompt);
      if (!result) {
        throw new Error('Failed to save to gallery');
      }
    } catch (error) {
      console.error('Error processing media:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Model type indicator */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-full">
            {currentModelType === 'video' ? (
              <>
                <Video className="w-5 h-5" />
                <span>Video Mode</span>
                <span className="text-xs text-gray-400 ml-2">(Image-to-Video)</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-5 h-5" />
                <span>Image Mode</span>
              </>
            )}
          </div>
          {currentModelType === 'video' && (
            <p className="text-sm text-gray-400 mt-2">
              Take a photo to generate a video using Stability AI's image-to-video technology
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-black">
            {!mediaData ? (
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full h-full object-cover"
                videoConstraints={{
                  width: 1024,
                  height: 1024,
                  facingMode: "user"
                }}
                onUserMediaError={handleWebcamError}
                mirrored={true}
              />
            ) : (
              <img
                src={mediaData}
                alt="Captured"
                className="w-full h-full object-cover"
              />
            )}
          </div>

          <div className="relative aspect-square rounded-lg overflow-hidden bg-black">
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
                  </div>
                ) : error ? (
                  <div className="text-center p-4">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
                    <p className="text-red-500 max-w-md">{error}</p>
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

        <div className="mt-6 flex justify-center gap-4">
          {!mediaData ? (
            <button
              onClick={capturePhoto}
              disabled={!!error}
              className="flex items-center gap-2 px-6 py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
              style={{ backgroundColor: config?.primary_color }}
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
                style={{ backgroundColor: config?.primary_color }}
              >
                <Wand2 className="w-5 h-5" />
                {processing ? 'Processing...' : `Generate AI ${currentModelType}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}