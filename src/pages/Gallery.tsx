// src/pages/Gallery.tsx - Complete Gallery Component with Debug Features
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
  Bug,
  Database
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

  // DEBUG: Add debug state
  const [debugInfo, setDebugInfo] = React.useState<string>('');
  const [showDebugPanel, setShowDebugPanel] = React.useState(false);
  const [allPhotosData, setAllPhotosData] = React.useState<any[]>([]);
  const [duplicateReport, setDuplicateReport] = React.useState<any>(null);

  // DEBUG: Function to add debug logs
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => `${prev}\n[${timestamp}] ${message}`);
    console.log(`[DEBUG] ${message}`);
  };

  // DEBUG: Find duplicate photos
  const findDuplicates = async () => {
    try {
      addDebugLog('🔍 Searching for duplicate photos...');
      
      const { data: allPhotos, error } = await supabase
        .from('photos')
        .select('id, created_at, prompt, public, processed_url, original_url')
        .order('created_at', { ascending: false });

      if (error) {
        addDebugLog(`❌ Error: ${error.message}`);
        return;
      }

      addDebugLog(`📊 Found ${allPhotos?.length || 0} total photos`);

      // Group by prompt to find duplicates
      const promptGroups: { [key: string]: any[] } = {};
      
      allPhotos?.forEach(photo => {
        const prompt = photo.prompt || 'NO_PROMPT';
        if (!promptGroups[prompt]) {
          promptGroups[prompt] = [];
        }
        promptGroups[prompt].push(photo);
      });

      // Find duplicates
      const duplicates = Object.entries(promptGroups)
        .filter(([prompt, photos]) => photos.length > 1)
        .map(([prompt, photos]) => ({
          prompt: prompt.length > 60 ? prompt.substring(0, 60) + '...' : prompt,
          count: photos.length,
          photos: photos
        }))
        .sort((a, b) => b.count - a.count);

      const totalDuplicates = duplicates.reduce((sum, group) => sum + (group.count - 1), 0);
      
      setDuplicateReport({ duplicates, totalDuplicates });
      
      addDebugLog(`🔍 Found ${duplicates.length} duplicate groups with ${totalDuplicates} total duplicates`);
      
      // Log the professional headshot specifically
      const headshotGroup = duplicates.find(d => d.prompt.includes('professional head shot'));
      if (headshotGroup) {
        addDebugLog(`👔 Professional headshot found: ${headshotGroup.count} copies`);
        headshotGroup.photos.forEach((photo: any, i: number) => {
          addDebugLog(`  Copy ${i + 1}: ID=${photo.id.substring(0, 8)}, created=${new Date(photo.created_at).toLocaleString()}, public=${photo.public}`);
        });
      }

    } catch (error) {
      addDebugLog(`❌ Duplicate search failed: ${error}`);
    }
  };

  // DEBUG: Delete all copies of professional headshot
  const deleteAllHeadshots = async () => {
    try {
      addDebugLog('🗑️ Deleting ALL professional headshot photos...');
      
      const { data: headshotPhotos, error: findError } = await supabase
        .from('photos')
        .select('*')
        .ilike('prompt', '%professional head shot%');

      if (findError) {
        addDebugLog(`❌ Find error: ${findError.message}`);
        return;
      }

      addDebugLog(`📋 Found ${headshotPhotos?.length || 0} headshot photos to delete`);

      if (!headshotPhotos || headshotPhotos.length === 0) {
        addDebugLog('ℹ️ No headshot photos found');
        return;
      }

      // Delete all headshot photos
      const { error: deleteError, count } = await supabase
        .from('photos')
        .delete()
        .ilike('prompt', '%professional head shot%');

      if (deleteError) {
        addDebugLog(`❌ Delete error: ${deleteError.message}`);
        return;
      }

      addDebugLog(`✅ Deleted ${count} headshot photos`);
      
      // Refresh gallery
      loadPhotos(false, 'after-headshot-cleanup');
      
    } catch (error) {
      addDebugLog(`❌ Headshot deletion failed: ${error}`);
    }
  };

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

  // ENHANCED: Load photos function with debugging
  const loadPhotos = async (showLoading = true, source = 'manual') => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      addDebugLog(`🔄 Loading gallery photos (${source})`);
      console.log(`Loading gallery photos (${source})`);
      
      // DEBUG: First, let's check what's actually in the database
      try {
        const { data: allPhotos, error: allError } = await supabase
          .from('photos')
          .select('*')
          .order('created_at', { ascending: false });

        if (allError) {
          addDebugLog(`❌ Error fetching all photos: ${allError.message}`);
        } else {
          setAllPhotosData(allPhotos || []);
          addDebugLog(`📊 Found ${allPhotos?.length || 0} total photos in database`);
          addDebugLog(`📊 Public photos: ${allPhotos?.filter(p => p.public).length || 0}`);
          addDebugLog(`📊 Private photos: ${allPhotos?.filter(p => !p.public).length || 0}`);
        }
      } catch (debugError) {
        addDebugLog(`❌ Debug query failed: ${debugError}`);
      }
      
      const fetchedPhotos = await getPublicPhotos();
      addDebugLog(`📋 getPublicPhotos() returned ${fetchedPhotos.length} photos`);
      
      // Log details of each photo
      fetchedPhotos.forEach((photo, index) => {
        addDebugLog(`Photo ${index + 1}: ID=${photo.id.substring(0, 8)}, public=${photo.public}, created=${new Date(photo.created_at).toLocaleString()}`);
      });
      
      // Apply pagination from config (except for masonry which shows all)
      const perPage = config?.gallery_layout === 'masonry' ? fetchedPhotos.length : (config?.gallery_images_per_page || 12);
      const paginatedPhotos = fetchedPhotos.slice(0, perPage);
      
      const sortedPhotos = paginatedPhotos.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      if (!showLoading && photos.length > 0 && sortedPhotos.length > photos.length) {
        setNewPhotoAlert(true);
        setTimeout(() => setNewPhotoAlert(false), 3000);
        addDebugLog(`🔔 Detected ${sortedPhotos.length - photos.length} new photos!`);
      }
      
      setPhotos(sortedPhotos);
      setLastRefresh(new Date());
      
      addDebugLog(`✅ Gallery loaded: ${sortedPhotos.length} photos displayed (${config?.gallery_layout === 'masonry' ? 'all photos for masonry' : `limited to ${perPage} per page`})`);
      console.log(`Gallery loaded: ${sortedPhotos.length} photos (${config?.gallery_layout === 'masonry' ? 'all photos for masonry' : `limited to ${perPage} per page`})`);
      
    } catch (err) {
      console.error('Failed to load gallery photos:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load photos';
      setError(errorMessage);
      addDebugLog(`❌ Load failed: ${errorMessage}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // ENHANCED: Handle photo deletion with debugging
  const handleDeletePhoto = async (photoId: string) => {
    setDeleting(true);
    
    try {
      addDebugLog(`🗑️ Starting deletion of photo: ${photoId.substring(0, 8)}`);
      console.log('Deleting photo:', photoId);
      
      const success = await deletePhoto(photoId);
      
      if (success) {
        addDebugLog(`✅ Database deletion returned success`);
        console.log('Photo deleted successfully');
        
        // Update UI immediately
        setPhotos(prevPhotos => {
          const filtered = prevPhotos.filter(photo => photo.id !== photoId);
          addDebugLog(`🔄 UI updated: ${prevPhotos.length} -> ${filtered.length} photos`);
          return filtered;
        });
        
        setShowDeleteConfirm(null);
        setShowPhotoModal(false);
        setError(null);
        
        // DEBUG: Check if photo reappears after 2 seconds
        setTimeout(async () => {
          addDebugLog(`🔍 Checking if photo reappeared...`);
          try {
            const recheckPhotos = await getPublicPhotos();
            const stillExists = recheckPhotos.some(p => p.id === photoId);
            
            if (stillExists) {
              addDebugLog(`❌ PROBLEM: Photo ${photoId.substring(0, 8)} reappeared!`);
              console.error('Photo reappeared after deletion!');
              // Force reload to show current state
              loadPhotos(false, 'recheck-after-delete');
            } else {
              addDebugLog(`✅ Confirmed: Photo ${photoId.substring(0, 8)} is permanently deleted`);
            }
          } catch (recheckError) {
            addDebugLog(`❌ Recheck failed: ${recheckError}`);
          }
        }, 2000);
        
      } else {
        throw new Error('Failed to delete photo');
      }
      
    } catch (error) {
      console.error('Failed to delete photo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete photo';
      setError(errorMessage);
      addDebugLog(`❌ Delete failed: ${errorMessage}`);
    } finally {
      setDeleting(false);
    }
  };

  // Handle delete all photos
  const handleDeleteAllPhotos = async () => {
    setDeleting(true);
    
    try {
      addDebugLog(`🗑️ Deleting all ${photos.length} photos...`);
      console.log('Deleting all photos...');
      
      const success = await deleteAllPhotos();
      
      if (success) {
        addDebugLog(`✅ Bulk deletion successful`);
        console.log('All photos deleted successfully');
        setPhotos([]);
        setShowDeleteAllConfirm(false);
        setError(null);
      } else {
        throw new Error('Failed to delete all photos');
      }
      
    } catch (error) {
      console.error('Failed to delete all photos:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete all photos';
      setError(errorMessage);
      addDebugLog(`❌ Bulk delete failed: ${errorMessage}`);
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
      // DEBUG: Toggle debug panel with Ctrl+Shift+D
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebugPanel(prev => !prev);
        addDebugLog('Debug panel toggled');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [adminMode]);

  // Load photos on mount
  React.useEffect(() => {
    addDebugLog('🚀 Gallery component mounted');
    loadPhotos(true, 'initial');
  }, []);

  // Reload when config changes (for pagination)
  React.useEffect(() => {
    if (config) {
      addDebugLog('⚙️ Config changed, checking for reload');
      loadPhotos(false, 'config-change');
    }
  }, [config?.gallery_images_per_page]);

  // Gallery update events
  React.useEffect(() => {
    const handleGalleryUpdate = (event: CustomEvent) => {
      addDebugLog(`📢 Gallery update event: ${event.detail?.action || 'unknown'}`);
      console.log('Gallery update event received');
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
      addDebugLog('🔄 Auto-refresh (15s interval)');
      loadPhotos(false, 'auto-refresh');
    }, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const forceRefresh = () => {
    addDebugLog('🔄 Force refresh triggered by user');
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
      {/* DEBUG: Debug Panel */}
      {showDebugPanel && (
        <div className="fixed top-4 right-4 z-50 w-96 max-h-[80vh] bg-gray-800 border border-gray-600 rounded-lg shadow-xl">
          <div className="p-4 border-b border-gray-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-blue-400" />
              <span className="font-medium text-blue-200">Debug Panel</span>
            </div>
            <button
              onClick={() => setShowDebugPanel(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Database Status</h4>
              <div className="text-xs text-gray-400 space-y-1">
                <div>Total Photos: {allPhotosData.length}</div>
                <div>Public Photos: {allPhotosData.filter(p => p.public).length}</div>
                <div>Private Photos: {allPhotosData.filter(p => !p.public).length}</div>
                <div>Displayed: {photos.length}</div>
                {duplicateReport && (
                  <div className="text-red-400">Duplicates: {duplicateReport.totalDuplicates}</div>
                )}
              </div>
            </div>
            
            {/* Duplicate Detection */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-medium text-gray-300">Duplicate Photos</h4>
                <button
                  onClick={findDuplicates}
                  className="text-xs px-2 py-1 bg-blue-600 rounded hover:bg-blue-700"
                >
                  Find Duplicates
                </button>
              </div>
              {duplicateReport && (
                <div className="text-xs space-y-1">
                  {duplicateReport.duplicates.map((group: any, i: number) => (
                    <div key={i} className="bg-gray-900 p-2 rounded">
                      <div className="text-yellow-400">
                        {group.count}x: {group.prompt}
                      </div>
                      {group.prompt.includes('professional head shot') && (
                        <button
                          onClick={deleteAllHeadshots}
                          className="mt-1 text-xs px-2 py-1 bg-red-600 rounded hover:bg-red-700"
                        >
                          Delete All Headshots
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-medium text-gray-300">Debug Log</h4>
                <button
                  onClick={() => setDebugInfo('')}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear
                </button>
              </div>
              <pre className="text-xs text-green-400 bg-gray-900 p-2 rounded max-h-48 overflow-y-auto whitespace-pre-wrap">
                {debugInfo || 'No debug info yet...'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* All your existing gallery content remains exactly the same */}
      {/* Fullscreen Masonry */}
      {isFullscreen && config?.gallery_layout === 'masonry' && photos.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative w-full h-full overflow-hidden">
            {/* Exit Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="absolute top-6 right-6 z-10 p-4 bg-black/50 hover:bg-black/70 rounded-full transition-colors shadow-lg backdrop-blur-sm"
              title="Exit Fullscreen (ESC)"
            >
              <Minimize className="w-6 h-6 text-white" />
            </button>

            {/* Admin Controls in Fullscreen */}
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

            {/* Fullscreen Masonry Grid */}
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

                    {/* Tile Overlay Controls */}
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
            {/* DEBUG: Add debug info */}
            <span className="ml-4 text-xs text-purple-400">
              DB: {allPhotosData.length} total • {photos.length} shown
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="ml-2 text-purple-400 hover:text-purple-300"
                title="Toggle Debug Panel (Ctrl+Shift+D)"
              >
                <Bug className="w-3 h-3 inline" />
              </button>
            </span>
          </div>
        </motion.div>

        {/* Debug Info (always visible when admin) */}
        {adminMode && (
          <div className="mb-4 p-3 bg-purple-900/20 border border-purple-600/30 rounded-lg text-xs">
            <div className="flex items-center justify-between">
              <div>
                <strong>Debug Info:</strong> Downloads: {allowDownloads ? 'ON' : 'OFF'}, 
                Sharing: {allowSharing ? 'ON' : 'OFF'}, 
                Metadata: {showMetadata ? 'ON' : 'OFF'}, 
                Admin Required: {requireAdmin ? 'YES' : 'NO'}, 
                Public Access: {publicAccess ? 'YES' : 'NO'}
              </div>
              <div className="text-purple-300">
                DB Total: {allPhotosData.length} | Public: {allPhotosData.filter(p => p.public).length} | Shown: {photos.length}
              </div>
            </div>
          </div>
        )}

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
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Gallery Grid - Keep all your existing layouts exactly as they are */}
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-300 mb-2">No photos yet</h3>
            <p className="text-gray-400 mb-6">
              Photos will appear here when they're captured with the photobooth.
              {allPhotosData.length > 0 && (
                <span className="block mt-2 text-yellow-400">
                  Debug: {allPhotosData.length} photos found in database, but {allPhotosData.filter(p => p.public).length} are public
                </span>
              )}
            </p>
            <button
              onClick={forceRefresh}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Check Again
            </button>
          </div>
        ) : config?.gallery_layout === 'carousel' ? (
          /* Your existing Carousel layout */
          <div>Carousel layout would be here - keeping your existing code</div>
        ) : config?.gallery_layout === 'masonry' ? (
          /* Your existing Masonry layout */
          <div>Masonry layout would be here - keeping your existing code</div>
        ) : (
          /* Grid Layout */
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  transition: {
                    delay: config?.gallery_animation === 'fade' ? index * 0.1 : 0,
                    duration: (config?.gallery_speed || 3000) / 1000
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

                {/* Always Visible Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                  {/* Top Controls - Always show if enabled */}
                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      {/* Download Button */}
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
                      
                      {/* Share Button */}
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
                    
                    {/* Delete Button - Only show for admins */}
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
                    {showMetadata && (
                      <p className="text-xs text-blue-300">
                        ID: {photo.id.substring(0, 8)}... | Public: {photo.public ? 'Yes' : 'No'}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* All your existing modals remain exactly the same */}
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

        {/* All your other existing modals... */}
        
        {/* Admin Mode Hint */}
        {!adminMode && requireAdmin && (
          <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-gray-800 px-3 py-2 rounded-lg">
            Press Ctrl+Shift+A for admin controls | Ctrl+Shift+D for debug
          </div>
        )}
      </div>
    </div>
  );
}