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
}// src/lib/supabase.ts - Complete updated file with URL/Video handling fix AND model persistence fix
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
    console.log('🔍 Fetching configuration from Supabase...');
    
    const { data, error } = await supabase
      .from('configs')
      .select('*')
      .maybeSingle(); // Use maybeSingle to handle no rows gracefully

    if (error) {
      console.error('❌ Error fetching config:', error);
      
      // If no config exists, create a default one
      if (error.code === 'PGRST116') {
        console.log('📝 No config found, creating default configuration...');
        return await createDefaultConfig();
      }
      
      throw new Error(`Failed to fetch configuration: ${error.message}`);
    }

    if (!data) {
      console.log('📝 No config found, creating default configuration...');
      return await createDefaultConfig();
    }

    console.log('✅ Configuration loaded successfully');
    return data;
  } catch (error) {
    console.error('❌ Error in getConfig:', error);
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
    video_provider: 'replicate' as const, // Fixed to replicate
    use_provider_fallback: true,
    face_preservation_mode: 'preserve_face' as const,
    // Add model defaults
    replicate_image_model: 'flux-schnell',
    replicate_video_model: 'hailuo'
  };

  const { data, error } = await supabase
    .from('configs')
    .insert([defaultConfig])
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating default config:', error);
    throw new Error(`Failed to create default configuration: ${error.message}`);
  }

  console.log('✅ Default configuration created successfully');
  return data;
}

export async function updateConfig(updates: Partial<Config>): Promise<Config | null> {
  try {
    console.log('🔄 Updating configuration...', updates);
    
    // First, get the existing config
    const existingConfig = await getConfig();
    
    if (!existingConfig) {
      console.log('📝 No existing config found, creating new one with updates...');
      return await createDefaultConfig();
    }

    // Filter out undefined values and only include valid config fields
    const validUpdates: Partial<Config> = {};
    
    // ✅ CRITICAL FIX: Added the missing model selection fields
    const validFields = [
      'brand_name', 'brand_logo_url', 'primary_color', 'secondary_color',
      'global_prompt', 'gallery_animation', 'gallery_speed', 'gallery_layout',
      'stability_api_key', 'gallery_images_per_page', 'model_type', 
      'video_duration', 'image_provider', 'video_provider', 
      'use_provider_fallback', 'face_preservation_mode',
      'use_controlnet', 'controlnet_type',
      'replicate_image_model', 'replicate_video_model' // ✅ FIXED: Added missing fields
    ];

    Object.entries(updates).forEach(([key, value]) => {
      if (validFields.includes(key) && value !== undefined) {
        validUpdates[key as keyof Config] = value;
      }
    });

    if (Object.keys(validUpdates).length === 0) {
      console.log('ℹ️ No valid updates provided');
      return existingConfig;
    }

    // Debug logging
    console.log('📤 Sending to database:', validUpdates);

    // Update the existing config
    const { data, error } = await supabase
      .from('configs')
      .update(validUpdates)
      .eq('id', existingConfig.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating config:', error);
      throw new Error(`Failed to update configuration: ${error.message}`);
    }

    console.log('✅ Configuration updated successfully', {
      replicate_image_model: data.replicate_image_model,
      replicate_video_model: data.replicate_video_model
    });
    return data;
  } catch (error) {
    console.error('❌ Error in updateConfig:', error);
    throw error;
  }
}

// UPDATED: Enhanced uploadPhoto function with URL/video handling
export async function uploadPhoto(
  imageData: string | File, 
  prompt: string, 
  contentType: 'image' | 'video' = 'image'
): Promise<Photo | null> {
  try {
    console.log('📤 Starting upload process...', {
      contentType,
      dataType: typeof imageData,
      isDataUrl: typeof imageData === 'string' && imageData.startsWith('data:'),
      isBlobUrl: typeof imageData === 'string' && imageData.startsWith('blob:'),
      isHttpUrl: typeof imageData === 'string' && imageData.startsWith('http'),
      dataLength: typeof imageData === 'string' ? imageData.length : imageData.size,
      promptLength: prompt.length
    });

    let imageUrl: string;
    
    if (typeof imageData === 'string') {
      // Handle data URLs, blob URLs, and HTTP URLs
      let blob: Blob;
      
      if (imageData.startsWith('data:')) {
        // Handle base64 data URLs (from AI generation)
        console.log('🔄 Converting base64 data URL to blob...');
        
        try {
          // Handle different data URL formats
          const [header, base64Data] = imageData.split(',');
          if (!base64Data) {
            throw new Error('Invalid data URL format - no base64 data found');
          }

          // Extract mime type from header
          const mimeMatch = header.match(/data:([^;]+)/);
          const mimeType = mimeMatch ? mimeMatch[1] : (contentType === 'video' ? 'video/mp4' : 'image/png');
          
          console.log('📋 Detected MIME type:', mimeType);

          // Convert base64 to binary with better error handling
          let binaryString: string;
          try {
            binaryString = atob(base64Data);
          } catch (atobError) {
            throw new Error('Invalid base64 encoding');
          }
          
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          blob = new Blob([bytes], { type: mimeType });
          
          if (blob.size === 0) {
            throw new Error('Converted blob is empty - invalid base64 data');
          }
          
          console.log('✅ Base64 to blob conversion successful:', {
            originalSize: base64Data.length,
            blobSize: blob.size,
            mimeType: blob.type
          });
          
        } catch (conversionError) {
          console.error('❌ Base64 conversion failed:', conversionError);
          throw new Error(`Failed to convert base64 data: ${conversionError instanceof Error ? conversionError.message : 'Unknown error'}`);
        }
        
      } else if (imageData.startsWith('blob:')) {
        // Handle blob URLs (from video generation)
        console.log('🔄 Converting blob URL to blob...');
        
        try {
          const response = await fetch(imageData);
          if (!response.ok) {
            throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`);
          }
          
          blob = await response.blob();
          
          if (blob.size === 0) {
            throw new Error('Fetched blob is empty');
          }
          
          console.log('✅ Blob URL to blob conversion successful:', {
            blobSize: blob.size,
            mimeType: blob.type
          });
          
        } catch (fetchError) {
          console.error('❌ Blob URL conversion failed:', fetchError);
          throw new Error(`Failed to convert blob URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        }
        
      } else if (imageData.startsWith('http')) {
        // NEW: Handle HTTP URLs (from Replicate video generation)
        console.log('🔄 Downloading content from HTTP URL...', imageData.substring(0, 100) + '...');
        
        try {
          const response = await fetch(imageData);
          if (!response.ok) {
            throw new Error(`Failed to fetch content from URL: ${response.status} ${response.statusText}`);
          }
          
          blob = await response.blob();
          
          if (blob.size === 0) {
            throw new Error('Downloaded content is empty');
          }
          
          // Auto-detect content type from response or blob
          let detectedType = blob.type;
          if (!detectedType) {
            // Try to determine from URL extension or default based on contentType
            if (imageData.includes('.mp4') || imageData.includes('.mov') || contentType === 'video') {
              detectedType = 'video/mp4';
            } else if (imageData.includes('.png')) {
              detectedType = 'image/png';
            } else if (imageData.includes('.jpg') || imageData.includes('.jpeg')) {
              detectedType = 'image/jpeg';
            } else {
              detectedType = contentType === 'video' ? 'video/mp4' : 'image/png';
            }
          }
          
          // Create a new blob with the correct type if needed
          if (blob.type !== detectedType) {
            blob = new Blob([blob], { type: detectedType });
          }
          
          console.log('✅ HTTP URL to blob conversion successful:', {
            url: imageData.substring(0, 100) + '...',
            blobSize: blob.size,
            mimeType: blob.type,
            detectedType
          });
          
        } catch (fetchError) {
          console.error('❌ HTTP URL conversion failed:', fetchError);
          throw new Error(`Failed to download content from URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        }
        
      } else {
        throw new Error('Invalid image data: must be a data URL, blob URL, or HTTP URL');
      }
      
      // Generate unique filename with proper extension
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      
      // Determine extension from blob type
      let extension = 'png'; // default
      if (blob.type.includes('video/mp4')) {
        extension = 'mp4';
      } else if (blob.type.includes('video/')) {
        extension = 'mov';
      } else if (blob.type.includes('image/jpeg')) {
        extension = 'jpg';
      } else if (blob.type.includes('image/png')) {
        extension = 'png';
      } else if (contentType === 'video') {
        extension = 'mp4';
      }
      
      const filename = `${contentType}_${timestamp}_${randomSuffix}.${extension}`;
      
      console.log('📁 Uploading with filename:', filename);
      console.log('📊 Upload details:', {
        filename,
        blobSize: blob.size,
        blobType: blob.type,
        contentType,
        extension
      });
      
      // Upload to Supabase storage with proper content type
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, blob, {
          contentType: blob.type || (contentType === 'video' ? 'video/mp4' : 'image/png'),
          upsert: false // Don't overwrite existing files
        });

      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      if (!uploadData || !uploadData.path) {
        throw new Error('Upload succeeded but no path returned from storage');
      }

      console.log('✅ File uploaded successfully to storage:', {
        path: uploadData.path,
        id: uploadData.id
      });

      // Get public URL with error handling
      const { data: urlData, error: urlError } = supabase.storage
        .from('photos')
        .getPublicUrl(uploadData.path);

      if (urlError) {
        console.error('❌ Failed to get public URL:', urlError);
        throw new Error(`Failed to get public URL: ${urlError.message}`);
      }

      if (!urlData || !urlData.publicUrl) {
        throw new Error('Failed to generate public URL for uploaded file');
      }

      imageUrl = urlData.publicUrl;
      console.log('🔗 Public URL generated:', imageUrl);

    } else {
      // Handle File object (from file uploads)
      const timestamp = Date.now();
      const filename = `${contentType}_${timestamp}_${imageData.name}`;
      
      console.log('📁 Uploading file:', {
        filename,
        fileSize: imageData.size,
        fileType: imageData.type
      });
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, imageData, {
          upsert: false
        });

      if (uploadError) {
        console.error('❌ File upload failed:', uploadError);
        throw new Error(`File upload failed: ${uploadError.message}`);
      }

      if (!uploadData || !uploadData.path) {
        throw new Error('File upload succeeded but no path returned');
      }

      console.log('✅ File uploaded successfully:', uploadData.path);

      // Get public URL
      const { data: urlData, error: urlError } = supabase.storage
        .from('photos')
        .getPublicUrl(uploadData.path);

      if (urlError) {
        throw new Error(`Failed to get public URL: ${urlError.message}`);
      }

      imageUrl = urlData.publicUrl;
    }

    console.log('💾 Saving photo metadata to database...');

    // Save photo metadata to database with better error handling
    const { data, error } = await supabase
      .from('photos')
      .insert([{
        original_url: imageUrl,
        processed_url: imageUrl,
        prompt: prompt.trim(),
        content_type: contentType,
        public: true
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Database insert failed:', error);
      
      // Provide more specific error messages
      if (error.code === '23505') {
        throw new Error('Duplicate entry detected. Please try again.');
      } else if (error.code === '23514') {
        throw new Error('Invalid data format. Please check your inputs.');
      } else if (error.message.includes('violates')) {
        throw new Error('Data validation failed. Please check your configuration.');
      } else {
        throw new Error(`Database error: ${error.message}`);
      }
    }

    if (!data) {
      throw new Error('Database insert succeeded but no data returned');
    }

    console.log('🎉 Upload and database save completed successfully:', {
      id: data.id,
      url: data.processed_url,
      contentType: data.content_type,
      prompt: data.prompt.substring(0, 50) + (data.prompt.length > 50 ? '...' : ''),
      public: data.public,
      created: data.created_at
    });

    // Verify the uploaded file is accessible
    try {
      const testResponse = await fetch(imageUrl, { method: 'HEAD' });
      if (!testResponse.ok) {
        console.warn('⚠️ Uploaded file may not be immediately accessible:', testResponse.status);
      } else {
        console.log('✅ Uploaded file is accessible via public URL');
      }
    } catch (accessError) {
      console.warn('⚠️ Could not verify file accessibility (may be temporary):', accessError);
    }

    return data;
    
  } catch (error) {
    console.error('❌ Upload process failed:', error);
    
    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('invalid image data') || message.includes('invalid base64') || message.includes('invalid data url')) {
        throw new Error('Invalid image format. Please ensure the image was generated correctly.');
      } else if (message.includes('storage upload failed') || message.includes('failed to fetch') || message.includes('failed to download')) {
        throw new Error('Failed to upload to cloud storage. Please check your internet connection and try again.');
      } else if (message.includes('database') || message.includes('insert failed')) {
        throw new Error('Failed to save photo information. The image was uploaded but not cataloged.');
      } else if (message.includes('public url') || message.includes('failed to get')) {
        throw new Error('Upload succeeded but failed to generate access URL. Please try again.');
      } else if (message.includes('conversion failed') || message.includes('blob is empty') || message.includes('downloaded content is empty')) {
        throw new Error('Content processing failed. Please try generating again.');
      } else if (message.includes('timeout') || message.includes('network')) {
        throw new Error('Network timeout. Please check your connection and try again.');
      } else {
        // Pass through the original error if it's already user-friendly
        throw error;
      }
    }
    
    throw new Error('Upload failed due to an unexpected error. Please try again.');
  }
}

// NEW: Auto-upload handler specifically for generated content
export async function handleAutoUpload(
  resultData: string,
  prompt: string,
  type: 'image' | 'video'
): Promise<Photo | null> {
  try {
    console.log(`🔄 Auto-uploading ${type} to gallery...`, {
      dataType: typeof resultData,
      isUrl: resultData.startsWith('http'),
      isDataUrl: resultData.startsWith('data:'),
      isBlobUrl: resultData.startsWith('blob:'),
      promptLength: prompt.length
    });
    
    // Use the enhanced uploadPhoto function that now handles URLs
    const result = await uploadPhoto(resultData, prompt, type);
    
    if (result) {
      console.log(`✅ Auto-upload successful for ${type}:`, result.id);
      
      // Trigger gallery refresh event
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
    console.error(`❌ Auto-upload failed for ${type}:`, error);
    // Don't throw error here - we don't want auto-upload failures to break the main flow
    return null;
  }
}

// Get public photos function
export async function getPublicPhotos(): Promise<Photo[]> {
  try {
    console.log('🔍 Fetching public photos from database...');
    
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching public photos:', error);
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }

    console.log('📊 Public photos query result:', {
      count: data?.length || 0,
      hasData: !!data
    });

    return data || [];
  } catch (error) {
    console.error('❌ Error in getPublicPhotos:', error);
    throw error;
  }
}

// Delete individual photo
export async function deletePhoto(photoId: string): Promise<boolean> {
  try {
    console.log('🗑️ Starting photo deletion process for ID:', photoId);
    
    // First, get the photo details to find the file path
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching photo for deletion:', fetchError);
      throw new Error(`Failed to find photo: ${fetchError.message}`);
    }

    if (!photo) {
      console.warn('⚠️ Photo not found in database:', photoId);
      throw new Error('Photo not found');
    }

    console.log('📋 Photo found for deletion:', {
      id: photo.id,
      url: photo.processed_url,
      type: photo.content_type
    });

    // Extract file path from URL for storage deletion
    let filePath: string | null = null;
    
    if (photo.processed_url) {
      try {
        // Extract the file path from the Supabase storage URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/photos/filename
        const url = new URL(photo.processed_url);
        const pathParts = url.pathname.split('/');
        const photosIndex = pathParts.indexOf('photos');
        
        if (photosIndex !== -1 && photosIndex < pathParts.length - 1) {
          filePath = pathParts.slice(photosIndex + 1).join('/');
          console.log('📁 Extracted file path:', filePath);
        }
      } catch (urlError) {
        console.warn('⚠️ Could not extract file path from URL:', photo.processed_url);
      }
    }

    // Delete from storage if we have a file path
    if (filePath) {
      console.log('🗑️ Deleting file from storage:', filePath);
      
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([filePath]);

      if (storageError) {
        console.warn('⚠️ Storage deletion failed (continuing with database deletion):', storageError);
        // Don't throw error here - continue with database deletion even if storage fails
      } else {
        console.log('✅ File deleted from storage successfully');
      }
    }

    // Delete from database
    console.log('🗑️ Deleting photo record from database...');
    
    const { error: dbError, count } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error('❌ Database deletion failed:', dbError);
      throw new Error(`Failed to delete photo record: ${dbError.message}`);
    }

    // Verify deletion actually occurred
    if (count === 0) {
      console.error('❌ Database deletion returned 0 affected rows - photo may not have been deleted');
      throw new Error('Photo deletion failed - no rows were affected. This may be due to permissions or the photo may have already been deleted.');
    }

    console.log('✅ Photo deleted successfully from database - affected rows:', count);
    
    // Double-check that the photo is actually gone
    console.log('🔍 Verifying photo deletion...');
    const { data: verifyPhoto, error: verifyError } = await supabase
      .from('photos')
      .select('id')
      .eq('id', photoId)
      .maybeSingle();

    if (verifyError) {
      console.warn('⚠️ Could not verify deletion (but deletion likely succeeded):', verifyError);
    } else if (verifyPhoto) {
      console.error('❌ CRITICAL: Photo still exists after deletion!', verifyPhoto);
      throw new Error('Photo deletion verification failed - photo still exists in database');
    } else {
      console.log('✅ Deletion verified - photo no longer exists in database');
    }
    // Trigger gallery refresh event
    window.dispatchEvent(new CustomEvent('galleryUpdate', {
      detail: { 
        action: 'delete',
        photoId: photoId,
        timestamp: new Date().toISOString()
      }
    }));
    
    return true;

  } catch (error) {
    console.error('❌ Photo deletion failed:', error);
    throw error;
  }
}

// Delete all photos
export async function deleteAllPhotos(): Promise<boolean> {
  try {
    console.log('🗑️ Starting bulk photo deletion process...');
    
    // First, get all photos to find their file paths
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('public', true);

    if (fetchError) {
      console.error('❌ Error fetching photos for bulk deletion:', fetchError);
      throw new Error(`Failed to fetch photos: ${fetchError.message}`);
    }

    if (!photos || photos.length === 0) {
      console.log('ℹ️ No photos found to delete');
      return true;
    }

    console.log('📋 Found photos for deletion:', {
      count: photos.length,
      photos: photos.map(p => ({
        id: p.id.substring(0, 8),
        type: p.content_type,
        url: p.processed_url
      }))
    });

    // Extract all file paths for storage deletion
    const filePaths: string[] = [];
    
    photos.forEach(photo => {
      if (photo.processed_url) {
        try {
          const url = new URL(photo.processed_url);
          const pathParts = url.pathname.split('/');
          const photosIndex = pathParts.indexOf('photos');
          
          if (photosIndex !== -1 && photosIndex < pathParts.length - 1) {
            const filePath = pathParts.slice(photosIndex + 1).join('/');
            filePaths.push(filePath);
          }
        } catch (urlError) {
          console.warn('⚠️ Could not extract file path from URL:', photo.processed_url);
        }
      }
    });

    console.log('📁 Extracted file paths for deletion:', {
      count: filePaths.length,
      paths: filePaths.slice(0, 3) // Log first 3 for debugging
    });

    // Delete files from storage in batches (Supabase has limits)
    if (filePaths.length > 0) {
      console.log('🗑️ Deleting files from storage...');
      
      // Process in batches of 100 (Supabase storage limit)
      const batchSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        console.log(`🔄 Deleting storage batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filePaths.length / batchSize)}...`);
        
        const { error: storageError } = await supabase.storage
          .from('photos')
          .remove(batch);

        if (storageError) {
          console.warn(`⚠️ Storage batch deletion failed (continuing):`, storageError);
        } else {
          deletedCount += batch.length;
          console.log(`✅ Storage batch deleted successfully (${deletedCount}/${filePaths.length})`);
        }
      }
      
      console.log(`📊 Storage deletion completed: ${deletedCount}/${filePaths.length} files processed`);
    }

    // Delete all records from database
    console.log('🗑️ Deleting all photo records from database...');
    
    const { error: dbError, count } = await supabase
      .from('photos')
      .delete()
      .eq('public', true);

    if (dbError) {
      console.error('❌ Database bulk deletion failed:', dbError);
      throw new Error(`Failed to delete photo records: ${dbError.message}`);
    }

    // Verify deletion actually occurred
    if (count === 0 && photos.length > 0) {
      console.error('❌ Database bulk deletion returned 0 affected rows despite having photos to delete');
      throw new Error('Bulk photo deletion failed - no rows were affected. This may be due to permissions issues.');
    }

    console.log('✅ All photos deleted successfully from database:', {
      recordsDeleted: count || photos.length,
      filesDeleted: filePaths.length
    });
    
    // Double-check that all photos are actually gone
    console.log('🔍 Verifying bulk deletion...');
    const { data: remainingPhotos, error: verifyError } = await supabase
      .from('photos')
      .select('id')
      .eq('public', true)
      .limit(1);

    if (verifyError) {
      console.warn('⚠️ Could not verify bulk deletion (but deletion likely succeeded):', verifyError);
    } else if (remainingPhotos && remainingPhotos.length > 0) {
      console.error('❌ CRITICAL: Photos still exist after bulk deletion!', remainingPhotos.length);
      throw new Error('Bulk deletion verification failed - some photos still exist in database');
    } else {
      console.log('✅ Bulk deletion verified - no photos remain in database');
    }
    // Trigger gallery refresh event
    window.dispatchEvent(new CustomEvent('galleryUpdate', {
      detail: { 
        action: 'deleteAll',
        count: photos.length,
        timestamp: new Date().toISOString()
      }
    }));
    
    // Also clear local storage
    localStorage.setItem('galleryRefresh', Date.now().toString());
    
    return true;

  } catch (error) {
    console.error('❌ Bulk photo deletion failed:', error);
    throw error;
  }
}

// Delete all photos with the same image content (including duplicates)
export async function deletePhotoAndAllDuplicates(photoId: string): Promise<{ deletedCount: number; errors: string[] }> {
  try {
    console.log('🗑️ Starting deletion of photo and all duplicates for ID:', photoId);
    
    // First, get the target photo details
    const { data: targetPhoto, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching target photo:', fetchError);
      throw new Error(`Failed to find target photo: ${fetchError.message}`);
    }

    if (!targetPhoto) {
      throw new Error('Target photo not found');
    }

    console.log('📋 Target photo found:', {
      id: targetPhoto.id.substring(0, 8),
      prompt: targetPhoto.prompt.substring(0, 50),
      url: targetPhoto.processed_url
    });

    // Find all photos with the same prompt (likely duplicates)
    const { data: duplicatePhotos, error: duplicatesError } = await supabase
      .from('photos')
      .select('*')
      .eq('prompt', targetPhoto.prompt)
      .eq('public', true);

    if (duplicatesError) {
      console.error('❌ Error finding duplicate photos:', duplicatesError);
      throw new Error(`Failed to find duplicates: ${duplicatesError.message}`);
    }

    if (!duplicatePhotos || duplicatePhotos.length === 0) {
      console.log('ℹ️ No duplicates found, deleting single photo');
      await deletePhoto(photoId);
      return { deletedCount: 1, errors: [] };
    }

    console.log(`📊 Found ${duplicatePhotos.length} photos with same prompt (including original)`);

    const errors: string[] = [];
    let deletedCount = 0;

    // Delete each photo individually to handle errors gracefully
    for (const photo of duplicatePhotos) {
      try {
        await deletePhoto(photo.id);
        deletedCount++;
        console.log(`✅ Deleted duplicate: ${photo.id.substring(0, 8)}`);
      } catch (error) {
        const errorMsg = `Failed to delete ${photo.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.warn(`⚠️ ${errorMsg}`);
      }
    }

    console.log(`📊 Bulk deletion completed: ${deletedCount}/${duplicatePhotos.length} deleted, ${errors.length} errors`);
    
    // Trigger gallery refresh
    window.dispatchEvent(new CustomEvent('galleryUpdate', {
      detail: { 
        action: 'bulkDeleteDuplicates',
        originalPhotoId: photoId,
        deletedCount,
        errors: errors.length
      }
    }));
    
    return { deletedCount, errors };

  } catch (error) {
    console.error('❌ Bulk duplicate deletion failed:', error);
    throw error;
  }
}

// Get storage files for duplicate analysis
export async function getStorageFiles(): Promise<any[]> {
  try {
    console.log('📁 Fetching all storage files...');
    
    const { data, error } = await supabase.storage
      .from('photos')
      .list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('❌ Error fetching storage files:', error);
      throw new Error(`Failed to fetch storage files: ${error.message}`);
    }

    console.log('📊 Storage files loaded:', data?.length || 0);
    return data || [];

  } catch (error) {
    console.error('❌ Error in getStorageFiles:', error);
    throw error;
  }
}

// Delete files from storage by filename
export async function deleteStorageFiles(filenames: string[]): Promise<{ deletedCount: number; errors: string[] }> {
  try {
    console.log('🗑️ Deleting storage files:', filenames.length);
    
    const errors: string[] = [];
    let deletedCount = 0;

    // Process in batches of 100 (Supabase storage limit)
    const batchSize = 100;
    
    for (let i = 0; i < filenames.length; i += batchSize) {
      const batch = filenames.slice(i, i + batchSize);
      console.log(`🔄 Deleting storage batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filenames.length / batchSize)}...`);
      
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove(batch);

      if (storageError) {
        const errorMsg = `Storage batch deletion failed: ${storageError.message}`;
        errors.push(errorMsg);
        console.warn(`⚠️ ${errorMsg}`);
      } else {
        deletedCount += batch.length;
        console.log(`✅ Storage batch deleted successfully (${deletedCount}/${filenames.length})`);
      }
    }
    
    // Also delete corresponding database records
    for (const filename of filenames) {
      try {
        // Find database records that reference this file
        const { data: matchingPhotos } = await supabase
          .from('photos')
          .select('id')
          .or(`original_url.like.%${filename},processed_url.like.%${filename}`);

        if (matchingPhotos && matchingPhotos.length > 0) {
          for (const photo of matchingPhotos) {
            const { error: dbError } = await supabase
              .from('photos')
              .delete()
              .eq('id', photo.id);

            if (dbError) {
              console.warn(`⚠️ Failed to delete database record for ${filename}:`, dbError);
            }
          }
        }
      } catch (dbError) {
        console.warn(`⚠️ Error cleaning up database records for ${filename}:`, dbError);
      }
    }

    console.log(`📊 Storage deletion completed: ${deletedCount}/${filenames.length} files deleted, ${errors.length} errors`);
    
    return { deletedCount, errors };

  } catch (error) {
    console.error('❌ Storage file deletion failed:', error);
    throw error;
  }
}

// Optional: Delete photos older than X days
export async function deleteOldPhotos(daysOld: number = 30): Promise<{ deletedCount: number; errors: string[] }> {
  try {
    console.log(`🗑️ Starting deletion of photos older than ${daysOld} days...`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    // Get old photos
    const { data: oldPhotos, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .lt('created_at', cutoffDate.toISOString())
      .eq('public', true);

    if (fetchError) {
      console.error('❌ Error fetching old photos:', fetchError);
      throw new Error(`Failed to fetch old photos: ${fetchError.message}`);
    }

    if (!oldPhotos || oldPhotos.length === 0) {
      console.log(`ℹ️ No photos older than ${daysOld} days found`);
      return { deletedCount: 0, errors: [] };
    }

    console.log(`📋 Found ${oldPhotos.length} photos older than ${daysOld} days`);

    const errors: string[] = [];
    let deletedCount = 0;

    // Delete each photo individually to handle errors gracefully
    for (const photo of oldPhotos) {
      try {
        await deletePhoto(photo.id);
        deletedCount++;
        console.log(`✅ Deleted old photo: ${photo.id.substring(0, 8)}`);
      } catch (error) {
        const errorMsg = `Failed to delete ${photo.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.warn(`⚠️ ${errorMsg}`);
      }
    }

    console.log(`📊 Old photo deletion completed: ${deletedCount}/${oldPhotos.length} deleted, ${errors.length} errors`);
    
    return { deletedCount, errors };

  } catch (error) {
    console.error('❌ Old photo deletion failed:', error);
    throw error;
  }
}