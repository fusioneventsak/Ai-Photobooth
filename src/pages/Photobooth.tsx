// Update the processMedia function in Photobooth.tsx

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
    // Resize the captured photo
    console.log('Resizing captured image...');
    const processedContent = await resizeImage(mediaData);

    console.log(`Generating AI ${currentModelType}...`);
    console.log('Prompt:', config.global_prompt);
    console.log('Face Mode:', config.face_preservation_mode || 'preserve_face');
    
    let aiContent: string;

    if (currentModelType === 'video') {
      // Video generation
      const generationPromise = generateImage(
        config.global_prompt,
        processedContent,
        'video',
        config.video_duration
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

    // Upload to gallery if successful
    try {
      const uploadResult = await uploadPhoto(
        aiContent, 
        config.global_prompt,
        currentModelType
      );
      
      if (uploadResult) {
        console.log('✅ Photo uploaded to gallery successfully');
      }
    } catch (uploadError) {
      console.warn('Failed to upload to gallery:', uploadError);
      // Don't show error to user as the main generation succeeded
    }

    // Increment attempts for successful generation too (to track usage)
    setGenerationAttempts(prev => prev + 1);

  } catch (error) {
    setGenerationAttempts(prev => prev + 1);
    console.error('❌ Processing failed:', error);

    let errorMessage = 'Failed to generate AI content. Please try again.';
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('api key') || message.includes('unauthorized') || message.includes('invalid key')) {
        errorMessage = 'Invalid API key configuration. Please check your API keys in the admin panel.';
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
      } else {
        errorMessage = error.message;
      }
    }
    
    setError(errorMessage);
    setProcessedMedia(null);
    
  } finally {
    setProcessing(false);
  }
};

// Update the processing indicator text based on face mode
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

// Update the preview text based on face mode
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

// Update the current prompt display to show the face mode
const getCurrentPromptDisplay = () => {
  if (!config?.global_prompt) return null;
  
  const faceMode = config?.face_preservation_mode || 'preserve_face';
  
  return (
    <div className="mt-8 bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-medium mb-2 flex items-center gap-2">
        <Wand2 className="w-4 h-4" />
        AI Generation Theme:
      </h3>
      <p className="text-gray-300 text-sm">{config.global_prompt}</p>
      {currentModelType === 'image' && (
        <div className="mt-2 flex items-center gap-2">
          {faceMode === 'preserve_face' ? (
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
  );
};