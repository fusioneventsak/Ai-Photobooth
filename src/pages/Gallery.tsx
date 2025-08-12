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
  Maximize2,
  Minimize2,
  Settings,
  Eye,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Columns,
  RotateCcw,
  Heart,
  Share2
} from 'lucide-react';

type ViewMode = 'grid' | 'masonry' | 'slideshow';
type GridSize = 'small' | 'medium' | 'large';

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
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showAdminControls, setShowAdminControls] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [gridSize, setGridSize] = React.useState<GridSize>('medium');
  const [hoveredPhoto, setHoveredPhoto] = React.useState<string | null>(null);

  // Check if user is admin (you can implement your own logic here)
  const isAdmin = React.useMemo(() => {
    // For now, show admin controls if user presses a key combination or config allows
    return showAdminControls;
  }, [showAdminControls]);

  const loadPhotos = async (showLoading = true, source = 'manual') => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      console.log(`Loading gallery photos (${source})`);
      
      const fetchedPhotos = await getPublicPhotos();
      
      // Filter for public photos only in public mode
      const publicPhotos = isAdmin ? fetchedPhotos : fetchedPhotos.filter(photo => photo.public !== false);
      
      const sortedPhotos = publicPhotos.sort((a, b) => 
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

  const handleDeletePhoto = async (photoId: string) => {
    if (!isAdmin) return;
    
    setDeleting(true);
    
    try {
      console.log('Deleting photo:', photoId);
      
      const success = await deletePhoto(photoId);
      
      if (success) {
        console.log('Photo deleted successfully');
        setPhotos(prevPhotos => prevPhotos.filter(photo => photo.id !== photoId));
        setTimeout(() => loadPhotos(false, 'delete-refresh'), 500);
        setShowDeleteConfirm(null);
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

  const handleDeleteAllPhotos = async () => {
    if (!isAdmin) return;
    
    setDeleting(true);
    
    try {
      console.log('Deleting all photos...');
      
      const success = await deleteAllPhotos();
      
      if (success) {
        console.log('All photos deleted successfully');
        setPhotos([]);
        setShowDeleteAllConfirm(false);
        setTimeout(() => loadPhotos(false, 'delete-all-refresh'), 500);
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

  const downloadImage = async (photo: Photo) => {
    try {
      const imageUrl = photo.processed_url || photo.original_url;
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${config?.brand_name || 'Gallery'}_${photo.id.substring(0, 8)}.${photo.content_type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  };

  const shareImage = async (photo: Photo) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: photo.prompt || 'AI Generated Image',
          text: photo.prompt || 'Check out this AI generated image!',
          url: photo.processed_url || photo.original_url
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(photo.processed_url || photo.original_url);
        alert('Image URL copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy URL:', error);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!selectedPhoto) return;
    
    const currentIdx = photos.findIndex(p => p.id === selectedPhoto.id);
    let newIndex = currentIdx;
    
    if (direction === 'prev') {
      newIndex = currentIdx > 0 ? currentIdx - 1 : photos.length - 1;
    } else {
      newIndex = currentIdx < photos.length - 1 ? currentIdx + 1 : 0;
    }
    
    setSelectedPhoto(photos[newIndex]);
    setCurrentIndex(newIndex);
  };

  React.useEffect(() => {
    loadPhotos(true, 'initial');
  }, []);

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

  // Auto-refresh every 30 seconds instead of 5 for public gallery
  React.useEffect(() => {
    const interval = setInterval(() => {
      loadPhotos(false, 'auto-refresh');
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Admin toggle (Ctrl/Cmd + Shift + A)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        setShowAdminControls(!showAdminControls);
        return;
      }
      
      if (showPhotoModal && selectedPhoto) {
        if (e.key === 'Escape') {
          setShowPhotoModal(false);
        } else if (e.key === 'ArrowLeft') {
          navigatePhoto('prev');
        } else if (e.key === 'ArrowRight') {
          navigatePhoto('next');
        } else if (e.key === 'f' || e.key === 'F') {
          toggleFullscreen();
        } else if (e.key === 'd' || e.key === 'D') {
          downloadImage(selectedPhoto);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showPhotoModal, selectedPhoto, showAdminControls]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGridCols = () => {
    switch (gridSize) {
      case 'small': return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8';
      case 'medium': return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      case 'large': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      default: return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
              <h2 className="text-2xl font-light mb-2">Loading Gallery</h2>
              <p className="text-gray-400">Discovering beautiful moments...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-20">
            <div className="text-red-500 mb-4 text-6xl">⚠️</div>
            <h2 className="text-2xl font-light mb-4">Unable to Load Gallery</h2>
            <p className="text-gray-400 mb-8">{error}</p>
            <button
              onClick={() => {
                setError(null);
                loadPhotos(true, 'retry');
              }}
              className="px-6 py-3 bg-blue-600 rounded-full hover:bg-blue-700 transition-all duration-200 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {newPhotoAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2"
          >
            <Bell className="w-5 h-5" />
            <span>New artwork added!</span>
          </motion.div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-light mb-4 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
          >
            {config?.brand_name || 'AI'} Gallery
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-300 font-light"
          >
            Discover the magic of AI-generated art
          </motion.p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-2">
            {/* View Mode Controls */}
            <div className="flex bg-gray-800/50 rounded-full p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-full transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Grid View"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('masonry')}
                className={`p-2 rounded-full transition-all ${viewMode === 'masonry' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                title="Masonry View"
              >
                <Columns className="w-4 h-4" />
              </button>
            </div>

            {/* Grid Size Controls */}
            {viewMode === 'grid' && (
              <div className="flex bg-gray-800/50 rounded-full p-1">
                {(['small', 'medium', 'large'] as GridSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setGridSize(size)}
                    className={`px-3 py-1 rounded-full text-sm transition-all capitalize ${gridSize === size ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Stats */}
            <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span>{photos.filter(p => !p.content_type || p.content_type === 'image').length} Images</span>
              </div>
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span>{photos.filter(p => p.content_type === 'video' || p.content_type === 'mp4').length} Videos</span>
              </div>
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadPhotos(true, 'force-refresh')}
                  disabled={deleting}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700/50 rounded-full hover:bg-gray-600/50 transition text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${deleting ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                
                {photos.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    disabled={deleting}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600/20 border border-red-600/30 rounded-full hover:bg-red-600/30 transition text-sm disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete All
                  </button>
                )}
              </div>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-gray-700/50 rounded-full hover:bg-gray-600/50 transition"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Gallery Content */}
        {photos.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
              <ImageIcon className="w-16 h-16 text-gray-500" />
            </div>
            <h2 className="text-3xl font-light mb-4 text-gray-300">No Artwork Yet</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              The gallery is waiting for its first masterpiece. Visit the photobooth to create some AI magic!
            </p>
            <button
              onClick={() => loadPhotos(true, 'force-refresh')}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium"
            >
              Check for New Art
            </button>
          </motion.div>
        ) : (
          <motion.div 
            layout
            className={`${viewMode === 'grid' ? `grid ${getGridCols()} gap-4` : 'columns-2 md:columns-3 lg:columns-4 gap-4'}`}
          >
            <AnimatePresence>
              {photos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`relative group cursor-pointer ${viewMode === 'masonry' ? 'break-inside-avoid mb-4' : ''}`}
                  onMouseEnter={() => setHoveredPhoto(photo.id)}
                  onMouseLeave={() => setHoveredPhoto(null)}
                  onClick={() => {
                    setSelectedPhoto(photo);
                    setCurrentIndex(index);
                    setShowPhotoModal(true);
                  }}
                >
                  {(photo.content_type === 'video' || photo.content_type === 'mp4') ? (
                    <div className="relative overflow-hidden rounded-2xl">
                      <video
                        src={photo.processed_url || photo.original_url}
                        className="w-full h-auto transition-transform duration-300 group-hover:scale-105"
                        poster={photo.thumbnail_url}
                        muted
                        onMouseEnter={(e) => e.currentTarget.play()}
                        onMouseLeave={(e) => e.currentTarget.pause()}
                      />
                      
                      {/* Video Badge */}
                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Video className="w-3 h-3" />
                        Video
                      </div>
                    </div>
                  ) : (
                    <div className="relative overflow-hidden rounded-2xl">
                      <img
                        src={photo.processed_url || photo.original_url}
                        alt={photo.prompt || 'AI Generated Art'}
                        className="w-full h-auto transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          if (img.src !== photo.original_url && photo.original_url) {
                            img.src = photo.original_url;
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Hover Overlay */}
                  <AnimatePresence>
                    {hoveredPhoto === photo.id && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent rounded-2xl"
                      >
                        {/* Action Buttons */}
                        <div className="absolute top-3 right-3 flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(photo);
                            }}
                            className="p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all"
                            title="Download"
                          >
                            <Download className="w-4 h-4 text-white" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              shareImage(photo);
                            }}
                            className="p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all"
                            title="Share"
                          >
                            <Share2 className="w-4 h-4 text-white" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(photo.id);
                              }}
                              className="p-2 bg-red-500/20 backdrop-blur-sm rounded-full hover:bg-red-500/30 transition-all"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-white" />
                            </button>
                          )}
                        </div>

                        {/* Content Info */}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          {photo.prompt && (
                            <p className="text-white text-sm font-medium mb-2 line-clamp-2">
                              {photo.prompt}
                            </p>
                          )}
                          <div className="flex justify-between items-center text-xs text-gray-300">
                            <span>{formatDate(photo.created_at)}</span>
                            <div className="flex items-center gap-2">
                              <Eye className="w-3 h-3" />
                              <span>Click to view</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Photo Modal */}
        <AnimatePresence>
          {showPhotoModal && selectedPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowPhotoModal(false)}
            >
              <div className="relative max-w-7xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
                {/* Close Button */}
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="absolute -top-12 right-0 text-white/70 hover:text-white transition z-10"
                >
                  <X className="w-8 h-8" />
                </button>

                {/* Navigation Buttons */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => navigatePhoto('prev')}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition z-10"
                    >
                      <ChevronLeft className="w-6 h-6 text-white" />
                    </button>
                    <button
                      onClick={() => navigatePhoto('next')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition z-10"
                    >
                      <ChevronRight className="w-6 h-6 text-white" />
                    </button>
                  </>
                )}

                {/* Action Buttons */}
                <div className="absolute top-4 right-4 flex gap-2 z-10">
                  <button
                    onClick={() => downloadImage(selectedPhoto)}
                    className="p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition"
                    title="Download (D)"
                  >
                    <Download className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={() => shareImage(selectedPhoto)}
                    className="p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition"
                    title="Share"
                  >
                    <Share2 className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="p-3 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition"
                    title="Fullscreen (F)"
                  >
                    {isFullscreen ? <Minimize2 className="w-5 h-5 text-white" /> : <Maximize2 className="w-5 h-5 text-white" />}
                  </button>
                </div>

                {/* Media Content */}
                <motion.div
                  key={selectedPhoto.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center"
                >
                  {selectedPhoto.content_type === 'video' ? (
                    <video
                      src={selectedPhoto.processed_url || selectedPhoto.original_url}
                      className="max-w-full max-h-[70vh] rounded-lg shadow-2xl"
                      controls
                      autoPlay
                    />
                  ) : (
                    <img
                      src={selectedPhoto.processed_url || selectedPhoto.original_url}
                      alt={selectedPhoto.prompt || 'AI Generated Art'}
                      className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain"
                    />
                  )}

                  {/* Photo Info */}
                  <div className="mt-6 max-w-2xl text-center">
                    {selectedPhoto.prompt && (
                      <h3 className="text-xl font-light text-white mb-3">
                        {selectedPhoto.prompt}
                      </h3>
                    )}
                    <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-400">
                      <span>{formatDate(selectedPhoto.created_at)}</span>
                      <span>•</span>
                      <span>{currentIndex + 1} of {photos.length}</span>
                      {isAdmin && (
                        <>
                          <span>•</span>
                          <span>ID: {selectedPhoto.id.substring(0, 8)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Keyboard Shortcuts Hint */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500 flex gap-4">
                  <span>← → Navigate</span>
                  <span>F Fullscreen</span>
                  <span>D Download</span>
                  <span>ESC Close</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modals */}
        {showDeleteConfirm && isAdmin && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800 rounded-2xl p-6 max-w-md w-full"
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

        {showDeleteAllConfirm && isAdmin && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteAllConfirm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gray-800 rounded-2xl p-6 max-w-md w-full"
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

        {/* Admin Controls Toggle Hint */}
        {!isAdmin && (
          <div className="fixed bottom-4 left-4 text-xs text-gray-600">
            Press Ctrl+Shift+A for admin controls
          </div>
        )}
      </div>
    </div>
  );
}