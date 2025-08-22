import { supabase } from './supabase';

interface GenerationOptions {
  prompt: string;
  inputData: string;
  type: 'image' | 'video';
  duration?: number;
  preserveFace?: boolean;
  model?: 'wan-video' | 'hailuo' | 'flux'; // Added model selection
}

export async function generateWithReplicate({ 
  prompt, 
  inputData, 
  type, 
  duration = 5,
  preserveFace = true,
  model
}: GenerationOptions): Promise<string> {
  try {
    console.log(`🔄 Calling Replicate Edge Function for ${type} generation...`);
    
    // Determine default model based on type
    let selectedModel = model;
    if (type === 'video' && !model) {
      selectedModel = 'wan-video'; // Default to wan-video for video generation
    }
    
    if (selectedModel) {
      console.log(`📊 Using ${selectedModel} model for ${type}`);
    } else {
      console.log(`📊 Using default model for ${type}`);
    }

    // Call Supabase Edge Function with updated parameters
    const { data, error } = await supabase.functions.invoke('generate-replicate-content', {
      body: {
        prompt,
        inputData,
        type,
        duration,
        preserveFace,
        model: selectedModel
      }
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || `Failed to generate ${type}`);
    }

    if (!data?.success || !data?.result) {
      throw new Error(data?.error || `Invalid response from ${type} generation service`);
    }

    // Log additional metadata if available
    if (data.metadata) {
      console.log(`✅ Generation metadata:`, data.metadata);
    }
    
    console.log(`✅ Replicate ${type} generation successful with model: ${data.model || 'default'}`);
    return data.result;

  } catch (error) {
    console.error('Replicate API Error:', error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to generate ${type} with Replicate API`);
    }
  }
}

// Helper function to get available models
export function getAvailableModels(type: 'image' | 'video') {
  if (type === 'video') {
    return [
      { id: 'wan-video', name: 'WAN Video 2.2 (Fast)', description: 'High-quality video generation' },
      { id: 'hailuo', name: 'Hailuo 02 (Fast)', description: 'Alternative video generation model' }
    ];
  } else {
    return [
      { id: 'flux', name: 'FLUX Schnell', description: 'Fast image generation' }
    ];
  }
}