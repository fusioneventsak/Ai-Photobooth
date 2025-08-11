import { createClient } from '@supabase/supabase-js';
import type { Config, Photo } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getConfig(): Promise<Config | null> {
  try {
    const { data: config, error } = await supabase
      .from('configs')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching config:', error);
      return null;
    }

    return config;
  } catch (error) {
    console.error('Error in getConfig:', error);
    return null;
  }
}

export async function updateConfig(updates: Partial<Config>): Promise<Config | null> {
  try {
    // Get current config first
    const { data: currentConfig, error: fetchError } = await supabase
      .from('configs')
      .select('id')
      .limit(1)
      .single();

    if (fetchError) {
      console.error('Error fetching current config:', fetchError);
      return null;
    }

    // Remove any undefined or null values from updates
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined && value !== null)
    );

    // Update the config
    const { data: updatedConfig, error: updateError } = await supabase
      .from('configs')
      .update(cleanUpdates)
      .eq('id', currentConfig.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating config:', updateError);
      return null;
    }

    return updatedConfig;
  } catch (error) {
    console.error('Error in updateConfig:', error);
    return null;
  }
}

export async function getPublicPhotos(): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('public', true)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching photos:', error);
    return [];
  }
  
  return data;
}

export async function uploadPhoto(file: File, prompt: string): Promise<Photo | null> {
  try {
    const contentType = file.type.startsWith('video/') ? 'video' : 'image';
    const duration = contentType === 'video' ? 5 : null; // Default to max duration

    // Upload file to storage
    const fileName = `${Date.now()}-${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(uploadData.path);

    // Create photo record in the database
    const { data: photoData, error: photoError } = await supabase
      .from('photos')
      .insert([{
        original_url: publicUrl,
        prompt,
        public: true,
        content_type: contentType,
        duration: duration
      }])
      .select()
      .single();

    if (photoError) throw photoError;

    return photoData;
  } catch (error) {
    console.error('Error uploading photo:', error);
    return null;
  }
}