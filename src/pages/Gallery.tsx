{(photo.content_type === 'video' || photo.content_type === 'mp4') ? (
                    <div className="relative">
                      <video
                        src={photo.processed_url || photo.original_url}
                        className="w-full h-auto rounded-lg shadow-lg cursor-pointer"
                        controls
                        playsInline
                        poster={photo.thumbnail_url}
                        onClick={(e) => {
                          // Only open modal if not clicking near the top-right corner (delete button area)
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const clickY = e.clientY - rect.top;
                          
                          // Check if click is in delete button area (top-right 60x60 pixels)
                          if (clickX > rect.width - 60 && clickY < 60) {
                            return; // Don't open modal
                          }
                          
                          setSelectedPhoto(photo);
                          setShowPhotoModal(true);
                        }}
                        onError={(e) => {
                          console.warn('❌ Failed to load video:', photo.id, e);
                        }}
                      />
                      <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        Video
                      </div>
                      
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('🗑️ Delete button clicked for video:', photo.id);
                          setShowDeleteConfirm(photo.id);
                        }}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-lg"
                        title="Delete video"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfigStore } from '../store/configStore';
import { getPublicPhotos, deletePhoto, deleteAllPhotos } from '../lib/supabase';
import type { Photo } from '../types/supabase';
import { 
  RefreshCw, 
  ImageIcon, 
  Video, 
  Calendar, 
  Bell, 
  Trash2, 
  AlertTriangle,
  X,
  Eye,
  MoreVertical
} from 'lucide-react';

export default function Gallery() {
  const { config } = useConfigStore();
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = React.useState<Date>(new Date());
  const [newPhotoAlert, setNewPhotoAlert] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [selectedPhoto, setSelectedPhoto] = React.useState<Photo | null>(null);
  const [showPhotoModal, setShowPhotoModal] = React.useState(false);

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
        setTimeout(() => setNewPhotoAlert(false), 3000);
      }
      
      setPhotos(sortedPhotos);
      setLastRefresh(new Date());
      
      console.log('✅ Gallery state updated with', sortedPhotos.length, 'photos');
      
    } catch (err) {
      console.error('❌ Failed to load gallery photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Delete individual photo
  const handleDeletePhoto = async (photoId: string) => {
    setDeleting(true);
    
    try {
      console.log('🗑️ Deleting photo:', photoId);
      
      const success = await deletePhoto(photoId);
      
      if (success) {
        console.log('✅ Photo deleted successfully');
        
        // Remove from local state immediately for instant feedback
        setPhotos(prevPhotos => prevPhotos.filter(photo => photo.id !== photoId));
        
        // Refresh from database to ensure consistency
        setTimeout(() => {
          loadPhotos(false, 'delete-refresh');
        }, 500);
        
        setShowDeleteConfirm(null);
      } else {
        throw new Error('Failed to delete photo');
      }
      
    } catch (error) {
      console.error('❌ Failed to delete photo:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  };

  // Delete all photos
  const handleDeleteAllPhotos = async () => {
    setDeleting(true);
    
    try {
      console.log('🗑️ Deleting all photos...');
      
      const success = await deleteAllPhotos();
      
      if (success) {
        console.log('✅ All photos deleted successfully');
        
        // Clear local state immediately
        setPhotos([]);
        setShowDeleteAllConfirm(false);
        
        // Refresh from database to ensure consistency
        setTimeout(() => {
          loadPhotos(false, 'delete-all-refresh');
        }, 500);
        
      } else {
        throw new Error('Failed to delete all photos');
      }
      
    } catch (error) {
      console.error('❌ Failed to delete all photos:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete all photos');
    } finally {
      setDeleting(false);
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
      
      if (event.detail?.newPhoto) {
        const newPhoto = event.detail.newPhoto;
        console.log('➕ Adding new photo to gallery state immediately:', {
          id: newPhoto.id,
          type: newPhoto.content_type,
          created: newPhoto.created_at
        });
        
        setPhotos(prevPhotos => {
          const exists = prevPhotos.some(p => p.id === newPhoto.id);
          if (exists) {
            console.log('⚠️ Photo already exists in gallery, skipping duplicate');
            return prevPhotos;
          }
          
          const updatedPhotos = [newPhoto, ...prevPhotos];
          console.log('✅ Photo added to gallery state, total:', updatedPhotos.length);
          
          setNewPhotoAlert(true);
          setTimeout(() => setNewPhotoAlert(false), 3000);
          
          return updatedPhotos;
        });
      }
      
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
    
    window.addEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    window.addEventListener('storage', handleStorageUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      console.log('🧹 Cleaning up enhanced gallery event listeners...');
      window.removeEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
      window.removeEventListener('storage', handleStorageUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Auto-refresh every 5 seconds
  React.useEffect(() => {
    console.log('⏰ Setting up auto-refresh timer...');
    
    const interval = setInterval(() => {
      console.log('🔔 Auto-refresh triggered');
      loadPhotos(false, 'auto-refresh');
    }, 5000);

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

  // Force refresh function
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
            <button
              onClick={() => {
                setError(null);
                loadPhotos(true, 'retry');
              }}
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
        {/* New Photo Alert */}
        <AnimatePresence>
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
        </AnimatePresence>

        {/* Header with Moderation Controls */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ color: config?.primary_color }}>
            Gallery
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={forceRefresh}
              disabled={deleting}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${deleting ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {/* Delete All Button */}
            {photos.length > 0 && (
              <button
                onClick={() => setShowDeleteAllConfirm(true)}
                disabled={deleting}
                className="flex items-center gap-2 px-3 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition text-sm disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete All
              </button>
            )}
            
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
            <AnimatePresence>
              {photos.map((photo) => (
                <motion.div
                  key={photo.id}
                  {...getAnimationProps()}
                  layout
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
                        className="w-full h-auto rounded-lg shadow-lg cursor-pointer"
                        controls
                        playsInline
                        poster={photo.thumbnail_url}
                        onClick={() => {
                          setSelectedPhoto(photo);
                          setShowPhotoModal(true);
                        }}
                        onError={(e) => {
                          console.warn('❌ Failed to load video:', photo.id, e);
                        }}
                      />
                      <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        Video
                      </div>
                      
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('🗑️ Delete button clicked for photo:', photo.id);
                          setShowDeleteConfirm(photo.id);
                        }}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-lg"
                        title="Delete photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={photo.processed_url || photo.original_url}
                        alt="Gallery"
                        className="w-full h-auto rounded-lg shadow-lg cursor-pointer"
                        onClick={(e) => {
                          // Only open modal if not clicking near the top-right corner (delete button area)
                          const rect = e.currentTarget.getBoundingClientRect();
                          const clickX = e.clientX - rect.left;
                          const clickY = e.clientY - rect.top;
                          
                          // Check if click is in delete button area (top-right 60x60 pixels)
                          if (clickX > rect.width - 60 && clickY < 60) {
                            return; // Don't open modal
                          }
                          
                          setSelectedPhoto(photo);
                          setShowPhotoModal(true);
                        }}
                        onLoad={() => {
                          console.log('✅ Gallery image loaded successfully:', photo.id);
                        }}
                        onError={(e) => {
                          console.warn('❌ Failed to load image:', photo.id, e);
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
                      
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('🗑️ Delete button clicked for photo:', photo.id);
                          setShowDeleteConfirm(photo.id);
                        }}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-lg"
                        title="Delete photo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
            </AnimatePresence>
          </div>
        )}

        {/* Delete Single Photo Confirmation Modal */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-800 rounded-xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <h3 className="text-lg font-semibold">Delete Photo</h3>
                </div>
                <p className="text-gray-300 mb-6">
                  Are you sure you want to delete this photo? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeletePhoto(showDeleteConfirm)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete All Photos Confirmation Modal */}
        <AnimatePresence>
          {showDeleteAllConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowDeleteAllConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gray-800 rounded-xl p-6 max-w-md w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <h3 className="text-lg font-semibold">Delete All Photos</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Are you sure you want to delete <strong>all {photos.length} photos</strong>? 
                </p>
                <p className="text-red-400 text-sm mb-6">
                  This action cannot be undone and will permanently remove all photos from your gallery.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteAllConfirm(false)}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllPhotos}
                    disabled={deleting}
                    className="flex-1 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Deleting All...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete All
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Photo Detail Modal */}
        <AnimatePresence>
          {showPhotoModal && selectedPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
              onClick={() => setShowPhotoModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-4xl max-h-[90vh] w-full"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
                >
                  <X className="w-8 h-8" />
                </button>
                
                {selectedPhoto.content_type === 'video' ? (
                  <video
                    src={selectedPhoto.processed_url || selectedPhoto.original_url}
                    className="w-full h-auto rounded-lg max-h-[80vh] object-contain"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={selectedPhoto.processed_url || selectedPhoto.original_url}
                    alt="Selected"
                    className="w-full h-auto rounded-lg max-h-[80vh] object-contain"
                  />
                )}
                
                <div className="bg-gray-800/90 rounded-b-lg p-4 mt-2">
                  <p className="text-white font-medium mb-2">
                    {selectedPhoto.prompt || 'No prompt'}
                  </p>
                  <div className="flex justify-between items-center text-sm text-gray-300">
                    <span>{formatDate(selectedPhoto.created_at)}</span>
                    <span>ID: {selectedPhoto.id.substring(0, 8)}</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}