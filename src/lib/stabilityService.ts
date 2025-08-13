// src/lib/stabilityService.ts - Fixed client-side service for Stability AI
import { supabase } from './supabase';

interface StabilityGenerationOptions {
  prompt: string;
  imageData: string;
  mode?: 'image-to-image' | 'inpaint';
  maskData?: string;
  strength?: number;
  cfgScale?: number;
  negativePrompt?: string;
  facePreservationMode?: 'preserve_face' | 'replace_face';
  steps?: number;
}

export async function generateWithStability({
  prompt,
  imageData,
  mode = 'inpaint',
  maskData,
  strength = 0.8,
  cfgScale = 7,
  negativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy',
  facePreservationMode = 'preserve_face',
  steps = 25
}: StabilityGenerationOptions): Promise<string> {
  try {
    console.log('🔄 Calling generate-stability-image Edge Function...');
    console.log('📋 Request parameters:', {
      promptLength: prompt.length,
      mode,
      strength,
      cfgScale,
      steps,
      facePreservationMode,
      hasMask: !!maskData
    });

    // Call Supabase Edge Function with all parameters
    const { data, error } = await supabase.functions.invoke('generate-stability-image', {
      body: {
        prompt,
        imageData,
        mode,
        maskData,
        strength,
        cfgScale,
        negativePrompt,
        facePreservationMode,
        steps
      }
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      throw new Error(error.message || 'Failed to generate image with Stability AI');
    }

    if (!data?.success || !data?.imageData) {
      console.error('❌ Invalid response from Edge Function:', data);
      throw new Error(data?.error || 'Invalid response from Stability AI service');
    }

    console.log('✅ Stability AI generation successful via Edge Function');
    console.log('📊 Response metadata:', data.metadata || 'No metadata');

    return data.imageData;

  } catch (error) {
    console.error('❌ Stability AI generation failed:', error);
    
    if (error instanceof Error) {
      // Provide more specific error messages based on the error content
      const message = error.message.toLowerCase();
      
      if (message.includes('failed to send a request')) {
        throw new Error('Unable to connect to AI service. Please check your internet connection and try again.');
      } else if (message.includes('api key') || message.includes('unauthorized')) {
        throw new Error('AI service authentication failed. Please check your API configuration.');
      } else if (message.includes('credits') || message.includes('insufficient')) {
        throw new Error('Insufficient AI service credits. Please check your account balance.');
      } else if (message.includes('rate limit')) {
        throw new Error('AI service rate limit exceeded. Please wait a moment and try again.');
      } else if (message.includes('timeout')) {
        throw new Error('AI generation timed out. Please try again with a simpler prompt.');
      } else {
        throw error; // Pass through the original error if it's already user-friendly
      }
    }
    
    throw new Error('AI generation failed due to an unexpected error. Please try again.');
  }
}