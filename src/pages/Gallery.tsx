// src/pages/Gallery.tsx - Updated with social sharing and improved deletion
import React from 'react';
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
  Download,
  Share2,
  Facebook,
  Twitter,
  Instagram,
  Copy,
  Eye,
  EyeOff,
  Settings,
  MoreHorizontal
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
  const [showShareModal, setShowShareModal] = React.useState<Photo | null>(null);
  const [adminMode, setAdminMode] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState(false);

  // Load photos function
  const loadPhotos = async (showLoading = true, source = 'manual') => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      console.log(`Loading gallery photos (${source})`);
      
      const fetchedPhotos = await getPublicPhotos();
      
      const sortedPhotos = fetchedPhotos.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      if (!showLoading && photos.length > 0 && sortedPhotos.length > photos.length) {
        setNewPhotoAlert(true);
        setTimeout(() => setNewPhotoAlert(false), 3000);
      }
      
      setPhotos(sortedPhotos);
      setLastRefresh(new Date());
      
      console.log(`Gallery loaded: ${sortedPhotos.length} photos`);
      
    } catch (err) {
      console.error('Failed to load gallery photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Handle photo deletion
  const handleDeletePhoto = async (photoId: string) => {
    setDeleting(true);
    
    try {
      console.log('Deleting photo:', photoId);
      
      const success = await deletePhoto(photoId);
      
      if (success) {
        console.log('Photo deleted successfully');
        setPhotos(prevPhotos => prevPhotos.filter(photo => photo.id !== photoId));
        setShowDeleteConfirm(null);
        setShowPhotoModal(false); // Close modal if open
        
        // Show success message
        setError(null);
      } else {
        throw new Error('Failed to delete photo');
      }
      
    } catch (error) {
      console.error('Failed to delete photo:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  };

  // Handle delete all photos
  const handleDeleteAllPhotos = async () => {
    setDeleting(true);
    
    try {
      console.log('Deleting all photos...');
      
      const success = await deleteAllPhotos();
      
      if (success) {
        console.log('All photos deleted successfully');
        setPhotos([]);
        setShowDeleteAllConfirm(false);
        setError(null);
      } else {
        throw new Error('Failed to delete all photos');
      }
      
    } catch (error) {
      console.error('Failed to delete all photos:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete all photos');
    } finally {
      setDeleting(false);
    }
  };

  // Social sharing functions
  const shareToFacebook = (photo: Photo) => {
    const url = encodeURIComponent(photo.processed_url || photo.original_url);
    const text = encodeURIComponent(`Check out this amazing ${photo.content_type} from ${config?.brand_name || 'Virtual Photobooth'}!`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank');
  };

  const shareToTwitter = (photo: Photo) => {
    const url = encodeURIComponent(photo.processed_url || photo.original_url);
    const text = encodeURIComponent(`Amazing ${photo.content_type} from ${config?.brand_name || 'Virtual Photobooth'}! 📸✨`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const copyToClipboard = async (photo: Photo) => {
    try {
      await navigator.clipboard.writeText(photo.processed_url || photo.original_url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = photo.processed_url || photo.original_url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const downloadPhoto = async (photo: Photo) => {
    try {
      const response = await fetch(photo.processed_url || photo.original_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${config?.brand_name || 'photobooth'}_${photo.id.substring(0, 8)}.${photo.content_type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download photo:', error);
      setError('Failed to download photo');
    }
  };

  // Admin mode keyboard shortcut
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setAdminMode(prev => !prev);
        console.log('Admin mode toggled:', !adminMode);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [adminMode]);

  // Load photos on mount
  React.useEffect(() => {
    loadPhotos(true, 'initial');
  }, []);

  // Gallery update events
  React.useEffect(() => {
    const handleGalleryUpdate = (event: CustomEvent) => {
      console.log('Gallery update event received');
      
      if (event.detail?.newPhoto) {
        const newPhoto = event.detail.newPhoto;
        setPhotos(prevPhotos => {
          const exists = prevPhotos.some(p => p.id === newPhoto.id);
          if (!exists) {
            setNewPhotoAlert(true);
            setTimeout(() => setNewPhotoAlert(false), 3000);
            return [newPhoto, ...prevPhotos];
          }
          return prevPhotos;
        });
      }
      
      setTimeout(() => loadPhotos(false, 'event-triggered'), 1000);
    };

    window.addEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    
    return () => {
      window.removeEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    };
  }, []);

  // Auto-refresh
  React.useEffect(() => {
    const interval = setInterval(() => {
      loadPhotos(false, 'auto-refresh');
    }, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const forceRefresh = () => {
    loadPhotos(true, 'force-refresh');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-3" />
            <span>Loading gallery...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-light mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Photo Gallery
          </h1>
          <p className="text-xl text-gray-300 font-light">
            Captured moments from {config?.brand_name || 'Virtual Photobooth'}
          </p>
          <div className="mt-4 text-sm text-gray-400">
            Last updated: {formatDate(lastRefresh.toISOString())}
          </div>
        </motion.div>

        {/* Admin Controls */}
        {adminMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-yellow-400" />
                <span className="font-medium text-yellow-200">Admin Mode Active</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={forceRefresh}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                {photos.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete All ({photos.length})
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* New Photo Alert */}
        <AnimatePresence>
          {newPhotoAlert && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3"
            >
              <Bell className="w-5 h-5" />
              <span>New photo added!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-xl text-red-200"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>{error}</span>
            </div>
          </motion.div>
        )}

        {/* Gallery Grid */}
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-300 mb-2">No photos yet</h3>
            <p className="text-gray-400 mb-6">
              Photos will appear here when they're captured with the photobooth.
            </p>
            <button
              onClick={forceRefresh}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Check Again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {photos.map((photo) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative group bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                {/* Media Display */}
                {(photo.content_type === 'video' || photo.content_type === 'mp4') ? (
                  <div className="relative aspect-square">
                    <video
                      src={photo.processed_url || photo.original_url}
                      className="w-full h-full object-cover cursor-pointer"
                      controls={false}
                      playsInline
                      muted
                      poster={photo.thumbnail_url}
                      onClick={() => {
                        setSelectedPhoto(photo);
                        setShowPhotoModal(true);
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <Video className="w-3 h-3" />
                      Video
                    </div>
                  </div>
                ) : (
                  <div className="relative aspect-square">
                    <img
                      src={photo.processed_url || photo.original_url}
                      alt="Gallery"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => {
                        setSelectedPhoto(photo);
                        setShowPhotoModal(true);
                      }}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (img.src !== photo.original_url && photo.original_url) {
                          img.src = photo.original_url;
                        }
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      Image
                    </div>
                  </div>
                )}

                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                  {/* Top Controls */}
                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      {config?.gallery_allow_downloads && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPhoto(photo);
                          }}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {config?.gallery_social_sharing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowShareModal(photo);
                          }}
                          className="p-2 bg-green-600 hover:bg-green-700 rounded-full transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {adminMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(photo.id);
                        }}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Bottom Info */}
                  <div className="text-white">
                    <p className="text-sm font-medium mb-1 line-clamp-2">
                      {photo.prompt && photo.prompt.length > 60 
                        ? photo.prompt.substring(0, 60) + '...' 
                        : photo.prompt || 'No prompt'
                      }
                    </p>
                    <p className="text-xs text-gray-300 mb-1">
                      {formatDate(photo.created_at)}
                    </p>
                    {config?.gallery_show_metadata && (
                      <p className="text-xs text-blue-300">
                        ID: {photo.id.substring(0, 8)}...
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
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
          </div>
        )}

        {/* Delete All Confirmation Modal */}
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteAllConfirm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
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
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowShareModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800 rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-6">
                <Share2 className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-semibold">Share Photo</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => shareToFacebook(showShareModal)}
                  className="flex items-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Facebook className="w-5 h-5" />
                  <span>Facebook</span>
                </button>
                
                <button
                  onClick={() => shareToTwitter(showShareModal)}
                  className="flex items-center gap-2 p-3 bg-blue-400 hover:bg-blue-500 rounded-lg transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                  <span>Twitter</span>
                </button>
                
                <button
                  onClick={() => copyToClipboard(showShareModal)}
                  className="flex items-center gap-2 p-3 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors col-span-2"
                >
                  <Copy className="w-5 h-5" />
                  <span>{copySuccess ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
              
              <button
                onClick={() => setShowShareModal(null)}
                className="w-full px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}

        {/* Photo Modal */}
        {showPhotoModal && selectedPhoto && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onClick={() => setShowPhotoModal(false)}>
            <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowPhotoModal(false)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
              >
                <X className="w-8 h-8" />
              </button>
              
              {selectedPhoto.content_type === 'video' ? (
                <video
                  src={selectedPhoto.processed_url || selectedPhoto.original_url}
                  className="w-full h-auto max-h-[80vh] rounded-lg"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={selectedPhoto.processed_url || selectedPhoto.original_url}
                  alt="Gallery"
                  className="w-full h-auto max-h-[80vh] rounded-lg object-contain"
                />
              )}
              
              {/* Modal Controls */}
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-white">
                    <p className="font-medium mb-1">
                      {selectedPhoto.prompt || 'No prompt'}
                    </p>
                    <p className="text-sm text-gray-300">
                      {formatDate(selectedPhoto.created_at)}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    {config?.gallery_allow_downloads && (
                      <button
                        onClick={() => downloadPhoto(selectedPhoto)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    {config?.gallery_social_sharing && (
                      <button
                        onClick={() => setShowShareModal(selectedPhoto)}
                        className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        title="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}
                    {adminMode && (
                      <button
                        onClick={() => setShowDeleteConfirm(selectedPhoto.id)}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin Mode Hint */}
        {!adminMode && (
          <div className="fixed bottom-4 right-4 text-xs text-gray-500">
            Press Ctrl+Shift+A for admin controls
          </div>
        )}
      </div>
    </div>
  );
}