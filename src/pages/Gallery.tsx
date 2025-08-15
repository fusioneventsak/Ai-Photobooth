// src/lib/supabase.ts - Enhanced persistence and integration
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type Photo = Database['public']['Tables']['photos']['Row'];
export type Config = Database['public']['Tables']['configs']['Row'];

// Enhanced photo fetching with better error handling and persistence
export async function getPublicPhotos(): Promise<Photo[]> {
  try {
    console.log('🔍 Fetching all public photos from database...');
    
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .eq('public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching public photos:', error);
      throw new Error(`Failed to fetch photos: ${error.message}`);
    }

    const photos = data || [];
    console.log('📊 Successfully fetched photos:', {
      count: photos.length,
      photos: photos.slice(0, 3).map(p => ({
        id: p.id.substring(0, 8),
        created: p.created_at,
        type: p.content_type || 'image'
      }))
    });

    // Store last fetch time for debugging
    localStorage.setItem('lastGalleryFetch', new Date().toISOString());
    localStorage.setItem('galleryPhotoCount', photos.length.toString());

    return photos;
  } catch (error) {
    console.error('❌ Error in getPublicPhotos:', error);
    
    // Return empty array on error to prevent app crash
    return [];
  }
}

// Enhanced upload function with immediate gallery integration
export async function uploadPhoto(
  imageData: string | File, 
  prompt: string, 
  contentType: 'image' | 'video' = 'image'
): Promise<Photo | null> {
  try {
    console.log('📤 Starting enhanced photo upload process...');
    console.log('📊 Upload details:', {
      prompt: prompt.substring(0, 50) + '...',
      contentType,
      dataType: typeof imageData === 'string' ? 'string' : 'file'
    });

    let imageUrl: string;

    if (typeof imageData === 'string') {
      // Handle base64 data URL or blob URL
      let blob: Blob;
      
      if (imageData.startsWith('data:')) {
        // Convert data URL to blob
        const response = await fetch(imageData);
        blob = await response.blob();
        console.log('🔄 Converted data URL to blob:', blob.size, 'bytes');
      } else if (imageData.startsWith('blob:')) {
        // Convert blob URL to blob
        const response = await fetch(imageData);
        blob = await response.blob();
        console.log('🔄 Converted blob URL to blob:', blob.size, 'bytes');
      } else {
        throw new Error('Invalid image data format');
      }
      
      // Generate unique filename with timestamp and random suffix
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const extension = contentType === 'video' ? 'mp4' : 'png';
      const filename = `${contentType}_${timestamp}_${randomSuffix}.${extension}`;
      
      console.log('📁 Uploading with filename:', filename);
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, blob, {
          contentType: blob.type || (contentType === 'video' ? 'video/mp4' : 'image/png'),
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload failed:', uploadError);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      if (!uploadData?.path) {
        throw new Error('Upload succeeded but no path returned from storage');
      }

      console.log('✅ File uploaded successfully to storage:', uploadData.path);

      // Get public URL
      const { data: urlData, error: urlError } = supabase.storage
        .from('photos')
        .getPublicUrl(uploadData.path);

      if (urlError || !urlData?.publicUrl) {
        throw new Error('Failed to generate public URL for uploaded file');
      }

      imageUrl = urlData.publicUrl;
      console.log('🔗 Public URL generated:', imageUrl);

    } else {
      // Handle File object
      const timestamp = Date.now();
      const filename = `${contentType}_${timestamp}_${imageData.name}`;
      
      console.log('📁 Uploading file:', filename);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filename, imageData, {
          upsert: false
        });

      if (uploadError || !uploadData?.path) {
        throw new Error(`File upload failed: ${uploadError?.message || 'No path returned'}`);
      }

      const { data: urlData, error: urlError } = supabase.storage
        .from('photos')
        .getPublicUrl(uploadData.path);

      if (urlError || !urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      imageUrl = urlData.publicUrl;
    }

    console.log('💾 Saving photo metadata to database...');

    // Save photo metadata to database
    const { data, error } = await supabase
      .from('photos')
      .insert([{
        original_url: imageUrl,
        processed_url: imageUrl,
        prompt: prompt.trim(),
        content_type: contentType,
        public: true // Ensure photo is public and visible in gallery
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Database insert failed:', error);
      throw new Error(`Database save failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('Photo saved but no data returned');
    }

    console.log('✅ Photo saved successfully:', {
      id: data.id,
      url: data.processed_url,
      public: data.public
    });

    // Immediately trigger gallery refresh events
    console.log('📢 Broadcasting gallery update events...');
    
    // Custom event for immediate updates
    window.dispatchEvent(new CustomEvent('galleryUpdate', {
      detail: { 
        action: 'create',
        newPhoto: data,
        source: 'uploadPhoto',
        timestamp: new Date().toISOString()
      }
    }));

    // Storage event for cross-tab updates
    localStorage.setItem('galleryRefresh', Date.now().toString());
    
    // Update local storage counts
    const currentCount = parseInt(localStorage.getItem('galleryPhotoCount') || '0');
    localStorage.setItem('galleryPhotoCount', (currentCount + 1).toString());

    return data;

  } catch (error) {
    console.error('❌ Photo upload failed:', error);
    throw error;
  }
}

// Enhanced real-time photo subscription for live updates
export function subscribeToPhotoUpdates(callback: (payload: any) => void) {
  console.log('🔔 Setting up real-time photo subscription...');
  
  const subscription = supabase
    .channel('photos-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'photos',
        filter: 'public=eq.true'
      },
      (payload) => {
        console.log('🔔 Real-time photo update received:', {
          eventType: payload.eventType,
          table: payload.table,
          id: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8)
        });
        callback(payload);
      }
    )
    .subscribe((status) => {
      console.log('📡 Photo subscription status:', status);
    });

  return () => {
    console.log('🔌 Unsubscribing from photo updates...');
    subscription.unsubscribe();
  };
}

// Get photo count for quick stats
export async function getPhotoCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .eq('public', true);

    if (error) {
      console.error('❌ Error getting photo count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('❌ Error in getPhotoCount:', error);
    return 0;
  }
}

// Delete individual photo with enhanced cleanup
export async function deletePhoto(photoId: string): Promise<boolean> {
  try {
    console.log('🗑️ Starting enhanced photo deletion for ID:', photoId);
    
    // Get photo details first
    const { data: photo, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .single();

    if (fetchError || !photo) {
      console.error('❌ Photo not found for deletion:', photoId);
      throw new Error('Photo not found');
    }

    // Extract and delete file from storage
    if (photo.processed_url) {
      try {
        const url = new URL(photo.processed_url);
        const pathParts = url.pathname.split('/');
        const photosIndex = pathParts.indexOf('photos');
        
        if (photosIndex !== -1 && photosIndex < pathParts.length - 1) {
          const filePath = pathParts.slice(photosIndex + 1).join('/');
          console.log('🗑️ Deleting file from storage:', filePath);
          
          const { error: storageError } = await supabase.storage
            .from('photos')
            .remove([filePath]);

          if (storageError) {
            console.warn('⚠️ Storage deletion failed (continuing):', storageError);
          } else {
            console.log('✅ File deleted from storage successfully');
          }
        }
      } catch (urlError) {
        console.warn('⚠️ Could not extract file path from URL:', photo.processed_url);
      }
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      console.error('❌ Database deletion failed:', dbError);
      throw new Error(`Failed to delete photo record: ${dbError.message}`);
    }

    console.log('✅ Photo deleted successfully');
    
    // Trigger gallery refresh events
    window.dispatchEvent(new CustomEvent('galleryUpdate', {
      detail: { 
        action: 'delete',
        photoId: photoId,
        timestamp: new Date().toISOString()
      }
    }));
    
    localStorage.setItem('galleryRefresh', Date.now().toString());
    
    // Update local photo count
    const currentCount = parseInt(localStorage.getItem('galleryPhotoCount') || '0');
    localStorage.setItem('galleryPhotoCount', Math.max(0, currentCount - 1).toString());
    
    return true;

  } catch (error) {
    console.error('❌ Photo deletion failed:', error);
    throw error;
  }
}

// Delete all photos with enhanced cleanup
export async function deleteAllPhotos(): Promise<boolean> {
  try {
    console.log('🗑️ Starting enhanced bulk photo deletion...');
    
    // Get all photos for cleanup
    const { data: photos, error: fetchError } = await supabase
      .from('photos')
      .select('*')
      .eq('public', true);

    if (fetchError) {
      throw new Error(`Failed to fetch photos: ${fetchError.message}`);
    }

    if (!photos || photos.length === 0) {
      console.log('ℹ️ No photos found to delete');
      return true;
    }

    console.log(`📋 Found ${photos.length} photos for deletion`);

    // Extract file paths for storage cleanup
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

    // Delete files from storage in batches
    if (filePaths.length > 0) {
      console.log(`🗑️ Deleting ${filePaths.length} files from storage...`);
      
      const batchSize = 100;
      for (let i = 0; i < filePaths.length; i += batchSize) {
        const batch = filePaths.slice(i, i + batchSize);
        
        const { error: storageError } = await supabase.storage
          .from('photos')
          .remove(batch);

        if (storageError) {
          console.warn(`⚠️ Storage batch deletion failed (continuing):`, storageError);
        } else {
          console.log(`✅ Storage batch ${Math.floor(i / batchSize) + 1} deleted successfully`);
        }
      }
    }

    // Delete all records from database
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('public', true);

    if (dbError) {
      console.error('❌ Database bulk deletion failed:', dbError);
      throw new Error(`Failed to delete photo records: ${dbError.message}`);
    }

    console.log(`✅ All ${photos.length} photos deleted successfully`);
    
    // Trigger comprehensive gallery refresh
    window.dispatchEvent(new CustomEvent('galleryUpdate', {
      detail: { 
        action: 'deleteAll',
        count: photos.length,
        timestamp: new Date().toISOString()
      }
    }));
    
    localStorage.setItem('galleryRefresh', Date.now().toString());
    localStorage.setItem('galleryPhotoCount', '0');
    
    return true;

  } catch (error) {
    console.error('❌ Bulk photo deletion failed:', error);
    throw error;
  }
}

// Configuration management
export async function getConfig(): Promise<Config | null> {
  try {
    const { data, error } = await supabase
      .from('configs')
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error fetching config:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('❌ Error in getConfig:', error);
    return null;
  }
}

export async function updateConfig(updates: Partial<Config>): Promise<Config | null> {
  try {
    const { data, error } = await supabase
      .from('configs')
      .update(updates)
      .eq('id', (await getConfig())?.id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating config:', error);
      throw new Error(`Failed to update config: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('❌ Error in updateConfig:', error);
    throw error;
  }
}