import React from 'react';
import { motion } from 'framer-motion';
import { useConfigStore } from '../store/configStore';
import { getPublicPhotos } from '../lib/supabase';
import type { Photo } from '../types/supabase';
import { RefreshCw, ImageIcon, Video, Calendar } from 'lucide-react';

export default function Gallery() {
  const { config } = useConfigStore();
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());

  const loadPhotos = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      console.log('🔄 === LOADING GALLERY PHOTOS ===');
      console.log('🔍 Calling getPublicPhotos()...');
      
      const fetchedPhotos = await getPublicPhotos();
      
      console.log('📸 Raw data from database:', fetchedPhotos);
      console.log('📊 Gallery photos loaded:', {
        count: fetchedPhotos.length,
        totalRecords: fetchedPhotos.length,
        photos: fetchedPhotos.map(p => ({
          id: p.id.substring(0, 8),
          type: p.content_type || 'unknown',
          created: p.created_at,
          url: p.processed_url || p.original_url,
          prompt: p.prompt?.substring(0, 50) + '...',
          public: p.public
        }))
      });

      // Sort by created_at descending to show newest first
      const sortedPhotos = fetchedPhotos.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setPhotos(sortedPhotos);
      setLastRefresh(new Date());
      
      console.log('✅ Gallery state updated with', sortedPhotos.length, 'photos');
      
      // Show alert if no photos found
      if (sortedPhotos.length === 0) {
        console.warn('⚠️ No photos found in database!');
      } else {
        console.log('🎉 Found photos! Latest:', {
          id: sortedPhotos[0].id.substring(0, 8),
          created: sortedPhotos[0].created_at,
          prompt: sortedPhotos[0].prompt
        });
      }
      
    } catch (err) {
      console.error('❌ Failed to load gallery photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
      
      // Show detailed error
      alert(`❌ Gallery loading failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    loadPhotos();
  }, []);

  // Listen for new photo uploads from photobooth
  React.useEffect(() => {
    const handleGalleryUpdate = (event: CustomEvent) => {
      console.log('🎉 Gallery update event received:', event.detail);
      
      // Add the new photo to the state immediately for instant feedback
      if (event.detail?.newPhoto) {
        const newPhoto = event.detail.newPhoto;
        console.log('➕ Adding new photo to gallery state:', newPhoto.id);
        
        setPhotos(prevPhotos => {
          // Check if photo already exists to avoid duplicates
          const exists = prevPhotos.some(p => p.id === newPhoto.id);
          if (exists) {
            console.log('⚠️ Photo already exists in gallery, skipping duplicate');
            return prevPhotos;
          }
          
          // Add new photo at the beginning (newest first)
          const updatedPhotos = [newPhoto, ...prevPhotos];
          console.log('✅ Photo added to gallery state, total:', updatedPhotos.length);
          return updatedPhotos;
        });
      }
      
      // Also refresh from database to ensure consistency
      setTimeout(() => {
        console.log('🔄 Refreshing gallery from database...');
        loadPhotos(false);
      }, 1000);
    };

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key === 'galleryRefresh') {
        console.log('💾 Storage update event received');
        loadPhotos(false);
      }
    };

    console.log('👂 Setting up gallery event listeners...');
    window.addEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    window.addEventListener('storage', handleStorageUpdate);
    
    return () => {
      console.log('🧹 Cleaning up gallery event listeners...');
      window.removeEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Auto-refresh every 10 seconds to catch any missed updates  
  React.useEffect(() => {
    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh triggered');
      loadPhotos(false);
    }, 10000); // Reduced from 30s to 10s for faster updates

    return () => clearInterval(interval);
  }, []);

  const getAnimationProps = () => {
    switch (config?.gallery_animation) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.5 }
        };
      case 'slide':
        return {
          initial: { x: 100, opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: -100, opacity: 0 },
          transition: { duration: 0.5 }
        };
      case 'zoom':
        return {
          initial: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 1.2, opacity: 0 },
          transition: { duration: 0.5 }
        };
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.5 }
        };
    }
  };

  const getLayoutClass = () => {
    switch (config?.gallery_layout) {
      case 'masonry':
        return 'columns-2 md:columns-3 lg:columns-4 gap-4';
      case 'carousel':
        return 'flex overflow-x-auto snap-x snap-mandatory';
      default: // grid
        return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center" style={{ color: config?.primary_color }}>
            Gallery
          </h1>
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-3" />
            <span className="text-gray-300">Loading gallery...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="container mx-auto">
          <h1 className="text-4xl font-bold mb-8 text-center" style={{ color: config?.primary_color }}>
            Gallery
          </h1>
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">❌ Failed to load gallery</div>
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => loadPhotos()}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ color: config?.primary_color }}>
            Gallery
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => loadPhotos()}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <div className="text-sm text-gray-400 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Updated {formatDate(lastRefresh.toISOString())}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{photos.length}</div>
            <div className="text-sm text-gray-400">Total Items</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">
              {photos.filter(p => !p.content_type || p.content_type === 'image').length}
            </div>
            <div className="text-sm text-gray-400">Images</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {photos.filter(p => p.content_type === 'video' || p.content_type === 'mp4').length}
            </div>
            <div className="text-sm text-gray-400">Videos</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {photos.filter(p => p.public !== false).length}
            </div>
            <div className="text-sm text-gray-400">Public</div>
          </div>
        </div>
        
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold mb-2 text-gray-300">No photos yet</h2>
            <p className="text-gray-500">
              Generate some AI magic in the photobooth to see it here!
            </p>
          </div>
        ) : (
          <div className={getLayoutClass()}>
            {photos.map((photo) => (
              <motion.div
                key={photo.id}
                {...getAnimationProps()}
                className={`
                  relative group
                  ${config?.gallery_layout === 'carousel' ? 'flex-none w-80 snap-center' : ''}
                  ${config?.gallery_layout === 'masonry' ? 'mb-4' : ''}
                `}
              >
                {(photo.content_type === 'video' || photo.content_type === 'mp4') ? (
                  <div className="relative">
                    <video
                      src={photo.processed_url || photo.original_url}
                      className="w-full h-auto rounded-lg shadow-lg"
                      controls
                      playsInline
                      poster={photo.thumbnail_url}
                    />
                    <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      Video
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={photo.processed_url || photo.original_url}
                      alt="Gallery"
                      className="w-full h-auto rounded-lg shadow-lg"
                      onError={(e) => {
                        console.warn('❌ Failed to load image:', photo.id, e);
                        // Fallback to original_url if processed_url fails
                        const img = e.target as HTMLImageElement;
                        if (img.src !== photo.original_url && photo.original_url) {
                          img.src = photo.original_url;
                        }
                      }}
                    />
                    <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      Image
                    </div>
                  </div>
                )}
                
                {/* Overlay with photo info */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col justify-end p-4">
                  <div className="text-white">
                    <p className="text-sm font-medium mb-1">
                      {photo.prompt.length > 50 
                        ? photo.prompt.substring(0, 50) + '...' 
                        : photo.prompt
                      }
                    </p>
                    <p className="text-xs text-gray-300">
                      {formatDate(photo.created_at)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}