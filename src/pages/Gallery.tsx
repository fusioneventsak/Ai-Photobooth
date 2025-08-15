// src/pages/Gallery.tsx - Debug Version
import React from 'react';
import { motion } from 'framer-motion';
import { useConfigStore } from '../store/configStore';
import { getPublicPhotos, deletePhoto, deleteAllPhotos, debugDatabaseConnection } from '../lib/supabase';
import type { Photo } from '../types/supabase';
import { 
  RefreshCw, 
  ImageIcon, 
  Trash2, 
  AlertTriangle,
  X,
  Download,
  Settings,
  Database,
  Search,
  Bug
} from 'lucide-react';

export default function Gallery() {
  const { config } = useConfigStore();
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [debugInfo, setDebugInfo] = React.useState<string>('');
  const [showDebugDetails, setShowDebugDetails] = React.useState(true);

  // Debug function to capture console logs
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo(prev => `${prev}\n[${timestamp}] ${message}`);
  };

  // Enhanced load photos with debugging
  const loadPhotos = async (showLoading = true, source = 'manual') => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      
      addDebugLog(`🔄 Loading photos (${source})`);
      
      const fetchedPhotos = await getPublicPhotos();
      
      addDebugLog(`📊 Raw query returned ${fetchedPhotos.length} photos`);
      
      // Log each photo's details
      fetchedPhotos.forEach((photo, index) => {
        addDebugLog(`Photo ${index + 1}: ID=${photo.id.substring(0, 8)}, public=${photo.public}, created=${photo.created_at}`);
      });
      
      // Sort by creation date (newest first)
      const sortedPhotos = fetchedPhotos.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setPhotos(sortedPhotos);
      addDebugLog(`✅ Gallery loaded: ${sortedPhotos.length} photos displayed`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load photos';
      console.error('❌ Failed to load gallery photos:', err);
      setError(errorMessage);
      addDebugLog(`❌ Load failed: ${errorMessage}`);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Enhanced delete with debugging
  const handleDeletePhoto = async (photoId: string) => {
    setDeleting(true);
    
    try {
      addDebugLog(`🗑️ Starting deletion of photo: ${photoId.substring(0, 8)}`);
      
      const success = await deletePhoto(photoId);
      
      if (success) {
        addDebugLog(`✅ Database deletion successful`);
        
        // Remove from UI immediately
        setPhotos(prevPhotos => {
          const newPhotos = prevPhotos.filter(photo => photo.id !== photoId);
          addDebugLog(`🔄 UI updated: removed photo, now showing ${newPhotos.length} photos`);
          return newPhotos;
        });
        
        // Wait a bit and check if it reappears
        setTimeout(async () => {
          addDebugLog(`🔍 Checking if photo reappeared after 2 seconds...`);
          const recheckPhotos = await getPublicPhotos();
          const stillExists = recheckPhotos.some(p => p.id === photoId);
          
          if (stillExists) {
            addDebugLog(`❌ PROBLEM: Photo ${photoId.substring(0, 8)} reappeared in database!`);
            // Reload the gallery to show current state
            loadPhotos(false, 'recheck-after-delete');
          } else {
            addDebugLog(`✅ Verified: Photo ${photoId.substring(0, 8)} is gone`);
          }
        }, 2000);
        
        setError(null);
      } else {
        throw new Error('Delete function returned false');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete photo';
      console.error('❌ Failed to delete photo:', error);
      setError(errorMessage);
      addDebugLog(`❌ Delete failed: ${errorMessage}`);
    } finally {
      setDeleting(false);
    }
  };

  // Test database connection
  const testConnection = async () => {
    addDebugLog('🔍 Testing database connection...');
    await debugDatabaseConnection();
    addDebugLog('✅ Connection test completed (check browser console for details)');
  };

  // Force refresh
  const forceRefresh = () => {
    addDebugLog('🔄 Force refresh triggered by user');
    loadPhotos(true, 'force-refresh');
  };

  // Load photos on mount
  React.useEffect(() => {
    addDebugLog('🚀 Gallery component mounted');
    loadPhotos(true, 'initial-mount');
  }, []);

  // Listen for gallery update events
  React.useEffect(() => {
    const handleGalleryUpdate = (event: CustomEvent) => {
      addDebugLog(`📢 Gallery update event: ${event.detail?.action || 'unknown'}`);
      
      if (event.detail?.newPhoto) {
        addDebugLog(`➕ New photo event: ${event.detail.newPhoto.id.substring(0, 8)}`);
        setPhotos(prevPhotos => {
          const exists = prevPhotos.some(p => p.id === event.detail.newPhoto.id);
          if (!exists) {
            return [event.detail.newPhoto, ...prevPhotos];
          }
          return prevPhotos;
        });
      } else {
        // Fallback: refresh from database
        setTimeout(() => loadPhotos(false, 'event-triggered'), 1000);
      }
    };

    window.addEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    
    return () => {
      window.removeEventListener('galleryUpdate', handleGalleryUpdate as EventListener);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-3" />
            <span>Loading gallery and debugging...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Debug Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-light mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Debug Gallery
          </h1>
          <p className="text-xl text-gray-300 font-light">
            Debugging photo persistence issues
          </p>
        </motion.div>

        {/* Debug Controls */}
        <div className="mb-8 p-4 bg-blue-900/20 border border-blue-600/30 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bug className="w-5 h-5 text-blue-400" />
              <span className="font-medium text-blue-200">Debug Controls</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={testConnection}
                className="px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                Test Connection
              </button>
              <button
                onClick={forceRefresh}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          
          {/* Debug Log */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-blue-200">Debug Log:</span>
              <button
                onClick={() => setShowDebugDetails(!showDebugDetails)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {showDebugDetails ? 'Hide' : 'Show'} Details
              </button>
              <button
                onClick={() => setDebugInfo('')}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear Log
              </button>
            </div>
            {showDebugDetails && (
              <pre className="bg-gray-800 p-3 rounded text-xs text-green-400 max-h-40 overflow-y-auto whitespace-pre-wrap">
                {debugInfo || 'No debug information yet...'}
              </pre>
            )}
          </div>
        </div>

        {/* Database Status */}
        <div className="mb-6 p-4 bg-gray-800 rounded-xl">
          <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Database Status
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Total Photos:</span>
              <span className="ml-2 font-mono text-blue-400">{photos.length}</span>
            </div>
            <div>
              <span className="text-gray-400">Connection:</span>
              <span className="ml-2 font-mono text-green-400">Active</span>
            </div>
            <div>
              <span className="text-gray-400">Loading:</span>
              <span className="ml-2 font-mono text-yellow-400">{loading ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-gray-400">Errors:</span>
              <span className="ml-2 font-mono text-red-400">{error ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

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

        {/* Photos Grid */}
        {photos.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-300 mb-2">No photos found in database</h3>
            <p className="text-gray-400 mb-6">
              The database query returned 0 photos. Check the debug log above for details.
            </p>
            <button
              onClick={forceRefresh}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Retry Database Query
            </button>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-medium mb-4">
              Photos Found ({photos.length})
            </h3>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1, transition: { delay: index * 0.1 } }}
                  className="relative group bg-gray-800 rounded-xl overflow-hidden shadow-lg"
                >
                  {/* Photo Display */}
                  <div className="relative aspect-square">
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
                    
                    {/* Photo Info Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-3">
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          disabled={deleting}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors shadow-lg disabled:opacity-50"
                          title="Delete Photo"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      <div className="text-white text-xs">
                        <p className="font-mono mb-1">ID: {photo.id.substring(0, 8)}</p>
                        <p className="font-mono mb-1">Public: {photo.public ? 'Yes' : 'No'}</p>
                        <p className="font-mono mb-1">Created: {new Date(photo.created_at).toLocaleString()}</p>
                        <p className="font-medium line-clamp-2">
                          {photo.prompt && photo.prompt.length > 40 
                            ? photo.prompt.substring(0, 40) + '...' 
                            : photo.prompt || 'No prompt'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}