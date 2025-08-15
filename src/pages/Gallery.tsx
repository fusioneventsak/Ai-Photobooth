// src/pages/Gallery.tsx - Complete Gallery Component with Enhanced Persistence
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfigStore } from '../store/configStore';
import { 
  getPublicPhotos, 
  deletePhoto, 
  deleteAllPhotos, 
  subscribeToPhotoUpdates,
  getPhotoCount 
} from '../lib/supabase';
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
  Copy,
  Eye,
  Settings,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Circle,
  Dot,
  Maximize,
  Minimize,
  Escape,
  Database,
  Wifi,
  WifiOff
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
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [isCarouselAutoplay, setIsCarouselAutoplay] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [masonryPhotoOrder, setMasonryPhotoOrder] = React.useState<number[]>([]);
  const [masonryGridSize, setMasonryGridSize] = React.useState({ rows: 6, cols: 8 });
  
  // Enhanced persistence states
  const [totalPhotoCount, setTotalPhotoCount] = React.useState(0);
  const [isConnected, setIsConnected] = React.useState(true);
  const [retryCount, setRetryCount] = React.useState(0);
  const [lastSyncTime, setLastSyncTime] = React.useState<Date | null>(null);

  // Debug log for config
  React.useEffect(() => {
    console.log('Gallery Config:', {
      gallery_allow_downloads: config?.gallery_allow_downloads,
      gallery_social_sharing: config?.gallery_social_sharing,
      gallery_show_metadata: config?.gallery_show_metadata,
      gallery_require_admin: config?.gallery_require_admin,
      gallery_public_access: config?.gallery_public_access,
      config: config
    });
  }, [config]);

  // Load photos with enhanced persistence and error handling
  const loadPhotos = React.useCallback(async (showLoading = true, source = 'manual') => {
    try {
      if (showLoading && photos.length === 0) setLoading(true);
      setError(null);
      setIsConnected(true);
      
      console.log(`🔄 Loading gallery photos (${source})...`);
      
      // Fetch all public photos from database
      const fetchedPhotos = await getPublicPhotos();
      
      // Apply pagination from config (except for masonry which shows all)
      const perPage = config?.gallery_layout === 'masonry' 
        ? fetchedPhotos.length 
        : (config?.gallery_images_per_page || 12);
      const paginatedPhotos = fetchedPhotos.slice(0, perPage);
      
      // Sort by creation date (newest first)
      const sortedPhotos = paginatedPhotos.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      // Check for new photos and show alert
      if (!showLoading && photos.length > 0 && sortedPhotos.length > photos.length) {
        const newCount = sortedPhotos.length - photos.length;
        console.log(`🔔 Detected ${newCount} new photos!`);
        setNewPhotoAlert(true);
        setTimeout(() => setNewPhotoAlert(false), 4000);
      }
      
      // Update state
      setPhotos(sortedPhotos);
      setLastRefresh(new Date());
      setLastSyncTime(new Date());
      setRetryCount(0);
      
      // Get total count for stats
      try {
        const totalCount = await getPhotoCount();
        setTotalPhotoCount(totalCount);
      } catch (countError) {
        console.warn('Could not get photo count:', countError);
        setTotalPhotoCount(sortedPhotos.length);
      }
      
      console.log('✅ Gallery loaded successfully:', {
        displayedPhotos: sortedPhotos.length,
        totalPhotos: totalPhotoCount,
        layout: config?.gallery_layout,
        source
      });
      
    } catch (err) {
      console.error('❌ Failed to load gallery photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load photos');
      setIsConnected(false);
      setRetryCount(prev => prev + 1);
      
      // Don't clear existing photos on error - preserve what we have
      if (photos.length === 0) {
        setPhotos([]);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [photos.length, config?.gallery_layout, config?.gallery_images_per_page, totalPhotoCount]);

  // Enhanced photo deletion with immediate UI updates
  const handleDeletePhoto = async (photoId: string) => {
    if (!photoId) return;
    
    setDeleting(true);
    
    try {
      console.log('🗑️ Deleting photo:', photoId);
      
      // Optimistically update UI first
      setPhotos(prevPhotos => prevPhotos.filter(photo => photo.id !== photoId));
      setTotalPhotoCount(prev => Math.max(0, prev - 1));
      
      // Then perform actual deletion
      const success = await deletePhoto(photoId);
      
      if (success) {
        console.log('✅ Photo deleted successfully');
        setShowDeleteConfirm(null);
        setShowPhotoModal(false);
        setError(null);
      } else {
        throw new Error('Failed to delete photo');
      }
      
    } catch (error) {
      console.error('❌ Failed to delete photo:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete photo');
      
      // Reload to restore correct state on error
      loadPhotos(false, 'delete-error-recovery');
    } finally {
      setDeleting(false);
    }
  };

  // Enhanced delete all with progress feedback
  const handleDeleteAllPhotos = async () => {
    setDeleting(true);
    
    try {
      console.log('🗑️ Deleting all photos...');
      
      const photoCount = photos.length;
      
      // Optimistically clear UI
      setPhotos([]);
      setTotalPhotoCount(0);
      
      const success = await deleteAllPhotos();
      
      if (success) {
        console.log(`✅ All ${photoCount} photos deleted successfully`);
        setShowDeleteAllConfirm(false);
        setError(null);
      } else {
        throw new Error('Failed to delete all photos');
      }
      
    } catch (error) {
      console.error('❌ Failed to delete all photos:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete all photos');
      
      // Reload to restore correct state on error
      loadPhotos(false, 'delete-all-error-recovery');
    } finally {
      setDeleting(false);
    }
  };

  // Download photo function
  const downloadPhoto = async (photo: Photo) => {
    try {
      const url = photo.processed_url || photo.original_url;
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `photobooth-${photo.id.substring(0, 8)}.${photo.content_type === 'video' ? 'mp4' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to download photo:', error);
      setError('Failed to download photo');
    }
  };

  // Social sharing functions
  const shareToFacebook = (photo: Photo) => {
    const url = encodeURIComponent(photo.processed_url || photo.original_url);
    const text = encodeURIComponent(`Check out this amazing ${photo.content_type} from ${config?.brand_name || 'Virtual Photobooth'}!`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'width=600,height=400');
  };

  const shareToTwitter = (photo: Photo) => {
    const url = encodeURIComponent(photo.processed_url || photo.original_url);
    const text = encodeURIComponent(`Amazing ${photo.content_type} from ${config?.brand_name || 'Virtual Photobooth'}! 📸✨`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=400');
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

  // Carousel controls
  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % photos.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Auto-play carousel
  React.useEffect(() => {
    if (config?.gallery_layout === 'carousel' && isCarouselAutoplay && photos.length > 1) {
      const interval = setInterval(() => {
        nextSlide();
      }, config.gallery_speed || 3000);

      return () => clearInterval(interval);
    }
  }, [config?.gallery_layout, config?.gallery_speed, isCarouselAutoplay, photos.length, currentSlide]);

  // Reset carousel when photos change
  React.useEffect(() => {
    if (photos.length > 0 && currentSlide >= photos.length) {
      setCurrentSlide(0);
    }
  }, [photos.length, currentSlide]);

  // Fullscreen functionality
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Escape key to exit fullscreen
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullscreen]);

  // Prevent body scroll when in fullscreen
  React.useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isFullscreen]);

  // Initialize masonry photo order
  React.useEffect(() => {
    if (config?.gallery_layout === 'masonry' && photos.length > 0) {
      const totalTiles = masonryGridSize.rows * masonryGridSize.cols;
      const photoIndices = Array.from({ length: totalTiles }, (_, i) => i % photos.length);
      setMasonryPhotoOrder(photoIndices);
    }
  }, [photos.length, config?.gallery_layout, masonryGridSize]);

  // Shuffle masonry tiles based on animation speed
  React.useEffect(() => {
    if (config?.gallery_layout === 'masonry' && photos.length > 0 && masonryPhotoOrder.length > 0) {
      const interval = setInterval(() => {
        setMasonryPhotoOrder(prev => {
          const newOrder = [...prev];
          // Shuffle algorithm - randomly swap tiles
          for (let i = newOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
          }
          return newOrder;
        });
      }, config.gallery_speed || 3000);

      return () => clearInterval(interval);
    }
  }, [config?.gallery_layout, config?.gallery_speed, photos.length, masonryPhotoOrder.length]);

  // Update grid size based on screen size
  React.useEffect(() => {
    const updateGridSize = () => {
      const aspectRatio = window.innerWidth / window.innerHeight;
      if (aspectRatio >= 16/9) {
        // Wide screen - more columns
        setMasonryGridSize({ rows: 6, cols: 10 });
      } else if (aspectRatio >= 4/3) {
        // Standard widescreen
        setMasonryGridSize({ rows: 6, cols: 8 });
      } else {
        // Tall screen - more rows
        setMasonryGridSize({ rows: 8, cols: 6 });
      }
    };

    updateGridSize();
    window.addEventListener('resize', updateGridSize);
    return () => window.removeEventListener('resize', updateGridSize);
  }, []);

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

  // ENHANCED: Initial load with retry logic
  React.useEffect(() => {
    console.log('🚀 Gallery component mounted - starting enhanced load...');
    loadPhotos(true, 'initial-mount');
  }, []);

  // ENHANCED: Real-time subscription for live updates
  React.useEffect(() => {
    console.log('📡 Setting up real-time photo subscription...');
    
    let unsubscribe: (() => void) | null = null;
    
    try {
      unsubscribe = subscribeToPhotoUpdates((payload) => {
        console.log('🔔 Real-time update received:', payload.eventType);
        
        if (payload.eventType === 'INSERT' && payload.new) {
          // New photo added
          setPhotos(prevPhotos => {
            const exists = prevPhotos.some(p => p.id === payload.new.id);
            if (!exists) {
              console.log('➕ Adding new photo from real-time update');
              const newPhotos = [payload.new, ...prevPhotos];
              setTotalPhotoCount(prev => prev + 1);
              setNewPhotoAlert(true);
              setTimeout(() => setNewPhotoAlert(false), 4000);
              return newPhotos;
            }
            return prevPhotos;
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          // Photo deleted
          setPhotos(prevPhotos => {
            const filtered = prevPhotos.filter(p => p.id !== payload.old.id);
            if (filtered.length !== prevPhotos.length) {
              console.log('➖ Removing deleted photo from real-time update');
              setTotalPhotoCount(prev => Math.max(0, prev - 1));
            }
            return filtered;
          });
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          // Photo updated
          setPhotos(prevPhotos => {
            return prevPhotos.map(p => 
              p.id === payload.new.id ? payload.new : p
            );
          });
        }
      });
    } catch (error) {
      console.warn('Failed to set up real-time subscription:', error);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // ENHANCED: Listen for custom gallery update events (from photobooth)
  React.useEffect(() => {
    const handleGalleryUpdate = (event: CustomEvent) => {
      console.log('📢 Gallery update event received:', event.detail);
      
      if (event.detail?.action === 'create' && event.detail?.newPhoto) {
        // New photo from photobooth
        setPhotos(prevPhotos => {
          const exists = prevPhotos.some(p => p.id === event.detail.newPhoto.id);
          if (!exists) {
            console.log('➕ Adding new photo from photobooth event');
            const newPhotos = [event.detail.newPhoto, ...prevPhotos];
            setTotalPhotoCount(prev => prev + 1);
            setNewPhotoAlert(true);
            setTimeout(() => setNewPhotoAlert(false), 4000);
            return newPhotos;
          }
          return prevPhotos;
        });
      } else {
        // General refresh request
        setTimeout(() => loadPhotos(false, 'custom-event'), 500);
      }
    };

    window.addEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    
    return () => {
      window.removeEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    };
  }, [loadPhotos]);

  // ENHANCED: Cross-tab synchronization
  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'galleryRefresh') {
        console.log('💾 Cross-tab gallery refresh triggered');
        loadPhotos(false, 'cross-tab-sync');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadPhotos]);

  // ENHANCED: Auto-refresh with connection monitoring
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Auto-refresh triggered (visible tab)');
        loadPhotos(false, 'auto-refresh');
      }
    }, 30000); // Refresh every 30 seconds when tab is visible

    return () => clearInterval(interval);
  }, [loadPhotos]);

  // ENHANCED: Retry failed connections
  React.useEffect(() => {
    if (!isConnected && retryCount < 5) {
      const timeout = setTimeout(() => {
        console.log(`🔄 Retrying connection (attempt ${retryCount + 1}/5)`);
        loadPhotos(false, `retry-${retryCount + 1}`);
      }, Math.min(1000 * Math.pow(2, retryCount), 10000)); // Exponential backoff

      return () => clearTimeout(timeout);
    }
  }, [isConnected, retryCount, loadPhotos]);

  // ENHANCED: Reload when config changes that affect display
  React.useEffect(() => {
    if (config) {
      console.log('⚙️ Config changed, reloading gallery for new settings');
      loadPhotos(false, 'config-change');
    }
  }, [config?.gallery_images_per_page, config?.gallery_layout]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const forceRefresh = () => {
    console.log('🔄 Force refresh triggered by user');
    setRetryCount(0);
    loadPhotos(true, 'force-refresh');
  };

  // Check if features are enabled (default to true if config not loaded yet)
  const allowDownloads = config?.gallery_allow_downloads !== false;
  const allowSharing = config?.gallery_social_sharing !== false;
  const showMetadata = config?.gallery_show_metadata === true;
  const requireAdmin = config?.gallery_require_admin === true;
  const publicAccess = config?.gallery_public_access !== false;

  // Show admin controls if admin mode is on OR if admin is not required
  const showAdminControls = adminMode || !requireAdmin;

  if (loading && photos.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-3" />
            <span>Loading gallery from database...</span>
          </div>
        </div>
      </div>
    );
  }

  // Check public access
  if (!publicAccess && !adminMode) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Eye className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Gallery Access Restricted</h2>
              <p className="text-gray-400 mb-4">This gallery is currently private.</p>
              <p className="text-sm text-gray-500">Press Ctrl+Shift+A if you are an admin</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Fullscreen Components */}
      {isFullscreen && config?.gallery_layout === 'masonry' && photos.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative w-full h-full overflow-hidden">
            <button
              onClick={toggleFullscreen}
              className="absolute top-6 right-6 z-10 p-4 bg-black/50 hover:bg-black/70 rounded-full transition-colors shadow-lg backdrop-blur-sm"
              title="Exit Fullscreen (ESC)"
            >
              <Minimize className="w-6 h-6 text-white" />
            </button>

            {showAdminControls && (
              <div className="absolute top-6 left-6 z-10 flex gap-3">
                <button
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="p-4 bg-red-600/80 hover:bg-red-700 rounded-full transition-colors shadow-lg backdrop-blur-sm"
                  title="Delete All Photos"
                >
                  <Trash2 className="w-6 h-6 text-white" />
                </button>
              </div>
            )}

            <div 
              className="w-full h-full grid gap-1 p-1"
              style={{
                gridTemplateColumns: `repeat(${masonryGridSize.cols}, 1fr)`,
                gridTemplateRows: `repeat(${masonryGridSize.rows}, 1fr)`
              }}
            >
              {masonryPhotoOrder.map((photoIndex, tileIndex) => {
                const photo = photos[photoIndex];
                if (!photo) return null;

                return (
                  <motion.div
                    key={`${tileIndex}-${photoIndex}`}
                    layout
                    transition={{
                      duration: 0.8,
                      ease: "easeInOut"
                    }}
                    className="relative group bg-gray-900 overflow-hidden cursor-pointer"
                    onClick={() => {
                      setSelectedPhoto(photo);
                      setShowPhotoModal(true);
                    }}
                  >
                    {(photo.content_type === 'video' || photo.content_type === 'mp4') ? (
                      <div className="relative w-full h-full">
                        <video
                          src={photo.processed_url || photo.original_url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          poster={photo.thumbnail_url}
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="w-8 h-8 text-white opacity-80" />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={photo.processed_url || photo.original_url}
                        alt="Gallery"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          if (img.src !== photo.original_url && photo.original_url) {
                            img.src = photo.original_url;
                          }
                        }}
                      />
                    )}

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
                      <div className="flex justify-end gap-2">
                        {allowDownloads && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadPhoto(photo);
                            }}
                            className="p-2 bg-blue-600/90 hover:bg-blue-700 rounded-full transition-colors shadow-lg"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-white" />
                          </button>
                        )}
                        
                        {allowSharing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowShareModal(photo);
                            }}
                            className="p-2 bg-green-600/90 hover:bg-green-700 rounded-full transition-colors shadow-lg"
                            title="Share"
                          >
                            <Share2 className="w-4 h-4 text-white" />
                          </button>
                        )}

                        {showAdminControls && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(photo.id);
                            }}
                            className="p-2 bg-red-600/90 hover:bg-red-700 rounded-full transition-colors shadow-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                          </button>
                        )}
                      </div>

                      <div className="text-white text-xs">
                        <p className="font-medium line-clamp-2 mb-1">
                          {photo.prompt && photo.prompt.length > 40 
                            ? photo.prompt.substring(0, 40) + '...' 
                            : photo.prompt || 'No prompt'
                          }
                        </p>
                        {showMetadata && (
                          <p className="text-gray-300">
                            {photo.id.substring(0, 8)}...
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Regular Gallery Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Enhanced Header */}
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
          
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              <span>{totalPhotoCount} total photos</span>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-400" />
                  <span className="text-red-400">Reconnecting...</span>
                </>
              )}
            </div>
            <div>
              Last updated: {formatDate(lastRefresh.toISOString())}
            </div>
          </div>
        </motion.div>

        {/* Admin Controls */}
        {showAdminControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-yellow-400" />
                <span className="font-medium text-yellow-200">
                  {adminMode ? 'Admin Mode Active' : 'Gallery Controls'}
                </span>
                <span className="text-xs text-yellow-300 bg-yellow-900/30 px-2 py-1 rounded">
                  Showing {photos.length} of {totalPhotoCount} photos
                </span>
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
                    Delete All ({totalPhotoCount})
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
              <span>New photos added to gallery!</span>
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
              {!isConnected && (
                <span className="text-sm text-red-300">
                  (Retrying... {retryCount}/5)
                </span>
              )}
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Gallery Grid */}
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-300 mb-2">
              {totalPhotoCount === 0 ? 'No photos yet' : 'Loading photos...'}
            </h3>
            <p className="text-gray-400 mb-6">
              {totalPhotoCount === 0 
                ? 'Photos will appear here when they\'re captured with the photobooth.'
                : `${totalPhotoCount} photos in database. Loading display...`
              }
            </p>
            <button
              onClick={forceRefresh}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Check Again'}
            </button>
          </div>
        ) : (
          /* Grid Layout - Simple and reliable */
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  transition: {
                    delay: index * 0.1,
                    duration: 0.3
                  }
                }}
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

                {/* Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      {allowDownloads && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadPhoto(photo);
                          }}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full transition-colors shadow-lg"
                          title="Download"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </button>
                      )}
                      
                      {allowSharing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowShareModal(photo);
                          }}
                          className="p-2 bg-green-600 hover:bg-green-700 rounded-full transition-colors shadow-lg"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4 text-white" />
                        </button>
                      )}
                    </div>
                    
                    {showAdminControls && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(photo.id);
                        }}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors shadow-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>

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
                    {showMetadata && (
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

        {/* Modals */}
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
                Are you sure you want to delete <strong>all {totalPhotoCount} photos</strong>?
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
                  onClick={() => {
                    shareToFacebook(showShareModal);
                    setShowShareModal(null);
                  }}
                  className="flex items-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Facebook className="w-5 h-5" />
                  <span>Facebook</span>
                </button>
                
                <button
                  onClick={() => {
                    shareToTwitter(showShareModal);
                    setShowShareModal(null);
                  }}
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
                    {allowDownloads && (
                      <button
                        onClick={() => downloadPhoto(selectedPhoto)}
                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    {allowSharing && (
                      <button
                        onClick={() => setShowShareModal(selectedPhoto)}
                        className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        title="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    )}
                    {showAdminControls && (
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
        {!adminMode && requireAdmin && (
          <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-gray-800 px-3 py-2 rounded-lg">
            Press Ctrl+Shift+A for admin controls
          </div>
        )}
      </div>
    </div>
  );
}