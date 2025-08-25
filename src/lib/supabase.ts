// src/lib/supabase.ts - Fixed version with correct database schema
import { createClient } from '@supabase/supabase-js';
import type { Config, Photo } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Enhanced Configuration functions
export async function getConfig(): Promise<Config | null> {
  try {
    console.log('Fetching configuration from Supabase...');
    
    const { data, error } = await supabase
      .from('configs')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error fetching config:', error);
      
      if (error.code === 'PGRST116') {
        console.log('No config found, creating default configuration...');
        return await createDefaultConfig();
      }
      
      throw new Error(`Failed to fetch configuration: ${error.message}`);
    }

    if (!data) {
      console.log('No config found, creating default configuration...');
      return await createDefaultConfig();
    }

    console.log('Configuration loaded successfully');
    return data;
  } catch (error) {
    console.error('Error in getConfig:', error);
    throw error;
  }
}

async function createDefaultConfig(): Promise<Config> {
  const defaultConfig = {
    brand_name: 'Virtual Photobooth',
    primary_color: '#3B82F6',
    secondary_color: '#6B7280',
    global_prompt: 'Create a stunning astronaut portrait with a reflective helmet visor and planets visible in the cosmic background, preserve all facial features and expressions exactly as they are in the original photo',
    gallery_animation: 'fade' as const,
    gallery_speed: 3000,
    gallery_layout: 'grid' as const,
    gallery_images_per_page: 12,
    model_type: 'image' as const,
    video_duration: 5,
    image_provider: 'stability' as const,
    video_provider: 'replicate' as const,
    use_provider_fallback: true,
    face_preservation_mode: 'preserve_face' as const,
    replicate_image_model: 'flux-schnell',
    replicate_video_model: 'hailuo'
  };

  const { data, error } = await supabase
    .from('configs')
    .insert([defaultConfig])
    .select()
    .single();

  if (error) {
    console.error('Error creating default config:', error);
    throw new Error(`Failed to create default configuration: ${error.message}`);
  }

  console.log('Default configuration created successfully');
  return data;
}

export async function updateConfig(updates: Partial<Config>): Promise<Config | null> {
  try {
    console.log('Updating configuration...', updates);
    
    const existingConfig = await getConfig();
    
    if (!existingConfig) {
      console.log('No existing config found, creating new one with updates...');
      return await createDefaultConfig();
    }

    const validUpdates: Partial<Config> = {};
    
    const validFields = [
      'brand_name', 'brand_logo_url', 'primary_color', 'secondary_color',
      'global_prompt', 'gallery_animation', 'gallery_speed', 'gallery_layout',
      'stability_api_key', 'gallery_images_per_page', 'model_type', 
      'video_duration', 'image_provider', 'video_provider', 
      'use_provider_fallback', 'face_preservation_mode',
      'use_controlnet', 'controlnet_type',
      'replicate_image_model', 'replicate_video_model',
      'kling_cfg_scale', 'kling_negative_prompt', 'kling_aspect_ratio'
    ];

    Object.entries(updates).forEach(([key, value]) => {
      if (validFields.includes(key) && value !== undefined) {
        validUpdates[key as keyof Config] = value;
      }
    });

    if (Object.keys(validUpdates).length === 0) {
      console.log('No valid updates provided');
      return existingConfig;
    }

    console.log('Sending to database:', validUpdates);

    const { data, error } = await supabase
      .from('configs')
      .update(validUpdates)
      .eq('id', existingConfig.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating config:', error);
      throw new Error(`Failed to update configuration: ${error.message}`);
    }

    console.log('Configuration updated successfully');
    return data;
  } catch (error) {
    console.error('Error in updateConfig:', error);
    throw error;
  }
}

// FIXED: Enhanced uploadPhoto function with correct database schema
export async function uploadPhoto(
  imageData: string | File, 
  prompt: string, 
  contentType: 'image' | 'video' = 'image'
): Promise<Photo | null> {
  try {
    console.log('Starting upload process...', {
      contentType,
      dataType: typeof imageData,
      promptLength: prompt.length
    });

    let imageUrl: string;
    let uploadData: any = null;
    
    if (typeof imageData === 'string') {
      let blob: Blob;
      
      if (imageData.startsWith('data:')) {
        console.log('Converting base64 data URL to blob...');
        
        const [header, base64Data] = imageData.split(',');
        if (!base64Data) {
          throw new Error('Invalid data URL format');
        }

        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : (contentType === 'video' ? 'video/mp4' : 'image/png');
        
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        blob = new Blob([bytes], { type: mimeType });
        
        if (blob.size === 0) {
          throw new Error('Converted blob is empty - invalid base64 data');
        }
        
        console.log('Base64 to blob conversion successful:', {
          blobSize: blob.size,
          mimeType: blob.type
        });
        
      } else if (imageData.startsWith('blob:') || imageData.startsWith('http')) {
        console.log('Fetching content from URL...');
        
        const response = await fetch(imageData);
        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.statusText}`);
        }
        
        blob = await response.blob();
        
        if (blob.size === 0) {
          throw new Error('Fetched content is empty');
        }
        
        console.log('URL to blob conversion successful:', {
          blobSize: blob.size,
          mimeType: blob.type
        });
        
      } else {
        throw new Error('Invalid image data: must be a data URL, blob URL, or HTTP URL');
      }
      
      // Generate filename with subfolder structure for videos
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      
      let extension = 'png';
      if (blob.type.includes('video/mp4')) {
        extension = 'mp4';
      } else if (blob.type.includes('video/')) {
        extension = 'mov';
      } else if (blob.type.includes('image/jpeg')) {
        extension = 'jpg';
      } else if (contentType === 'video') {
        extension = 'mp4';
      }
      
      // Use subfolder structure for videos
      const filename = contentType === 'video' 
        ? `videos/${contentType}_${timestamp}_${randomSuffix}.${extension}`
        : `${contentType}_${timestamp}_${randomSuffix}.${extension}`;
      
      console.log('Uploading with filename:', filename);
      
      // Upload to Supabase storage
      const { data: uploadResult, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, blob, {
          contentType: blob.type || (contentType === 'video' ? 'video/mp4' : 'image/png'),
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload failed:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      if (!uploadResult || !uploadResult.path) {
        throw new Error('Upload succeeded but no path returned from storage');
      }

      uploadData = uploadResult;
      console.log('File uploaded successfully to storage:', uploadResult.path);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(uploadResult.path);

      imageUrl = publicUrl;
      console.log('Public URL generated:', imageUrl);

    } else {
      // Handle File object
      const timestamp = Date.now();
      const filename = `${contentType}_${timestamp}_${imageData.name}`;
      
      const { data: uploadResult, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, imageData, {
          upsert: false
        });

      if (uploadError) {
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      uploadData = uploadResult;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(uploadResult.path);

      imageUrl = publicUrl;
    }

    console.log('Saving photo metadata to database...');

    // FIXED: Use the correct column names that match your database schema
    const insertData: any = {
      // Core required fields
      url: imageUrl,
      prompt: prompt.trim(),
      type: contentType,
      public: true,
      created_at: new Date().toISOString()
    };

    // Add optional fields only if we have the data
    if (uploadData) {
      insertData.filename = uploadData.path;
      insertData.storage_path = uploadData.path;
    }

    // Add legacy fields for compatibility if they exist
    insertData.original_url = imageUrl;
    insertData.processed_url = imageUrl;
    
    // Handle content_type vs type column
    insertData.content_type = contentType;

    console.log('Database insert payload:', {
      ...insertData,
      url: insertData.url.substring(0, 100) + '...'
    });

    const { data, error } = await supabase
      .from('photos')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error('Database insert failed:', error);
      
      // Try alternative column names if the first attempt fails
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.log('Retrying with alternative column names...');
        
        const alternativeData = {
          // Try with minimal required fields
          ...(imageUrl && { original_url: imageUrl }),
          ...(imageUrl && { processed_url: imageUrl }),
          prompt: prompt.trim(),
          ...(uploadData && { content_type: contentType }),
          public: true
        };
        
        const { data: retryData, error: retryError } = await supabase
          .from('photos')
          .insert([alternativeData])
          .select()
          .single();
          
        if (retryError) {
          console.error('Retry also failed:', retryError);
          throw new Error(`Database insert failed: ${retryError.message}`);
        }
        
        console.log('Retry successful');
        return retryData;
      }
      
      throw new Error(`Database insert failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('Database insert succeeded but no data returned');
    }

    console.log('Upload completed successfully:', {
      id: data.id,
      type: contentType,
      url: 'generated'
    });

    // Test file accessibility
    try {
      const testResponse = await fetch(imageUrl, { method: 'HEAD' });
      if (testResponse.ok) {
        console.log('File is accessible via public URL');
      }
    } catch (accessError) {
      console.warn('Could not verify file accessibility (may be temporary)');
    }

    return data;
    
  } catch (error) {
    console.error('Upload process failed:', error);
    
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('invalid image data') || message.includes('invalid base64')) {
        throw new Error('Invalid image format. Please ensure the image was generated correctly.');
      } else if (message.includes('storage upload failed')) {
        throw new Error('Failed to upload to cloud storage. Please check your internet connection.');
      } else if (message.includes('database')) {
        throw new Error('Failed to save photo information. Please try again.');
      }
    }
    
    throw new Error('Upload failed. Please try again.');
  }
}

export async function handleAutoUpload(
  resultData: string,
  prompt: string,
  type: 'image' | 'video'
): Promise<Photo | null> {
  try {
    console.log(`Auto-uploading ${type} to gallery...`);
    
    const result = await uploadPhoto(resultData, prompt, type);
    
    if (result) {
      console.log(`Auto-upload successful for ${type}:`, result.id);
      
      window.dispatchEvent(new CustomEvent('galleryUpdate', {
        detail: { 
          action: 'add',
          photo: result,
          timestamp: new Date().toISOString()
        }
      }));
    }
    
    return result;
    
  } catch (error) {
    console.error(`Auto-upload failed for ${type}:`, error);
    return null;
  }
}

export async function getPublicPhotos(): Promise<Photo[]> {
  try {
    console.log('Fetching public photos from database...');
    
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching public photos:', error);
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }

    console.log('Public photos query result:', {
      count: data?.length || 0
    });

    return data || [];
  } catch (error) {
    console.error('Error in getPublicPhotos:', error);
    throw error;
  }
}

export async function deletePhoto(photoId: string): Promise<boolean> {
  try {
    console.log('Starting photo deletion process for ID:', photoId);
    
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to find photo: ${fetchError.message}`);
    }

    if (!photo) {
      throw new Error('Photo not found');
    }

    // Extract file path for storage deletion
    let filePath: string | null = null;
    
    const urlToCheck = photo.processed_url || photo.url || photo.original_url;
    if (urlToCheck) {
      try {
        const url = new URL(urlToCheck);
        const pathParts = url.pathname.split('/');
        const photosIndex = pathParts.indexOf('photos');
        
        if (photosIndex !== -1 && photosIndex < pathParts.length - 1) {
          filePath = pathParts.slice(photosIndex + 1).join('/');
        }
      } catch (urlError) {
        console.warn('Could not extract file path from URL');
      }
    }

    // Delete from storage if we have a file path
    if (filePath) {
      console.log('Deleting file from storage:', filePath);
      
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([filePath]);

      if (storageError) {
        console.warn('Storage deletion failed (continuing with database deletion):', storageError);
      } else {
        console.log('File deleted from storage successfully');
      }
    }

    // Delete from database
    console.log('Deleting photo record from database...');
    
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      throw new Error(`Failed to delete photo record: ${dbError.message}`);
    }

    console.log('Photo deleted successfully');
    
    window.dispatchEvent(new CustomEvent('galleryUpdate', {
      detail: { 
        action: 'delete',
        photoId: photoId,
        timestamp: new Date().toISOString()
      }
    }));
    
    return true;

  } catch (error) {
    console.error('Photo deletion failed:', error);
    throw error;
  }
}

export async function deleteAllPhotos(): Promise<boolean> {
  try {
    console.log('Starting bulk photo deletion process...');
    
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('public', true);

    if (fetchError) {
      throw new Error(`Failed to fetch photos: ${fetchError.message}`);
    }

    if (!photos || photos.length === 0) {
      console.log('No photos found to delete');
      return true;
    }

    console.log('Found photos for deletion:', photos.length);

    // Extract file paths
    const filePaths: string[] = [];
    
    photos.forEach(photo => {
      const urlToCheck = photo.processed_url || photo.url || photo.original_url;
      if (urlToCheck) {
        try {
          const url = new URL(urlToCheck);
          const pathParts = url.pathname.split('/');
          const photosIndex = pathParts.indexOf('photos');
          
          if (photosIndex !== -1 && photosIndex < pathParts.length - 1) {
            const filePath = pathParts.slice(photosIndex + 1).join('/');
            filePaths.push(filePath);
          }
        } catch (urlError) {
          console.warn('Could not extract file path from URL');
        }
      }
    });

    // Delete files from storage in batches
    if (filePaths.length > 0) {
      console.log('Deleting files from storage...');
      
      const batchSize = 100;
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        
        const { error: storageError } = await supabase.storage
          .from('photos')
          .remove(batch);

        if (storageError) {
          console.warn('Storage batch deletion failed:', storageError);
        }
      }
    }

    // Delete all records from database
    console.log('Deleting all photo records from database...');
    
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('public', true);

    if (dbError) {
      throw new Error(`Failed to delete photo records: ${dbError.message}`);
    }

    console.log('All photos deleted successfully');
    
    window.dispatchEvent(new CustomEvent('galleryUpdate', {
      detail: { 
        action: 'deleteAll',
        count: photos.length,
        timestamp: new Date().toISOString()
      }
    }));
    
    return true;

  } catch (error) {
    console.error('Bulk photo deletion failed:', error);
    throw error;
  }
}