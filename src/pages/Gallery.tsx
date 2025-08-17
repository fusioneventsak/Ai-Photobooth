import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  RefreshCw, 
  AlertCircle,
  Eye,
  EyeOff,
  Settings,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Grid,
  List,
  Layers,
  Copy,
  Check,
  X,
  Share2,
  Link,
  Facebook,
  Twitter,
  MessageCircle
} from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { 
  getPublicPhotos, 
  deletePhoto, 
  deleteAllPhotos, 
  deletePhotoAndAllDuplicates 
} from '../lib/supabase';
import type { Photo } from '../types/supabase';

export default function Gallery() {
  const { config } = useConfigStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Carousel state
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselPlaying, setCarouselPlaying] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);

  // Confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  // Load photos
  const loadPhotos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Force cache bust
      const timestamp = Date.now();
      console.log(`🔄 Loading photos with cache bust: ${timestamp}`);
      
      const fetchedPhotos = await getPublicPhotos();
      
      // Log detailed photo info for debugging
      console.log('📊 Detailed photo analysis:', {
        totalPhotos: fetchedPhotos.length,
        uniquePrompts: new Set(fetchedPhotos.map(p => p.prompt)).size,
        duplicateGroups: Object.entries(
          fetchedPhotos.reduce((acc, photo) => {
            acc[photo.prompt] = (acc[photo.prompt] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).filter(([_, count]) => count > 1),
        photoIds: fetchedPhotos.map(p => ({ id: p.id.substring(0, 8), prompt: p.prompt.substring(0, 30) }))
      });
      
      setPhotos(fetchedPhotos);
      console.log('📸 Gallery loaded:', fetchedPhotos.length, 'photos at', new Date().toISOString());
    } catch (err) {
      console.error('❌ Failed to load photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [forceRefresh]);

  // Initial load
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  // Listen for gallery updates
  useEffect(() => {
    const handleGalleryUpdate = (event: CustomEvent) => {
      console.log('🔄 Gallery update event received:', event.detail);
      // Force a complete refresh
      setForceRefresh(prev => prev + 1);
    };

    window.addEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    
    return () => {
      window.removeEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setShowAdmin(!showAdmin);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setDebugMode(!debugMode);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        handleForceRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAdmin, debugMode]);

  // Carousel auto-play
  useEffect(() => {
    if (config?.gallery_layout === 'carousel' && carouselPlaying && photos.length > 1) {
      const interval = setInterval(() => {
        setCarouselIndex(prev => (prev + 1) % photos.length);
      }, config.gallery_speed || 3000);
      
      return () => clearInterval(interval);
    }
  }, [config?.gallery_layout, config?.gallery_speed, carouselPlaying, photos.length]);

  // Force refresh handler
  const handleForceRefresh = useCallback(() => {
    setForceRefresh(prev => prev + 1);
  }, []);

  // Download photo
  const handleDownloadPhoto = async (photo: Photo, filename?: string) => {
    try {
      setDownloading(photo.id);
      console.log('📥 Starting download for photo:', photo.id);

      const imageUrl = photo.processed_url || photo.original_url;
      if (!imageUrl) {
        throw new Error('No image URL available');
      }

      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const extension = photo.content_type === 'video' ? 'mp4' : 'jpg';
      const defaultFilename = `photo_${new Date(photo.created_at).toISOString().split('T')[0]}_${photo.id.substring(0, 8)}.${extension}`;
      link.download = filename || defaultFilename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ Photo downloaded successfully');
    } catch (err) {
      console.error('❌ Failed to download photo:', err);
      setError(err instanceof Error ? err.message : 'Failed to download photo');
    } finally {
      setDownloading(null);
    }
  };

  // Delete photo with confirmation
  const handleDeletePhoto = async (photoId: string) => {
    try {
      setDeleting(photoId);
      console.log('🗑️ Deleting photo:', photoId);
      
      await deletePhoto(photoId);
      
      // Update local state immediately for better UX
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      
      // Close any open modals if this photo was selected
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
      
      // Update carousel index if needed
      if (carouselIndex >= photos.length - 1) {
        setCarouselIndex(Math.max(0, photos.length - 2));
      }
      
      console.log('✅ Photo deleted successfully');
    } catch (err) {
      console.error('❌ Failed to delete photo:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
      // Refresh gallery to get accurate state
      loadPhotos();
    } finally {
      setDeleting(null);
      setShowDeleteConfirm(null);
    }
  };

  // Delete photo and all duplicates
  const handleDeletePhotoAndDuplicates = async (photoId: string) => {
    try {
      setDeleting(photoId);
      console.log('🗑️ Deleting photo and duplicates:', photoId);
      
      const result = await deletePhotoAndAllDuplicates(photoId);
      
      // Refresh the gallery to show updated state
      await loadPhotos();
      
      console.log(`✅ Deleted ${result.deletedCount} photos (including duplicates)`);
      
      if (result.errors.length > 0) {
        console.warn('⚠️ Some deletions failed:', result.errors);
        setError(`Deleted ${result.deletedCount} photos, but ${result.errors.length} failed`);
      }
    } catch (err) {
      console.error('❌ Failed to delete photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photos');
      loadPhotos();
    } finally {
      setDeleting(null);
      setShowDeleteConfirm(null);
    }
  };

  // Delete all photos
  const handleDeleteAll = async () => {
    try {
      setLoading(true);
      console.log('🗑️ Deleting all photos');
      
      await deleteAllPhotos();
      
      // Clear local state immediately
      setPhotos([]);
      setSelectedPhoto(null);
      setCarouselIndex(0);
      
      console.log('✅ All photos deleted successfully');
    } catch (err) {
      console.error('❌ Failed to delete all photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete all photos');
      // Refresh to get accurate state
      loadPhotos();
    } finally {
      setLoading(false);
      setShowDeleteAllConfirm(false);
    }
  };

  // Carousel navigation
  const nextSlide = () => {
    setCarouselIndex(prev => (prev + 1) % photos.length);
  };

  const prevSlide = () => {
    setCarouselIndex(prev => (prev - 1 + photos.length) % photos.length);
  };

  // Social sharing functions
  const getShareableUrl = (photo: Photo): string => {
    // Use the photo's public URL or fallback to current page with photo ID
    return photo.processed_url || photo.original_url || `${window.location.origin}${window.location.pathname}?photo=${photo.id}`;
  };

  const copyToClipboard = async (text: string, photoId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(photoId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy to clipboard');
    }
  };

  const shareToFacebook = (photo: Photo) => {
    const url = getShareableUrl(photo);
    const text = encodeURIComponent(`Check out this amazing AI-generated photo: "${photo.prompt}"`);
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${text}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
    setShowShareMenu(null);
  };

  const shareToTwitter = (photo: Photo) => {
    const url = getShareableUrl(photo);
    const text = encodeURIComponent(`Check out this AI-generated photo: "${photo.prompt}" 🎨✨`);
    const shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
    setShowShareMenu(null);
  };

  const shareToWhatsApp = (photo: Photo) => {
    const url = getShareableUrl(photo);
    const text = encodeURIComponent(`Check out this amazing AI-generated photo: "${photo.prompt}" ${url}`);
    const shareUrl = `https://wa.me/?text=${text}`;
    window.open(shareUrl, '_blank');
    setShowShareMenu(null);
  };

  const shareWithWebShareAPI = async (photo: Photo) => {
    if (navigator.share) {
      try {
        // For images, we can try to share the actual file
        const url = getShareableUrl(photo);
        
        const shareData: ShareData = {
          title: 'AI Generated Photo',
          text: `Check out this amazing AI-generated photo: "${photo.prompt}"`,
          url: url
        };

        // Try to include the image file if possible
        if (photo.content_type?.startsWith('image/')) {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], `ai-photo-${photo.id.substring(0, 8)}.jpg`, { type: blob.type });
            shareData.files = [file];
          } catch (fileError) {
            console.log('Could not include file in share, sharing URL only');
          }
        }

        await navigator.share(shareData);
        setShowShareMenu(null);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
          setError('Failed to share photo');
        }
      }
    }
  };

  // Photo action buttons component
  const PhotoActions = ({ photo, className = "" }: { photo: Photo; className?: string }) => (
    <div className={`flex gap-2 ${className}`}>
      <button
        onClick={() => setSelectedPhoto(photo)}
        className="p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition"
        title="View fullscreen"
      >
        <Eye className="w-5 h-5" />
      </button>
      
      <button
        onClick={() => handleDownloadPhoto(photo)}
        disabled={downloading === photo.id}
        className="p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition disabled:opacity-50"
        title="Download photo"
      >
        {downloading === photo.id ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <Download className="w-5 h-5" />
        )}
      </button>

      {/* Share button with dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowShareMenu(showShareMenu === photo.id ? null : photo.id)}
          className="share-button p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition"
          title="Share photo"
        >
          <Share2 className="w-5 h-5" />
        </button>

        {/* Share dropdown menu */}
        {showShareMenu === photo.id && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="share-menu absolute right-0 top-full mt-2 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-2 min-w-48 z-10"
          >
            {/* Native share API (if supported) */}
            {navigator.share && (
              <button
                onClick={() => shareWithWebShareAPI(photo)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition"
              >
                <Share2 className="w-4 h-4" />
                Share...
              </button>
            )}

            {/* Copy link */}
            <button
              onClick={() => copyToClipboard(getShareableUrl(photo), photo.id)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition"
            >
              {copySuccess === photo.id ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  Copy Link
                </>
              )}
            </button>

            <div className="border-t border-gray-700 my-2"></div>

            {/* Social media shares */}
            <button
              onClick={() => shareToFacebook(photo)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition"
            >
              <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">f</span>
              </div>
              Facebook
            </button>

            <button
              onClick={() => shareToTwitter(photo)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition"
            >
              <div className="w-4 h-4 bg-blue-400 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">𝕏</span>
              </div>
              Twitter / X
            </button>

            <button
              onClick={() => shareToWhatsApp(photo)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition"
            >
              <MessageCircle className="w-4 h-4 text-green-500" />
              WhatsApp
            </button>
          </motion.div>
        )}
      </div>
      
      {/* Always show delete buttons, but style them differently based on admin mode */}
      <button
        onClick={() => showAdmin ? setShowDeleteConfirm(photo.id) : setShowAdmin(true)}
        disabled={deleting === photo.id}
        className={`p-2 rounded-full transition disabled:opacity-50 ${
          showAdmin 
            ? 'bg-red-500 bg-opacity-20 hover:bg-opacity-30' 
            : 'bg-gray-500 bg-opacity-20 hover:bg-opacity-30'
        }`}
        title={showAdmin ? "Delete photo" : "Enable admin mode to delete"}
      >
        {deleting === photo.id ? (
          <RefreshCw className="w-5 h-5 animate-spin" />
        ) : (
          <Trash2 className="w-5 h-5" />
        )}
      </button>
      
      {showAdmin && (
        <button
          onClick={() => setShowDeleteConfirm(`${photo.id}-duplicates`)}
          disabled={deleting === photo.id}
          className="p-2 bg-orange-500 bg-opacity-20 rounded-full hover:bg-opacity-30 transition disabled:opacity-50"
          title="Delete this photo and all duplicates"
        >
          {deleting === photo.id ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <Copy className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  );

  // Delete confirmation modal
  const DeleteConfirmModal = () => {
    if (!showDeleteConfirm) return null;

    const isDuplicateDelete = showDeleteConfirm.includes('-duplicates');
    const photoId = isDuplicateDelete ? showDeleteConfirm.split('-')[0] : showDeleteConfirm;
    const photo = photos.find(p => p.id === photoId);

    if (!photo) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={() => setShowDeleteConfirm(null)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-800 rounded-lg p-6 max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500 bg-opacity-20 rounded-full">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {isDuplicateDelete ? 'Delete Photo & Duplicates' : 'Delete Photo'}
            </h3>
          </div>
          
          <div className="mb-4">
            <div className="aspect-video w-full bg-gray-700 rounded-lg overflow-hidden mb-3">
              {photo.content_type === 'video' ? (
                <video
                  src={photo.processed_url || photo.original_url}
                  className="w-full h-full object-cover"
                  muted
                />
              ) : (
                <img
                  src={photo.processed_url || photo.original_url}
                  alt={photo.prompt}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            
            <p className="text-gray-300 text-sm mb-2">{photo.prompt}</p>
            <p className="text-gray-500 text-xs">
              {new Date(photo.created_at).toLocaleString()}
            </p>
          </div>

          <p className="text-gray-300 mb-6">
            {isDuplicateDelete 
              ? 'This will permanently delete this photo and all photos with the same prompt. This action cannot be undone.'
              : 'This will permanently delete this photo from storage. This action cannot be undone.'
            }
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => isDuplicateDelete 
                ? handleDeletePhotoAndDuplicates(photoId)
                : handleDeletePhoto(photoId)
              }
              disabled={deleting === photoId}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              {deleting === photoId ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // Delete all confirmation modal
  const DeleteAllConfirmModal = () => {
    if (!showDeleteAllConfirm) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        onClick={() => setShowDeleteAllConfirm(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-800 rounded-lg p-6 max-w-md w-full"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-500 bg-opacity-20 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Delete All Photos</h3>
          </div>

          <p className="text-gray-300 mb-6">
            This will permanently delete all {photos.length} photos from storage. 
            This action cannot be undone.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteAllConfirm(false)}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p>Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Error Loading Gallery</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-700 transition"
            >
              Dismiss
            </button>
            <button
              onClick={loadPhotos}
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
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <ImageIcon className="w-8 h-8" style={{ color: config?.primary_color }} />
              Photo Gallery
            </h1>
            
            <div className="flex items-center gap-4">
              {/* Layout indicator */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                {config?.gallery_layout === 'grid' && <Grid className="w-4 h-4" />}
                {config?.gallery_layout === 'masonry' && <Layers className="w-4 h-4" />}
                {config?.gallery_layout === 'carousel' && <List className="w-4 h-4" />}
                <span className="capitalize">{config?.gallery_layout || 'grid'}</span>
              </div>

              {/* Admin toggle */}
              <button
                onClick={() => setShowAdmin(!showAdmin)}
                className={`p-2 rounded-lg transition ${
                  showAdmin ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'
                }`}
                title="Toggle admin controls (Ctrl+Shift+A)"
              >
                {showAdmin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              
              {/* Admin status indicator */}
              {showAdmin && (
                <div className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                  ADMIN MODE
                </div>
              )}
            </div>
          </div>

          {/* Admin Controls */}
          {showAdmin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-4 bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-300">
                    {photos.length} photos in gallery
                  </span>
                  <button
                    onClick={loadPhotos}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                
                {photos.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded hover:bg-red-700 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete All
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Gallery Content */}
      <div className="container mx-auto px-4 py-8">
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <h2 className="text-xl font-semibold mb-2">No Photos Yet</h2>
            <p className="text-gray-400">
              Photos will appear here after they're generated in the photobooth
            </p>
          </div>
        ) : (
          <>
            {/* Grid Layout */}
            {config?.gallery_layout === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {photos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow group"
                  >
                    <div className="aspect-square relative">
                      {photo.content_type === 'video' ? (
                        <video
                          src={photo.processed_url || photo.original_url}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={photo.processed_url || photo.original_url}
                          alt={photo.prompt}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                      
                      {/* Overlay controls */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <PhotoActions photo={photo} />
                      </div>
                    </div>
                    
                    {/* Photo info */}
                    <div className="p-4">
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {photo.prompt}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(photo.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Masonry Layout */}
            {config?.gallery_layout === 'masonry' && (
              <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
                {photos.map((photo, index) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow group break-inside-avoid mb-6"
                  >
                    <div className="relative">
                      {photo.content_type === 'video' ? (
                        <video
                          src={photo.processed_url || photo.original_url}
                          className="w-full h-auto object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={photo.processed_url || photo.original_url}
                          alt={photo.prompt}
                          className="w-full h-auto object-cover"
                          loading="lazy"
                        />
                      )}
                      
                      {/* Overlay controls */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <PhotoActions photo={photo} />
                      </div>
                    </div>
                    
                    {/* Photo info */}
                    <div className="p-4">
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {photo.prompt}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(photo.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Carousel Layout */}
            {config?.gallery_layout === 'carousel' && (
              <div className="max-w-4xl mx-auto">
                <div className="relative bg-gray-800 rounded-lg overflow-hidden shadow-2xl">
                  {/* Main carousel display */}
                  <div className="aspect-video relative">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={carouselIndex}
                        initial={{ opacity: 0, x: 300 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -300 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0"
                      >
                        {photos[carouselIndex]?.content_type === 'video' ? (
                          <video
                            src={photos[carouselIndex]?.processed_url || photos[carouselIndex]?.original_url}
                            className="w-full h-full object-contain bg-black"
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={photos[carouselIndex]?.processed_url || photos[carouselIndex]?.original_url}
                            alt={photos[carouselIndex]?.prompt}
                            className="w-full h-full object-contain bg-black"
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Navigation arrows */}
                    <button
                      onClick={prevSlide}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    
                    <button
                      onClick={nextSlide}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>

                    {/* Play/Pause button */}
                    <button
                      onClick={toggleCarouselPlay}
                      className="absolute top-4 right-4 p-3 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      {carouselPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>

                    {/* Photo counter */}
                    <div className="absolute top-4 left-4 px-3 py-1 bg-black bg-opacity-50 rounded-full text-sm">
                      {carouselIndex + 1} / {photos.length}
                    </div>

                    {/* Action controls overlay */}
                    <div className="absolute bottom-4 right-4">
                      <PhotoActions 
                        photo={photos[carouselIndex]} 
                        className="bg-black bg-opacity-50 rounded-lg p-2"
                      />
                    </div>
                  </div>

                  {/* Photo info */}
                  <div className="p-6 bg-gray-800">
                    <h3 className="text-lg font-semibold mb-2">
                      {photos[carouselIndex]?.prompt}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Created: {new Date(photos[carouselIndex]?.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Thumbnail strip */}
                  <div className="p-4 bg-gray-700">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {photos.map((photo, index) => (
                        <button
                          key={photo.id}
                          onClick={() => setCarouselIndex(index)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                            index === carouselIndex 
                              ? 'border-blue-500' 
                              : 'border-transparent hover:border-gray-500'
                          }`}
                        >
                          {photo.content_type === 'video' ? (
                            <video
                              src={photo.processed_url || photo.original_url}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <img
                              src={photo.processed_url || photo.original_url}
                              alt={photo.prompt}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <div className="max-w-4xl max-h-full relative" onClick={e => e.stopPropagation()}>
              {selectedPhoto.content_type === 'video' ? (
                <video
                  src={selectedPhoto.processed_url || selectedPhoto.original_url}
                  className="max-w-full max-h-full object-contain"
                  controls
                  autoPlay
                />
              ) : (
                <img
                  src={selectedPhoto.processed_url || selectedPhoto.original_url}
                  alt={selectedPhoto.prompt}
                  className="max-w-full max-h-full object-contain"
                />
              )}
              
              {/* Modal controls */}
              <div className="absolute top-4 right-4 flex gap-2">
                <PhotoActions photo={selectedPhoto} />
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Photo info overlay */}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 rounded-lg p-4 max-w-md">
                <p className="text-white text-sm mb-1">{selectedPhoto.prompt}</p>
                <p className="text-gray-300 text-xs">
                  {new Date(selectedPhoto.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modals */}
      <AnimatePresence>
        {showDeleteConfirm && <DeleteConfirmModal />}
        {showDeleteAllConfirm && <DeleteAllConfirmModal />}
      </AnimatePresence>
    </div>
  );
}