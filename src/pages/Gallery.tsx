import React from 'react';
import { motion } from 'framer-motion';
import { useConfigStore } from '../store/configStore';
import { getPublicPhotos } from '../lib/supabase';
import type { Photo } from '../types/supabase';
import { RefreshCw, ImageIcon, Video, Calendar, Bell } from 'lucide-react';

export default function Gallery() {
  const { config } = useConfigStore();
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
  const [newPhotoAlert, setNewPhotoAlert] = React.useState(false);

  const loadPhotos = async (showLoading = true, source = 'manual') => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      console.log(`🔄 === LOADING GALLERY PHOTOS (${source.toUpperCase()}) ===`);
      console.log('🔍 Calling getPublicPhotos()...');
      
      const fetchedPhotos = await getPublicPhotos();
      
      console.log('📸 Raw data from database:', fetchedPhotos);
      console.log('📊 Gallery photos loaded:', {
        count: fetchedPhotos.length,
        source: source,
        timestamp: new Date().toISOString(),
        photos: fetchedPhotos.slice(0, 3).map(p => ({
          id: p.id.substring(0, 8),
          type: p.content_type || 'unknown',
          created: p.created_at,
          url: p.processed_url || p.original_url,
          prompt: p.prompt?.substring(0, 30) + '...',
          public: p.public
        }))
      });

      // Sort by created_at descending to show newest first
      const sortedPhotos = fetchedPhotos.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      // Check if we have new photos (only if not initial load)
      if (!showLoading && photos.length > 0 && sortedPhotos.length > photos.length) {
        console.log('🎉 NEW PHOTOS DETECTED!', {
          oldCount: photos.length,
          newCount: sortedPhotos.length,
          difference: sortedPhotos.length - photos.length
        });
        
        setNewPhotoAlert(true);
        setTimeout(() => setNewPhotoAlert(false), 3000); // Hide alert after 3 seconds
      }
      
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
          prompt: sortedPhotos[0].prompt?.substring(0, 50)
        });
      }
      
    } catch (err) {
      console.error('❌ Failed to load gallery photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
      
      // Show detailed error
      console.error('📊 Gallery loading error details:', {
        error: err,
        timestamp: new Date().toISOString(),
        source: source
      });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load
  React.useEffect(() => {
    console.log('🚀 Gallery component mounted, loading initial photos...');
    loadPhotos(true, 'initial');
  }, []);

  // Enhanced event listeners for gallery updates
  React.useEffect(() => {
    const handleGalleryUpdate = (event: CustomEvent) => {
      console.log('🎉 === GALLERY UPDATE EVENT RECEIVED ===');
      console.log('📨 Event details:', event.detail);
      
      // Add the new photo to the state immediately for instant feedback
      if (event.detail?.newPhoto) {
        const newPhoto = event.detail.newPhoto;
        console.log('➕ Adding new photo to gallery state immediately:', {
          id: newPhoto.id,
          type: newPhoto.content_type,
          created: newPhoto.created_at
        });
        
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
          
          // Show new photo alert
          setNewPhotoAlert(true);
          setTimeout(() => setNewPhotoAlert(false), 3000);
          
          return updatedPhotos;
        });
      }
      
      // Also refresh from database to ensure consistency
      setTimeout(() => {
        console.log('🔄 Refreshing gallery from database after event...');
        loadPhotos(false, 'event-triggered');
      }, 1000);
    };

    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key === 'galleryRefresh') {
        console.log('💾 Storage update event received');
        loadPhotos(false, 'storage');
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👀 Page became visible, refreshing gallery...');
        loadPhotos(false, 'visibility');
      }
    };

    const handleFocus = () => {
      console.log('🎯 Window focused, refreshing gallery...');
      loadPhotos(false, 'focus');
    };

    console.log('👂 Setting up enhanced gallery event listeners...');
    
    // Main gallery update event
    window.addEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    
    // Storage events
    window.addEventListener('storage', handleStorageUpdate);
    
    // Page visibility events (when user switches tabs)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Window focus events
    window.addEventListener('focus', handleFocus);
    
    return () => {
      console.log('🧹 Cleaning up enhanced gallery event listeners...');
      window.removeEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
      window.removeEventListener('storage', handleStorageUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // More frequent auto-refresh for better responsiveness
  React.useEffect(() => {
    console.log('⏰ Setting up auto-refresh timer...');
    
    const interval = setInterval(() => {
      console.log('🔔 Auto-refresh triggered');
      loadPhotos(false, 'auto-refresh');
    }, 5000); // Refresh every 5 seconds

    return () => {
      console.log('🛑 Clearing auto-refresh timer');
      clearInterval(interval);
    };
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

  // Force refresh function for manual testing
  const forceRefresh = async () => {
    console.log('🔄 === FORCE REFRESH TRIGGERED ===');
    await loadPhotos(true, 'force-refresh');
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
            <div className="space-x-4">
              <button
                onClick={() => loadPhotos(true, 'retry')}
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  console.log('🔧 Opening browser console for debugging...');
                  console.log('📊 Current gallery state:', { photos, error, lastRefresh });
                }}
                className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition"
              >
                Debug Info
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="container mx-auto">
        {/* New Photo Alert */}
        {newPhotoAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2"
          >
            <Bell className="w-5 h-5" />
            <span>New photo added!</span>
          </motion.div>
        )}

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ color: config?.primary_color }}>
            Gallery
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={forceRefresh}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Force Refresh
            </button>
            <div className="text-sm text-gray-400 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Updated {formatDate(lastRefresh.toISOString())}
            </div>
          </div>
        </div>

        {/* Enhanced Stats with Real-time Updates */}
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

        {/* Debug Panel (only visible in development) */}
        {import.meta.env.DEV && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-600">
            <h3 className="text-lg font-semibold mb-2 text-purple-400">🔧 Debug Panel</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Last Refresh:</strong><br />
                {lastRefresh.toLocaleTimeString()}
              </div>
              <div>
                <strong>Photos in State:</strong><br />
                {photos.length} items
              </div>
              <div>
                <strong>Auto-refresh:</strong><br />
                <span className="text-green-400">Every 5 seconds</span>
              </div>
            </div>
            <button
              onClick={() => {
                console.log('🔍 === GALLERY DEBUG INFO ===');
                console.log('📊 Current photos state:', photos);
                console.log('⏰ Last refresh:', lastRefresh);
                console.log('❌ Current error:', error);
                console.log('🔄 Loading status:', loading);
              }}
              className="mt-2 px-3 py-1 bg-purple-600 rounded text-xs hover:bg-purple-700 transition"
            >
              Log Debug Info
            </button>
          </div>
        )}
        
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold mb-2 text-gray-300">No photos yet</h2>
            <p className="text-gray-500 mb-4">
              Generate some AI magic in the photobooth to see it here!
            </p>
            <button
              onClick={forceRefresh}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Check Again
            </button>
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
                      onError={(e) => {
                        console.warn('❌ Failed to load video:', photo.id, e);
                      }}
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
                      onLoad={() => {
                        console.log('✅ Gallery image loaded successfully:', photo.id);
                      }}
                      onError={(e) => {
                        console.warn('❌ Failed to load image:', photo.id, e);
                        // Fallback to original_url if processed_url fails
                        const img = e.target as HTMLImageElement;
                        if (img.src !== photo.original_url && photo.original_url) {
                          console.log('🔄 Trying fallback URL for:', photo.id);
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
                
                {/* Enhanced overlay with photo info */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col justify-end p-4">
                  <div className="text-white">
                    <p className="text-sm font-medium mb-1">
                      {photo.prompt && photo.prompt.length > 50 
                        ? photo.prompt.substring(0, 50) + '...' 
                        : photo.prompt || 'No prompt'
                      }
                    </p>
                    <p className="text-xs text-gray-300 mb-1">
                      {formatDate(photo.created_at)}
                    </p>
                    <p className="text-xs text-blue-300">
                      ID: {photo.id.substring(0, 8)}...
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