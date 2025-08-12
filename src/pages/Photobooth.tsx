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
  
  const webcamRef = React.useRef<Webcam>(null);

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

      console.log('Resizing captured image...');
      const processedContent = await resizeImage(mediaData);

      console.log(`Generating AI ${currentModelType}...`);
      console.log('Prompt:', config.global_prompt);
      
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
      }

    } catch (error) {
      console.error('❌ Processing failed:', error);

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
        } else {
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

  // Don't need separate result area anymore
  const showResultArea = false;

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
                />
              ) : (
                <img 
                  src={processedMedia} 
                  alt="AI Generated" 
                  className="w-full h-full object-cover" 
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
          
          {/* Manual Gallery Test Button */}
          <button
            onClick={async () => {
              console.log('🧪 MANUAL GALLERY TEST STARTING...');
              try {
                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(
                  import.meta.env.VITE_SUPABASE_URL!,
                  import.meta.env.VITE_SUPABASE_ANON_KEY!
                );

                // Create a test image data URL (1x1 red pixel)
                const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
                
                const response = await fetch(testImageData);
                const blob = await response.blob();
                
                const filename = `test_photo_${Date.now()}.png`;
                console.log('📤 Testing upload:', filename);

                const { data, error } = await supabase.storage
                  .from('photos')
                  .upload(filename, blob, { contentType: 'image/png', upsert: true });

                if (error) {
                  alert(`❌ Storage test failed: ${error.message}`);
                  return;
                }

                const { data: urlData } = supabase.storage
                  .from('photos')
                  .getPublicUrl(data.path);

                const { data: dbData, error: dbError } = await supabase
                  .from('photos')
                  .insert({
                    original_url: urlData.publicUrl,
                    processed_url: urlData.publicUrl,
                    prompt: 'Manual test photo',
                    content_type: 'image',
                    public: true
                  })
                  .select()
                  .single();

                if (dbError) {
                  alert(`❌ Database test failed: ${dbError.message}`);
                  return;
                }

                alert(`✅ Manual test SUCCESS!\nPhoto ID: ${dbData.id}\nCheck gallery now!`);
                
                window.dispatchEvent(new CustomEvent('galleryUpdate', {
                  detail: { newPhoto: dbData }
                }));
                
              } catch (err) {
                console.error('Test failed:', err);
                alert(`❌ Test failed: ${err.message}`);
              }
            }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 rounded-xl hover:bg-purple-700 transition font-medium"
          >
            <Wand2 className="w-5 h-5" />
            🧪 Test Gallery Upload
          </button>
        </div>

        {/* Removed separate AI result section - now shows in main view */}
      </div>
    </div>
  );
}