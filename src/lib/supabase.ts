import { createClient } from '@supabase/supabase-js';
import type { Config, Photo } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuration functions
export async function getConfig(): Promise<Config | null> {
  try {
    const { data, error } = await supabase
      .from('configs')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching config:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getConfig:', error);
    return null;
  }
}

export async function updateConfig(updates: Partial<Config>): Promise<Config | null> {
  try {
    // First, get the existing config to update
    const existingConfig = await getConfig();
    
    if (!existingConfig) {
      // If no config exists, create one with the updates
      const { data, error } = await supabase
        .from('configs')
        .insert([updates])
        .select()
        .single();

      if (error) {
        console.error('Error creating config:', error);
        return null;
      }

      return data;
    }

    // Update the existing config
    const { data, error } = await supabase
      .from('configs')
      .update(updates)
      .eq('id', existingConfig.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating config:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateConfig:', error);
    return null;
  }
}

// Photo functions
export async function uploadPhoto(
  imageData: string | File, 
  prompt: string, 
  contentType: 'image' | 'video' = 'image'
): Promise<Photo | null> {
  try {
    let imageUrl: string;
    
    if (typeof imageData === 'string') {
      // Convert base64 to blob for upload
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${contentType}_${timestamp}.${contentType === 'video' ? 'mp4' : 'png'}`;
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, blob, {
          contentType: contentType === 'video' ? 'video/mp4' : 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading to storage:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(uploadData.path);

      imageUrl = urlData.publicUrl;
    } else {
      // Handle File object
      const timestamp = Date.now();
      const filename = `${contentType}_${timestamp}_${imageData.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, imageData, {
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading file to storage:', uploadError);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(uploadData.path);

      imageUrl = urlData.publicUrl;
    }

    // Save photo metadata to database
    const { data, error } = await supabase
      .from('photos')
      .insert([{
        original_url: imageUrl,
        processed_url: imageUrl,
        prompt: prompt,
        content_type: contentType,
        public: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving photo metadata:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in uploadPhoto:', error);
    return null;
  }
}

export async function getPublicPhotos(): Promise<Photo[]> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching public photos:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPublicPhotos:', error);
    return [];
  }
}