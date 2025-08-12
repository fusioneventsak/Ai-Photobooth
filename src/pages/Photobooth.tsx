import React, { useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, ImageIcon, Wand2, AlertCircle, Video, RefreshCw, Users, UserX, Lightbulb, Eye, User } from 'lucide-react';
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
  const [showInstructions, setShowInstructions] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadAttempts, setUploadAttempts] = useState(0);
  
  const webcamRef = React.useRef<Webcam>(null);

  // Enhanced image validation function
  const validateImageData = (imageData: string): { isValid: boolean; error?: string; info: any } => {
    const info = {
      type: typeof imageData,
      length: imageData.length,
      startsWithData: imageData.startsWith('data:'),
      format: null,
      base64Length: 0,
      mimeType: null
    };

    if (typeof imageData !== 'string') {
      return { isValid: false, error: 'Image data must be a string', info };
    }

    if (!imageData.startsWith('data:')) {
      return { isValid: false, error: 'Image data must be a data URL', info };
    }

    try {
      const [header, base64Data] = imageData.split(',');
      if (!base64Data) {
        return { isValid: false, error: 'No base64 data found', info };
      }

      const mimeMatch = header.match(/data:([^;]+)/);
      info.mimeType = mimeMatch ? mimeMatch[1] : null;
      info.base64Length = base64Data.length;
      
      // Try to decode to check validity
      atob(base64Data);
      
      return { isValid: true, info };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Invalid base64 data: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        info 
      };
    }
  };

  // Environment variable checker for debugging
  useEffect(() => {
    const checkEnv = () => {
      const stabilityKey = import.meta.env.VITE_STABILITY_API_KEY;
      const replicateKey = import.meta.env.VITE_REPLICATE_API_KEY;
      
      console.log('🔍 API Keys Status Check:');
      console.log('Stability AI:', stabilityKey ? 
        `✅ Present (${stabilityKey.substring(0, 10)}...)` : 
        '❌ Missing - Set VITE_STABILITY_API_KEY in your .env file'
      );
      console.log('Replicate:', replicateKey ? 
        `✅ Present (${replicateKey.substring(0, 10)}...)` : 
        '❌ Missing - Set VITE_REPLICATE_API_KEY in your .env file'
      );

      if (!stabilityKey && !replicateKey) {
        console.warn('⚠️ No AI service keys found - generation will fail');
        setError('🔑 Missing API Keys: Please configure VITE_STABILITY_API_KEY or VITE_REPLICATE_API_KEY in your environment variables to generate AI images.');
        return;
      }

      // Test API key validity for Stability AI
      if (stabilityKey) {
        fetch('https://api.stability.ai/v1/user/account', {
          headers: {
            'Authorization': `Bearer ${stabilityKey}`
          }
        })
        .then(response => {
          if (response.status === 403) {
            console.error('❌ Stability AI: Invalid API key or insufficient credits');
            setError('🔑 Stability AI API key is invalid or has insufficient credits. Please check your API key and account balance.');
          } else if (response.ok) {
            console.log('✅ Stability AI API key is valid');
          }
        })
        .catch(err => {
          console.warn('⚠️ Could not verify Stability AI key:', err);
        });
      }
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

  // BULLETPROOF AUTOMATIC UPLOAD TRIGGER - Runs whenever processedMedia changes
  useEffect(() => {
    const guaranteedUpload = async () => {
      // Only upload if we have processed media, config, not currently processing, and not already uploading
      if (!processedMedia || !config || processing || uploading) {
        console.log('🔍 Upload conditions not met:', {
          hasProcessedMedia: !!processedMedia,
          hasConfig: !!config,
          processing,
          uploading
        });
        return;
      }

      // Check if this image was already uploaded (prevent duplicates)
      const uploadedKey = `uploaded_${processedMedia.substring(0, 50)}`;
      if (sessionStorage.getItem(uploadedKey)) {
        console.log('🔄 Image already uploaded, skipping duplicate upload');
        return;
      }

      console.log('🚀 === BULLETPROOF AUTOMATIC UPLOAD TRIGGERED ===');
      console.log('📊 Upload trigger details:', {
        hasProcessedMedia: !!processedMedia,
        mediaLength: processedMedia.length,
        mediaType: processedMedia.startsWith('data:') ? 'data URL' : 'blob URL',
        hasConfig: !!config,
        processing,
        uploading,
        currentModelType,
        prompt: config.global_prompt || 'AI Generated Image'
      });

      setUploading(true);

      try {
        // Multiple attempts with different delays to ensure upload succeeds
        let uploadSuccess = false;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            setUploadAttempts(attempt);
            console.log(`📤 Upload attempt ${attempt}/3...`);
            
            // Wait longer on subsequent attempts
            const delay = attempt === 1 ? 500 : attempt * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));

            console.log('📋 Upload parameters for attempt:', {
              contentType: currentModelType,
              promptLength: config.global_prompt?.length || 0,
              prompt: config.global_prompt || 'AI Generated Image'
            });
            
            const uploadResult = await uploadPhoto(
              processedMedia,
              config.global_prompt || 'AI Generated Image',
              currentModelType
            );
            
            if (!uploadResult) {
              throw new Error(`Upload attempt ${attempt} returned null result`);
            }
            
            console.log(`🎉 === UPLOAD ATTEMPT ${attempt} SUCCESSFUL ===`);
            console.log('📊 Upload result:', {
              id: uploadResult.id,
              url: uploadResult.processed_url,
              type: uploadResult.content_type,
              created: uploadResult.created_at,
              prompt: uploadResult.prompt?.substring(0, 50) + '...'
            });

            // Mark as uploaded to prevent duplicates
            sessionStorage.setItem(uploadedKey, JSON.stringify({
              uploadedAt: new Date().toISOString(),
              photoId: uploadResult.id,
              attempt: attempt
            }));

            // === GUARANTEED GALLERY UPDATE EVENTS ===
            console.log('📢 Dispatching multiple gallery update events...');
            
            // Primary event
            const galleryEvent = new CustomEvent('galleryUpdate', {
              detail: { 
                newPhoto: uploadResult,
                source: 'automatic_upload',
                timestamp: new Date().toISOString(),
                attempt: attempt
              }
            });
            
            window.dispatchEvent(galleryEvent);
            
            // Backup events with slight delays
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('galleryUpdate', {
                detail: { 
                  newPhoto: uploadResult,
                  source: 'automatic_upload_backup_1',
                  timestamp: new Date().toISOString()
                }
              }));
            }, 100);
            
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('galleryUpdate', {
                detail: { 
                  newPhoto: uploadResult,
                  source: 'automatic_upload_backup_2',
                  timestamp: new Date().toISOString()
                }
              }));
            }, 500);
            
            // Storage event as additional backup
            localStorage.setItem('galleryRefresh', JSON.stringify({
              timestamp: Date.now(),
              photoId: uploadResult.id,
              source: 'automatic_upload'
            }));
            
            console.log('✅ All gallery update events dispatched successfully');
            console.log('🎯 Gallery should refresh automatically now!');
            
            uploadSuccess = true;
            setUploadSuccess(true);
            
            // Hide success indicator after 3 seconds
            setTimeout(() => setUploadSuccess(false), 3000);
            
            break; // Exit retry loop on success

          } catch (attemptError) {
            lastError = attemptError instanceof Error ? attemptError : new Error('Unknown upload error');
            console.error(`❌ Upload attempt ${attempt} failed:`, lastError);
            
            if (attempt < 3) {
              console.log(`⏳ Retrying upload in ${attempt * 1000}ms...`);
            }
          }
        }

        if (!uploadSuccess) {
          throw lastError || new Error('All upload attempts failed');
        }

      } catch (uploadError) {
        console.error('❌ === ALL AUTOMATIC UPLOAD ATTEMPTS FAILED ===');
        console.error('📊 Final upload error:', uploadError);
        
        // Don't show error to user since the image is still generated successfully
        console.warn('⚠️ Image generated successfully but automatic gallery save failed after multiple attempts');
        console.warn('🎯 User can still see the generated image in the photobooth');
        
        // Log detailed debugging info
        console.error('🔍 Debug info for failed upload:', {
          processedMediaType: typeof processedMedia,
          processedMediaLength: processedMedia?.length,
          processedMediaStart: processedMedia?.substring(0, 100),
          configExists: !!config,
          globalPrompt: config?.global_prompt,
          currentModelType,
          error: uploadError instanceof Error ? uploadError.message : uploadError
        });
        
      } finally {
        setUploading(false);
        setUploadAttempts(0);
      }
    };

    // Trigger upload with a small delay to ensure everything is ready
    if (processedMedia && !processing) {
      console.log('🎯 processedMedia detected, scheduling automatic upload...');
      setTimeout(() => {
        guaranteedUpload();
      }, 200); // Small delay to ensure state is fully updated
    }

  }, [processedMedia, config, processing, currentModelType, uploading]);

  // BACKUP UPLOAD TRIGGER - Runs 5 seconds after processedMedia changes as final safety net
  useEffect(() => {
    if (!processedMedia || !config) return;

    const backupUploadTimer = setTimeout(async () => {
      const uploadedKey = `uploaded_${processedMedia.substring(0, 50)}`;
      const uploadRecord = sessionStorage.getItem(uploadedKey);
      
      if (uploadRecord) {
        console.log('🔍 Backup check: Image already uploaded, skipping backup');
        return;
      }

      console.log('⚠️ === BACKUP UPLOAD TRIGGER ACTIVATED ===');
      console.log('📊 Main upload may have failed, attempting backup upload...');
      
      try {
        const uploadResult = await uploadPhoto(
          processedMedia,
          config.global_prompt || 'AI Generated Image (Backup Upload)',
          currentModelType
        );

        if (uploadResult) {
          console.log('🎉 === BACKUP UPLOAD SUCCESSFUL ===');
          
          // Mark as uploaded
          sessionStorage.setItem(uploadedKey, JSON.stringify({
            uploadedAt: new Date().toISOString(),
            photoId: uploadResult.id,
            source: 'backup_upload'
          }));

          // Dispatch gallery events
          window.dispatchEvent(new CustomEvent('galleryUpdate', {
            detail: { 
              newPhoto: uploadResult,
              source: 'backup_upload',
              timestamp: new Date().toISOString()
            }
          }));

          localStorage.setItem('galleryRefresh', JSON.stringify({
            timestamp: Date.now(),
            photoId: uploadResult.id,
            source: 'backup_upload'
          }));

          console.log('✅ Backup upload completed successfully');
        }
      } catch (backupError) {
        console.error('❌ Backup upload also failed:', backupError);
        console.error('🚨 Both primary and backup uploads failed - manual intervention may be needed');
      }
    }, 5000); // 5 second delay

    return () => clearTimeout(backupUploadTimer);
  }, [processedMedia, config, currentModelType]);

  // Enhanced resize function with validation
  const resizeImage = async (imageData: string): Promise<string> => {
    console.log('🔍 Starting image resize with validation...');
    
    // Validate input
    const validation = validateImageData(imageData);
    if (!validation.isValid) {
      throw new Error(`Invalid input image: ${validation.error}`);
    }
    
    console.log('📊 Input validation passed:', validation.info);

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      const timeout = setTimeout(() => {
        img.src = '';
        reject(new Error('Image loading timed out. Please try again.'));
      }, 10000);

      img.onload = () => {
        clearTimeout(timeout);
        
        try {
          console.log('🖼️ Original image loaded:', {
            width: img.width,
            height: img.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          });

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

          console.log('🎨 Drawing image:', {
            sourceSize: `${img.width}x${img.height}`,
            targetSize: `${targetWidth}x${targetHeight}`,
            drawSize: `${drawWidth}x${drawHeight}`,
            position: `${x},${y}`,
            aspectRatio
          });

          ctx.drawImage(img, x, y, drawWidth, drawHeight);

          const resizedImage = canvas.toDataURL('image/jpeg', 0.95);
          
          // Validate output
          const outputValidation = validateImageData(resizedImage);
          if (!outputValidation.isValid) {
            reject(new Error(`Invalid output image: ${outputValidation.error}`));
            return;
          }

          if (!resizedImage || resizedImage === 'data:,') {
            reject(new Error('Failed to resize image - invalid output'));
            return;
          }

          console.log('✅ Image resize completed:', {
            inputSize: validation.info.length,
            outputSize: outputValidation.info.length,
            compression: ((validation.info.length - outputValidation.info.length) / validation.info.length * 100).toFixed(1) + '%'
          });

          resolve(resizedImage);
        } catch (error) {
          console.error('❌ Canvas processing error:', error);
          reject(new Error('Failed to resize image: ' + (error instanceof Error ? error.message : String(error))));
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        console.error('❌ Failed to load image for resizing');
        reject(new Error('Failed to load image for resizing'));
      };

      console.log('📥 Loading image for resize...');
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
      
      console.log('📷 Photo captured:', {
        format: imageSrc.substring(0, 30) + '...',
        size: imageSrc.length
      });
      
      setMediaData(imageSrc);
      setProcessedMedia(null);
      setGenerationAttempts(0);
      setShowInstructions(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to capture photo';
      console.error('Error capturing photo:', err);
      setError(errorMessage);
      setMediaData(null);
    }
  }, [webcamRef]);

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

  // Enhanced processMedia function with automatic upload
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
      setGenerationAttempts(prev => prev + 1);

      console.log('🔄 Starting AI generation process...');
      console.log('📋 Generation details:', {
        prompt: config.global_prompt,
        modelType: currentModelType,
        faceMode: config.face_preservation_mode || 'preserve_face',
        attempt: generationAttempts + 1
      });

      // Resize image first
      console.log('🖼️ Resizing captured image...');
      const processedContent = await resizeImage(mediaData);
      
      // Verify the resized image
      if (!processedContent || !processedContent.startsWith('data:image/')) {
        throw new Error('Image resizing failed - invalid output format');
      }
      
      console.log('✅ Image resized successfully:', {
        originalSize: mediaData.length,
        processedSize: processedContent.length,
        format: processedContent.substring(0, 50) + '...'
      });

      console.log(`🎨 Generating AI ${currentModelType}...`);
      
      let aiContent: string;

      if (currentModelType === 'video') {
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
        const faceMode = config.face_preservation_mode || 'preserve_face';
        console.log(`🎭 Using ${faceMode} mode...`);
        
        const generationPromise = generateImage(
          config.global_prompt,
          processedContent,
          'image',
          5,
          true,
          faceMode
        );

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Generation timed out. Please try again.')), 180000);
        });

        aiContent = await Promise.race([generationPromise, timeoutPromise]);
      }
      
      // Validate AI content
      if (!aiContent) {
        throw new Error('Generated content is empty. Please try again.');
      }

      // Check if it's a valid data URL or blob URL
      if (!aiContent.startsWith('data:') && !aiContent.startsWith('blob:')) {
        console.error('❌ Invalid AI content format:', aiContent.substring(0, 100));
        throw new Error('Invalid AI content format received.');
      }

      console.log('🔍 Validating AI generated content...', {
        contentType: typeof aiContent,
        length: aiContent.length,
        startsWithData: aiContent.startsWith('data:'),
        startsWithBlob: aiContent.startsWith('blob:'),
        preview: aiContent.substring(0, 100) + '...'
      });

      // Test if the generated image can be loaded (for data URLs only)
      if (aiContent.startsWith('data:')) {
        const testImg = new Image();
        await new Promise<void>((resolve, reject) => {
          testImg.onload = () => {
            console.log('✅ AI generated image loads successfully:', {
              width: testImg.width,
              height: testImg.height
            });
            resolve();
          };
          testImg.onerror = () => {
            console.error('❌ AI generated image failed to load!');
            reject(new Error('Generated image is corrupted'));
          };
          testImg.src = aiContent;
          
          // Timeout after 5 seconds
          setTimeout(() => {
            reject(new Error('Image validation timeout'));
          }, 5000);
        });
      }

      console.log('✅ AI generation completed successfully:', {
        type: currentModelType,
        format: aiContent.startsWith('data:') ? 'data URL' : 'blob URL',
        size: aiContent.length
      });

      // Update UI - this will trigger the automatic upload via useEffect
      setProcessedMedia(aiContent);
      setError(null);

      console.log('🎯 processMedia completed - automatic upload should trigger via useEffect');

    } catch (error) {
      console.error('❌ === AI GENERATION FAILED ===');
      console.error('📊 Generation error details:', error);

      let errorMessage = 'Failed to generate AI content. Please try again.';
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        
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
        } else if (message.includes('resize') || message.includes('format')) {
          errorMessage = 'Image processing failed. Please try capturing a new photo.';
        } else if (message.includes('corrupted') || message.includes('validation')) {
          errorMessage = 'Generated image failed validation. Please try again.';
        } else {
          // Only show the original error message if it's user-friendly
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
    setShowInstructions(true);
    setUploading(false);
    setUploadSuccess(false);
    setUploadAttempts(0);
    if (processedMedia && processedMedia.startsWith('blob:')) {
      URL.revokeObjectURL(processedMedia);
    }
    // Clear session storage for this session
    sessionStorage.clear();
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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 p-4 text-center border-b border-gray-700">
        <div className="flex items-center justify-center gap-3 mb-2">
          {currentModelType === 'video' ? (
            <>
              <Video className="w-6 h-6 text-blue-500" />
              <span className="text-white font-medium">AI Video Generator</span>
            </>
          ) : (
            <>
              <ImageIcon className="w-6 h-6 text-green-500" />
              <span className="text-white font-medium">AI Photo Magic</span>
            </>
          )}
          {/* Upload Status Indicator */}
          {(uploading || uploadSuccess) && (
            <div className="inline-flex items-center gap-2 bg-blue-600/20 px-3 py-1 rounded-full">
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-blue-400 text-sm">
                    Saving to Gallery... {uploadAttempts > 0 && `(${uploadAttempts}/3)`}
                  </span>
                </>
              ) : uploadSuccess ? (
                <>
                  <ImageIcon className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 text-sm">Saved to Gallery!</span>
                </>
              ) : null}
            </div>
          )}
        </div>
        {config?.global_prompt && (
          <p className="text-gray-300 text-sm px-2">
            {config.global_prompt}
          </p>
        )}
      </div>

      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Photography Instructions */}
        {showInstructions && !mediaData && (
          <div className="mb-6 bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-500/30 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Get the Best Results
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Good Lighting:</span>
                  <span className="text-gray-300"> Face the light source, avoid shadows on your face</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Eye className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Face the Camera:</span>
                  <span className="text-gray-300"> Look directly at the lens for best face detection</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-white font-medium">Chest Up Shot:</span>
                  <span className="text-gray-300"> Frame from chest to top of head for optimal results</span>
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
                  className="w-full h-full object-cover"
                  data-testid="processed-media"
                />
              ) : (
                <img 
                  src={processedMedia} 
                  alt="AI Generated" 
                  className="w-full h-full object-cover"
                  data-testid="processed-media"
                />
              )
            ) : processing ? (
              // Show processing state with enhanced loading animation
              <div className="flex items-center justify-center h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20">
                <div className="text-center p-8">
                  {/* Main loading animation */}
                  <div className="relative mb-6">
                    <div className="w-20 h-20 mx-auto">
                      {/* Outer spinning ring */}
                      <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full animate-spin border-t-blue-500"></div>
                      {/* Inner pulsing circle */}
                      <div className="absolute inset-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full animate-pulse flex items-center justify-center">
                        <Wand2 className="w-8 h-8 text-white animate-bounce" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Loading text */}
                  <p className="text-white text-xl font-semibold mb-3">
                    Creating your AI {currentModelType}
                    <span className="animate-pulse">...</span>
                  </p>
                  
                  {/* Detailed status */}
                  <div className="text-gray-300 text-sm space-y-2">
                    <p className="font-medium">{getProcessingText()}</p>
                    
                    {/* Progress indicator */}
                    <div className="mt-4">
                      <div className="flex justify-center space-x-1 mb-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"
                            style={{
                              animationDelay: `${i * 0.2}s`,
                              animationDuration: '1s'
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-gray-400">
                        {currentModelType === 'video' ? 'Video generation in progress...' : 'Processing your image...'}
                      </p>
                    </div>
                    
                    {/* Generation attempt indicator */}
                    {generationAttempts > 0 && (
                      <div className="mt-4 inline-flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        <span className="text-xs">Attempt {generationAttempts}/3</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : error && !showInstructions ? (
              // Show error state
              <div className="flex items-center justify-center h-full">
                <ErrorDisplay error={error} attempts={generationAttempts} />
              </div>
            ) : mediaData ? (
              // Show captured photo
              <img 
                src={mediaData} 
                alt="Captured" 
                className="w-full h-full object-cover" 
              />
            ) : (
              // Show camera preview
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
            {generationAttempts > 0 && !processedMedia && (
              <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-lg text-sm">
                Attempt {generationAttempts}/3
              </div>
            )}

            {/* Face mode indicator - only show during camera preview */}
            {currentModelType === 'image' && config && !mediaData && !processing && !processedMedia && (
              <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                {(config.face_preservation_mode || 'preserve_face') === 'preserve_face' ? (
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
            )}

            {/* AI Result indicator */}
            {processedMedia && (
              <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                <Wand2 className="w-3 h-3 text-purple-400" />
                <span className="text-purple-400">AI Generated</span>
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
                {processing ? 'Creating Magic...' : `Generate AI ${currentModelType}`}
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

          {/* Enhanced Auto-upload status message */}
          {processedMedia && (
            <div className="text-center text-sm text-gray-400 bg-gray-800/50 rounded-lg p-3">
              {uploading ? (
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Automatically saving to gallery...</span>
                  {uploadAttempts > 0 && (
                    <span className="text-yellow-400">Attempt {uploadAttempts}/3</span>
                  )}
                </div>
              ) : uploadSuccess ? (
                <div className="flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">✅ Automatically saved to gallery!</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400">🔄 Auto-saving to gallery...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}