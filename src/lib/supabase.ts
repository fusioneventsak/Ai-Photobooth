// Complete src/lib/supabase.ts file with all functions
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

// Enhanced uploadPhoto function with comprehensive error handling
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
      dataLength: typeof imageData === 'string' ? imageData.length : imageData.size,
      promptLength: prompt.length
    });

    let imageUrl: string;
    
    if (typeof imageData === 'string') {
      // Handle both data URLs and blob URLs
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
      } else {
        throw new Error('Invalid image data: must be a data URL or blob URL');
      }
      
      // Generate unique filename with proper extension
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const extension = contentType === 'video' ? 'mp4' : 'png';
      const filename = `${contentType}_${timestamp}_${randomSuffix}.${extension}`;
      
      console.log('📁 Uploading with filename:', filename);
      console.log('📊 Upload details:', {
        filename,
        blobSize: blob.size,
        blobType: blob.type,
        contentType
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
      } else if (message.includes('storage upload failed') || message.includes('failed to fetch blob')) {
        throw new Error('Failed to upload to cloud storage. Please check your internet connection and try again.');
      } else if (message.includes('database') || message.includes('insert failed')) {
        throw new Error('Failed to save photo information. The image was uploaded but not cataloged.');
      } else if (message.includes('public url') || message.includes('failed to get')) {
        throw new Error('Upload succeeded but failed to generate access URL. Please try again.');
      } else if (message.includes('conversion failed') || message.includes('blob is empty')) {
        throw new Error('Image data conversion failed. Please try capturing a new photo.');
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

// Get public photos function
export async function getPublicPhotos(): Promise<Photo[]> {
  try {
    console.log('🔍 Fetching public photos from database...');
    
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('public', true)
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
    
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error('❌ Database deletion failed:', dbError);
      throw new Error(`Failed to delete photo record: ${dbError.message}`);
    }

    console.log('✅ Photo deleted successfully from database');
    
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

    console.log('✅ All photos deleted successfully from database:', {
      recordsDeleted: count || photos.length,
      filesDeleted: filePaths.length
    });
    
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