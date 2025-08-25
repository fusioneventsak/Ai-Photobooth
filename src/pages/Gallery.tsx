import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ImageIcon, 
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
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { 
  getPhotos, 
  deleteAllPhotos, 
  deletePhotoAndAllDuplicates 
} from '../lib/supabase';
import type { Photo } from '../types/supabase';

export default function Gallery() {
  const { config } = useConfigStore();
  
  // State declarations
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselPlaying, setCarouselPlaying] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [sharePageCache, setSharePageCache] = useState<Map<string, string>>(new Map());

  // Helper functions
  const getShareableUrl = useCallback((photo: Photo): string => {
    // Check if we have a cached share page URL
    if (sharePageCache.has(photo.id)) {
      return sharePageCache.get(photo.id)!;
    }
    
    // For production, you'd want to create a proper server endpoint
    // For now, we'll use a data URL approach for better social sharing
    return `${window.location.origin}/share/${photo.id}`;
  }, [sharePageCache]);

  const getDirectImageUrl = useCallback((photo: Photo): string => {
    return photo.processed_url || photo.original_url || '';
  }, []);

  const generateSharePageContent = useCallback((photo: Photo): string => {
    const imageUrl = getDirectImageUrl(photo);
    const shareUrl = `${window.location.origin}/share/${photo.id}`;
    const title = 'AI Generated Photo';
    const description = `"${photo.prompt}" - Created with AI technology`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- Essential Open Graph tags for Facebook -->
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="AI Photo Gallery" />
  
  <!-- Twitter Card tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <meta name="twitter:image:alt" content="${photo.prompt}" />
  
  <!-- LinkedIn specific -->
  <meta property="linkedin:card" content="summary_large_image" />
  
  <!-- WhatsApp and general -->
  <meta name="description" content="${description}" />
  <meta name="image" content="${imageUrl}" />
  
  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      color: white;
    }
    
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 2rem;
      max-width: 600px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .title {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 1rem;
      background: linear-gradient(45deg, #fff, #f0f0f0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .image-container {
      margin: 2rem 0;
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    
    .photo {
      width: 100%;
      height: auto;
      max-height: 400px;
      object-fit: contain;
      background: #000;
    }
    
    .prompt {
      font-size: 1.2rem;
      font-style: italic;
      margin: 1.5rem 0;
      line-height: 1.6;
      color: #f0f0f0;
    }
    
    .share-buttons {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 2rem;
    }
    
    .share-btn {
      padding: 12px 24px;
      border: none;
      border-radius: 25px;
      color: white;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
    }
    
    .share-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }
    
    .facebook { background: linear-gradient(45deg, #1877f2, #42a5f5); }
    .twitter { background: linear-gradient(45deg, #1da1f2, #42a5f5); }
    .whatsapp { background: linear-gradient(45deg, #25d366, #4caf50); }
    .linkedin { background: linear-gradient(45deg, #0077b5, #42a5f5); }
    .gallery { background: linear-gradient(45deg, #667eea, #764ba2); }
    
    .footer {
      margin-top: 2rem;
      font-size: 0.9rem;
      opacity: 0.8;
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 1.5rem;
        margin: 10px;
      }
      
      .title {
        font-size: 1.5rem;
      }
      
      .share-buttons {
        flex-direction: column;
        align-items: center;
      }
      
      .share-btn {
        width: 200px;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">🎨 AI Generated Photo</h1>
    
    <div class="image-container">
      <img src="${imageUrl}" alt="${photo.prompt}" class="photo" />
    </div>
    
    <p class="prompt">"${photo.prompt}"</p>
    
    <div class="share-buttons">
      <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" 
         class="share-btn facebook" target="_blank" rel="noopener">
        📘 Facebook
      </a>
      
      <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎨 Check out this amazing AI-generated photo: "${photo.prompt}"`)}&url=${encodeURIComponent(shareUrl)}" 
         class="share-btn twitter" target="_blank" rel="noopener">
        🐦 Twitter
      </a>
      
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}" 
         class="share-btn linkedin" target="_blank" rel="noopener">
        💼 LinkedIn
      </a>
      
      <a href="https://wa.me/?text=${encodeURIComponent(`🎨 Check out this amazing AI-generated photo: "${photo.prompt}" ${shareUrl}`)}" 
         class="share-btn whatsapp" target="_blank" rel="noopener">
        💬 WhatsApp
      </a>
      
      <a href="${window.location.origin}/gallery" 
         class="share-btn gallery">
        🖼️ View Gallery
      </a>
    </div>
    
    <div class="footer">
      <p>Created with AI • ${new Date(photo.created_at).toLocaleDateString()}</p>
    </div>
  </div>
  
  <script>
    // Auto-copy URL to clipboard on mobile
    if ('clipboard' in navigator) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    
    // Preload the main gallery
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = '${window.location.origin}/gallery';
    document.head.appendChild(link);
  </script>
</body>
</html>`;
  }, [getDirectImageUrl]);

  const createOptimizedShareUrl = useCallback((photo: Photo): Promise<string> => {
    return new Promise((resolve) => {
      // Check cache first
      if (sharePageCache.has(photo.id)) {
        resolve(sharePageCache.get(photo.id)!);
        return;
      }

      // Create a blob URL for the share page
      const htmlContent = generateSharePageContent(photo);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const shareUrl = URL.createObjectURL(blob);
      
      // Cache the URL
      setSharePageCache(prev => new Map(prev).set(photo.id, shareUrl));
      
      resolve(shareUrl);
    });
  }, [generateSharePageContent, sharePageCache]);

  // Load photos function
  const loadPhotos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const timestamp = Date.now();
      console.log(`🔄 Loading photos with cache bust: ${timestamp}`);
      
      const fetchedPhotos = await getPhotos();
      
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

  // Force refresh handler
  const handleForceRefresh = useCallback(() => {
    setForceRefresh(prev => prev + 1);
  }, []);

  // Download photo function
  const handleDownloadPhoto = useCallback(async (photo: Photo, filename?: string) => {
    try {
      setDownloading(photo.id);
      console.log('📥 Starting download for photo:', photo.id);

      const imageUrl = photo.processed_url || photo.original_url;
      if (!imageUrl) {
        throw new Error('No image URL available');
      }

      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const extension = photo.content_type === 'video' ? 'mp4' : 'jpg';
      const defaultFilename = `photo_${new Date(photo.created_at).toISOString().split('T')[0]}_${photo.id.substring(0, 8)}.${extension}`;
      link.download = filename || defaultFilename;
      
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
  }, []);

  // Social sharing functions
  const copyToClipboard = useCallback(async (text: string, photoId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(photoId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy to clipboard');
    }
  }, []);

  const shareToFacebook = useCallback(async (photo: Photo) => {
    try {
      // Create optimized share URL with proper meta tags
      const shareUrl = await createOptimizedShareUrl(photo);
      
      // Use Facebook's sharer with the optimized URL
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      
      // Open in new window
      const shareWindow = window.open(facebookUrl, 'facebook-share', 'width=600,height=400,scrollbars=yes,resizable=yes');
      
      // Focus the window if it was successfully opened
      if (shareWindow) {
        shareWindow.focus();
      }
      
      setShowShareMenu(null);
    } catch (err) {
      console.error('Failed to share to Facebook:', err);
      setError('Failed to share to Facebook');
    }
  }, [createOptimizedShareUrl]);

  const shareToTwitter = useCallback(async (photo: Photo) => {
    try {
      const shareUrl = await createOptimizedShareUrl(photo);
      const text = encodeURIComponent(`🎨 Check out this amazing AI-generated photo: "${photo.prompt}"`);
      const twitterUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`;
      
      const shareWindow = window.open(twitterUrl, 'twitter-share', 'width=600,height=400,scrollbars=yes,resizable=yes');
      if (shareWindow) {
        shareWindow.focus();
      }
      
      setShowShareMenu(null);
    } catch (err) {
      console.error('Failed to share to Twitter:', err);
      setError('Failed to share to Twitter');
    }
  }, [createOptimizedShareUrl]);

  const shareToLinkedIn = useCallback(async (photo: Photo) => {
    try {
      const shareUrl = await createOptimizedShareUrl(photo);
      const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
      
      const shareWindow = window.open(linkedinUrl, 'linkedin-share', 'width=600,height=400,scrollbars=yes,resizable=yes');
      if (shareWindow) {
        shareWindow.focus();
      }
      
      setShowShareMenu(null);
    } catch (err) {
      console.error('Failed to share to LinkedIn:', err);
      setError('Failed to share to LinkedIn');
    }
  }, [createOptimizedShareUrl]);

  const shareToWhatsApp = useCallback(async (photo: Photo) => {
    try {
      const shareUrl = await createOptimizedShareUrl(photo);
      const text = encodeURIComponent(`🎨 Check out this amazing AI-generated photo: "${photo.prompt}" ${shareUrl}`);
      const whatsappUrl = `https://wa.me/?text=${text}`;
      
      const shareWindow = window.open(whatsappUrl, 'whatsapp-share');
      if (shareWindow) {
        shareWindow.focus();
      }
      
      setShowShareMenu(null);
    } catch (err) {
      console.error('Failed to share to WhatsApp:', err);
      setError('Failed to share to WhatsApp');
    }
  }, [createOptimizedShareUrl]);

  const shareWithWebShareAPI = useCallback(async (photo: Photo) => {
    if (navigator.share) {
      try {
        const shareUrl = await createOptimizedShareUrl(photo);
        
        const shareData: ShareData = {
          title: '🎨 AI Generated Photo',
          text: `Check out this amazing AI-generated photo: "${photo.prompt}"`,
          url: shareUrl
        };

        // Try to include the actual image file for native sharing
        if (photo.content_type?.startsWith('image/')) {
          try {
            const imageUrl = getDirectImageUrl(photo);
            const response = await fetch(imageUrl);
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
  }, [createOptimizedShareUrl, getDirectImageUrl]);

  const openSharePage = useCallback(async (photo: Photo) => {
    try {
      const shareUrl = await createOptimizedShareUrl(photo);
      const shareWindow = window.open(shareUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      if (shareWindow) {
        shareWindow.focus();
        
        // Auto-close after 2 minutes
        setTimeout(() => {
          if (!shareWindow.closed) {
            shareWindow.close();
          }
        }, 120000);
      }
      
      setShowShareMenu(null);
    } catch (err) {
      console.error('Failed to open share page:', err);
      setError('Failed to open share page');
    }
  }, [createOptimizedShareUrl]);

  // Delete functions
  const handleDeletePhoto = useCallback(async (photoId: string) => {
    try {
      setDeleting(photoId);
      console.log('🗑️ Deleting photo:', photoId);
      
      await deletePhotoAndAllDuplicates(photoId);
      
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
      
      if (carouselIndex >= photos.length - 1) {
        setCarouselIndex(Math.max(0, photos.length - 2));
      }
      
      // Clean up cached share URL
      setSharePageCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(photoId);
        return newCache;
      });
      
      console.log('✅ Photo deleted successfully');
    } catch (err) {
      console.error('❌ Failed to delete photo:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
      loadPhotos();
    } finally {
      setDeleting(null);
      setShowDeleteConfirm(null);
    }
  }, [selectedPhoto, carouselIndex, photos.length, loadPhotos]);

  const handleDeletePhotoAndDuplicates = useCallback(async (photoId: string) => {
    try {
      setDeleting(photoId);
      console.log('🗑️ Deleting photo and duplicates:', photoId);
      
      const result = await deletePhotoAndAllDuplicates(photoId);
      
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
  }, [loadPhotos]);

  const handleDeleteAll = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🗑️ Deleting all photos');
      
      await deleteAllPhotos();
      
      setPhotos([]);
      setSelectedPhoto(null);
      setCarouselIndex(0);
      
      // Clear share URL cache
      setSharePageCache(new Map());
      
      console.log('✅ All photos deleted successfully');
    } catch (err) {
      console.error('❌ Failed to delete all photos:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete all photos');
      loadPhotos();
    } finally {
      setLoading(false);
      setShowDeleteAllConfirm(false);
    }
  }, [loadPhotos]);

  // Carousel functions
  const nextSlide = useCallback(() => {
    setCarouselIndex(prev => (prev + 1) % photos.length);
  }, [photos.length]);

  const prevSlide = useCallback(() => {
    setCarouselIndex(prev => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const toggleCarouselPlay = useCallback(() => {
    setCarouselPlaying(!carouselPlaying);
  }, [carouselPlaying]);

  // useEffect hooks
  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    const handleGalleryUpdate = (event: CustomEvent) => {
      console.log('🔄 Gallery update event received:', event.detail);
      setForceRefresh(prev => prev + 1);
    };

    window.addEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    
    return () => {
      window.removeEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    };
  }, []);

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
  }, [showAdmin, debugMode, handleForceRefresh]);

  useEffect(() => {
    if (config?.gallery_layout === 'carousel' && carouselPlaying && photos.length > 1) {
      const interval = setInterval(() => {
        setCarouselIndex(prev => (prev + 1) % photos.length);
      }, config.gallery_speed || 3000);
      
      return () => clearInterval(interval);
    }
  }, [config?.gallery_layout, config?.gallery_speed, carouselPlaying, photos.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showShareMenu) {
        const target = event.target as Element;
        if (!target.closest('.share-menu') && !target.closest('.share-button')) {
          setShowShareMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareMenu]);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      sharePageCache.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [sharePageCache]);

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

      <div className="relative">
        <button
          onClick={() => setShowShareMenu(showShareMenu === photo.id ? null : photo.id)}
          className="share-button p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition"
          title="Share photo"
        >
          <Share2 className="w-5 h-5" />
        </button>

        {showShareMenu === photo.id && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            className="share-menu absolute left-0 top-full mt-2 bg-gray-900 rounded-lg shadow-2xl border-2 border-gray-600 p-1 w-72 z-30"
            style={{ 
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              maxHeight: '380px',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: '#4B5563 #1F2937'
            }}
          >
            <div className="max-h-full">
              {navigator.share && (
                <>
                  <button
                    onClick={() => shareWithWebShareAPI(photo)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-gray-700 rounded-lg transition"
                  >
                    <Share2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-left">Share with apps...</span>
                  </button>
                  <div className="border-t border-gray-700 my-1"></div>
                </>
              )}

              <button
                onClick={() => openSharePage(photo)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                <span className="text-left">Open share page</span>
              </button>

              <button
                onClick={() => copyToClipboard(getShareableUrl(photo), photo.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                {copySuccess === photo.id ? (
                  <>
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span className="text-green-400 text-left">Copied!</span>
                  </>
                ) : (
                  <>
                    <Link className="w-4 h-4 flex-shrink-0" />
                    <span className="text-left">Copy link</span>
                  </>
                )}
              </button>

              <div className="border-t border-gray-700 my-1"></div>

              <button
                onClick={() => shareToFacebook(photo)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-blue-600/20 rounded-lg transition"
              >
                <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">f</span>
                </div>
                <span className="text-left">Share on Facebook</span>
              </button>

              <button
                onClick={() => shareToTwitter(photo)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-blue-400/20 rounded-lg transition"
              >
                <div className="w-4 h-4 bg-blue-400 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">𝕏</span>
                </div>
                <span className="text-left">Share on Twitter / X</span>
              </button>

              <button
                onClick={() => shareToLinkedIn(photo)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-blue-700/20 rounded-lg transition"
              >
                <div className="w-4 h-4 bg-blue-700 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">in</span>
                </div>
                <span className="text-left">Share on LinkedIn</span>
              </button>

              <button
                onClick={() => shareToWhatsApp(photo)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:text-white hover:bg-green-600/20 rounded-lg transition"
              >
                <MessageCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-left">Share on WhatsApp</span>
              </button>

              <div className="border-t border-gray-700 my-1"></div>
              
              <div className="px-4 py-2">
                <p className="text-xs text-gray-500 text-center">
                  Optimized for social media previews
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
      
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
              <div className="flex items-center gap-2 text-sm text-gray-400">
                {config?.gallery_layout === 'grid' && <Grid className="w-4 h-4" />}
                {config?.gallery_layout === 'masonry' && <Layers className="w-4 h-4" />}
                {config?.gallery_layout === 'carousel' && <List className="w-4 h-4" />}
                <span className="capitalize">{config?.gallery_layout || 'grid'}</span>
              </div>

              <button
                onClick={() => setShowAdmin(!showAdmin)}
                className={`p-2 rounded-lg transition ${
                  showAdmin ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'
                }`}
                title="Toggle admin controls (Ctrl+Shift+A)"
              >
                {showAdmin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
              
              {showAdmin && (
                <div className="px-2 py-1 bg-blue-600 text-white text-xs rounded">
                  ADMIN MODE
                </div>
              )}
            </div>
          </div>

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
                      
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <PhotoActions photo={photo} />
                      </div>
                    </div>
                    
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
                      
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <PhotoActions photo={photo} />
                      </div>
                    </div>
                    
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

                    <button
                      onClick={toggleCarouselPlay}
                      className="absolute top-4 right-4 p-3 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                    >
                      {carouselPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>

                    <div className="absolute top-4 left-4 px-3 py-1 bg-black bg-opacity-50 rounded-full text-sm">
                      {carouselIndex + 1} / {photos.length}
                    </div>

                    <div className="absolute bottom-4 right-4">
                      <PhotoActions 
                        photo={photos[carouselIndex]} 
                        className="bg-black bg-opacity-50 rounded-lg p-2"
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-gray-800">
                    <h3 className="text-lg font-semibold mb-2">
                      {photos[carouselIndex]?.prompt}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Created: {new Date(photos[carouselIndex]?.created_at).toLocaleString()}
                    </p>
                  </div>

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
              
              <div className="absolute top-4 right-4 flex gap-2">
                <PhotoActions photo={selectedPhoto} />
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

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