import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types based on your database schema
export interface Photo {
  id: string;
  created_at: string;
  original_url: string;
  processed_url?: string;
  prompt: string;
  public: boolean;
  content_type: 'image' | 'video';
  duration?: number;
  thumbnail_url?: string;
  storage_path?: string;
  file_size_mb?: number;
  processing_duration?: number;
}

export interface Config {
  id: string;
  created_at: string;
  brand_name: string;
  brand_logo_url?: string;
  primary_color: string;
  secondary_color: string;
  global_prompt: string;
  gallery_animation: 'fade' | 'slide' | 'zoom';
  gallery_speed: number;
  gallery_layout: 'grid' | 'masonry' | 'carousel';
  stability_api_key?: string;
  model_type: 'image' | 'video';
  video_duration: number;
  image_provider: 'stability' | 'replicate';
  video_provider: 'stability' | 'replicate';
  use_provider_fallback: boolean;
  face_preservation_mode: 'preserve_face' | 'replace_face';
  gallery_images_per_page?: number;
  replicate_image_model?: string;
  replicate_video_model?: string;
  [key: string]: any; // For additional config fields
}

// Get application configuration
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

// Update application configuration
export async function updateConfig(updates: Partial<Config>): Promise<Config | null> {
  try {
    const { data, error } = await supabase
      .from('configs')
      .update(updates)
      .select()
      .single();

    if (error) {
      console.error('Error updating config:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in updateConfig:', error);
    throw error;
  }
}

// Get photos from gallery
export async function getPhotos(limit: number = 50): Promise<Photo[]> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching photos:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPhotos:', error);
    return [];
  }
}

// Upload photo to gallery
export async function uploadPhoto(
  imageData: string,
  prompt: string,
  contentType: 'image' | 'video' = 'image',
  duration?: number
): Promise<Photo | null> {
  try {
    console.log('Starting photo upload to gallery...');

    // Convert base64 to blob
    const base64Data = imageData.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { 
      type: contentType === 'video' ? 'video/mp4' : 'image/png' 
    });

    // Generate filename
    const timestamp = Date.now();
    const extension = contentType === 'video' ? 'mp4' : 'png';
    const filename = `${contentType}s/${timestamp}.${extension}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(filename, blob, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(filename);

    // Calculate file size in MB
    const fileSizeMB = blob.size / (1024 * 1024);

    // Insert into database
    const { data: photoData, error: dbError } = await supabase
      .from('photos')
      .insert({
        original_url: publicUrl,
        processed_url: publicUrl,
        prompt: prompt,
        public: true,
        content_type: contentType,
        duration: duration,
        storage_path: filename,
        file_size_mb: Math.round(fileSizeMB * 100) / 100
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      throw dbError;
    }

    console.log('Photo uploaded successfully:', photoData.id);
    return photoData;

  } catch (error) {
    console.error('Error in uploadPhoto:', error);
    return null;
  }
}

// Delete photo and all associated records
export async function deletePhotoAndAllDuplicates(photoId: string): Promise<boolean> {
  try {
    console.log('Starting deletion process for photo:', photoId);

    // First, get the photo details to find the storage path
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      console.error('Error fetching photo for deletion:', fetchError);
      throw fetchError;
    }

    if (!photo) {
      console.warn('Photo not found for deletion:', photoId);
      return false;
    }

    console.log('Found photo for deletion:', {
      id: photo.id,
      storage_path: photo.storage_path,
      content_type: photo.content_type
    });

    // Delete from storage if storage_path exists
    if (photo.storage_path) {
      console.log('Deleting from storage:', photo.storage_path);
      
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([photo.storage_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Don't throw here - continue with database deletion even if storage fails
      } else {
        console.log('Successfully deleted from storage');
      }
    }

    // Delete related records first (due to foreign key constraints)
    
    // Delete from photo_generations table
    const { error: generationsError } = await supabase
      .from('photo_generations')
      .delete()
      .eq('gallery_photo_id', photoId);

    if (generationsError) {
      console.error('Error deleting photo_generations:', generationsError);
      // Continue anyway
    }

    // Delete from gallery_updates table
    const { error: updatesError } = await supabase
      .from('gallery_updates')
      .delete()
      .eq('photo_id', photoId);

    if (updatesError) {
      console.error('Error deleting gallery_updates:', updatesError);
      // Continue anyway
    }

    // Finally, delete the main photo record
    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) {
      console.error('Error deleting photo from database:', deleteError);
      throw deleteError;
    }

    console.log('Successfully deleted photo and all associated records:', photoId);

    // Create a gallery update notification for real-time updates
    try {
      await supabase
        .from('gallery_updates')
        .insert({
          action: 'delete',
          photo_id: photoId,
          message: `Photo deleted: ${photo.content_type}`
        });
    } catch (notificationError) {
      console.warn('Failed to create deletion notification:', notificationError);
      // Don't fail the deletion if notification fails
    }

    return true;

  } catch (error) {
    console.error('Error in deletePhotoAndAllDuplicates:', error);
    throw error;
  }
}

// Get a single photo by ID
export async function getPhotoById(photoId: string): Promise<Photo | null> {
  try {
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .eq('public', true)
      .single();

    if (error) {
      console.error('Error fetching photo by ID:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getPhotoById:', error);
    return null;
  }
}

// Update photo visibility
export async function updatePhotoVisibility(photoId: string, isPublic: boolean): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('photos')
      .update({ public: isPublic })
      .eq('id', photoId);

    if (error) {
      console.error('Error updating photo visibility:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updatePhotoVisibility:', error);
    return false;
  }
}

// Get photos with pagination
export async function getPhotosWithPagination(
  page: number = 1,
  limit: number = 12,
  contentType?: 'image' | 'video'
): Promise<{ photos: Photo[]; hasMore: boolean; total: number }> {
  try {
    const offset = (page - 1) * limit;
    
    let query = supabase
      .from('photos')
      .select('*', { count: 'exact' })
      .eq('public', true)
      .order('created_at', { ascending: false });

    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching photos with pagination:', error);
      return { photos: [], hasMore: false, total: 0 };
    }

    const total = count || 0;
    const hasMore = offset + limit < total;

    return {
      photos: data || [],
      hasMore,
      total
    };
  } catch (error) {
    console.error('Error in getPhotosWithPagination:', error);
    return { photos: [], hasMore: false, total: 0 };
  }
}

export default supabase;