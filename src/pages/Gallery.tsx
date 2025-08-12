// Simplified debug version - replace your Gallery component temporarily with this
import React from 'react';
import { useConfigStore } from '../store/configStore';

export default function Gallery() {
  const { config } = useConfigStore();
  const [photos, setPhotos] = React.useState([]);

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 GALLERY DEBUG:');
    console.log('Config loaded:', !!config);
    console.log('Gallery layout:', config?.gallery_layout);
    console.log('Is masonry?', config?.gallery_layout === 'masonry');
    console.log('Full config:', config);
  }, [config]);

  // Mock some photos for testing
  React.useEffect(() => {
    setPhotos([
      { id: '1', processed_url: 'https://picsum.photos/400/300?random=1', prompt: 'Test photo 1', created_at: new Date().toISOString(), content_type: 'image' },
      { id: '2', processed_url: 'https://picsum.photos/400/300?random=2', prompt: 'Test photo 2', created_at: new Date().toISOString(), content_type: 'image' },
      { id: '3', processed_url: 'https://picsum.photos/400/300?random=3', prompt: 'Test photo 3', created_at: new Date().toISOString(), content_type: 'image' },
      { id: '4', processed_url: 'https://picsum.photos/400/300?random=4', prompt: 'Test photo 4', created_at: new Date().toISOString(), content_type: 'image' },
    ]);
  }, []);

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="text-center">
          <h1 className="text-2xl mb-4">Loading config...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="container mx-auto">
        {/* Debug Info */}
        <div className="mb-8 p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
          <h2 className="text-xl font-bold mb-2">🔍 Debug Information</h2>
          <div className="text-sm space-y-1">
            <div>Config loaded: {config ? '✅ YES' : '❌ NO'}</div>
            <div>Gallery layout: <strong>{config.gallery_layout || 'undefined'}</strong></div>
            <div>Gallery animation: <strong>{config.gallery_animation || 'undefined'}</strong></div>
            <div>Gallery speed: <strong>{config.gallery_speed || 'undefined'}ms</strong></div>
            <div>Is masonry: {config.gallery_layout === 'masonry' ? '✅ YES' : '❌ NO'}</div>
            <div>Is carousel: {config.gallery_layout === 'carousel' ? '✅ YES' : '❌ NO'}</div>
            <div>Is grid: {config.gallery_layout === 'grid' ? '✅ YES' : '❌ NO'}</div>
            <div>Photos count: {photos.length}</div>
          </div>
        </div>

        {/* Test Conditional Rendering */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">🧪 Layout Test</h2>
          
          {config.gallery_layout === 'masonry' && (
            <div className="p-6 bg-green-900/20 border border-green-600/30 rounded-lg">
              <h3 className="text-lg font-bold text-green-400 mb-4">🧩 MASONRY DETECTED!</h3>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((photo, index) => (
                  <div key={photo.id} className="aspect-square bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-white">Photo {index + 1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-green-300">
                ✅ Masonry layout is working! Animation: {config.gallery_animation}, Speed: {config.gallery_speed}ms
              </div>
            </div>
          )}

          {config.gallery_layout === 'carousel' && (
            <div className="p-6 bg-blue-900/20 border border-blue-600/30 rounded-lg">
              <h3 className="text-lg font-bold text-blue-400 mb-4">🎠 CAROUSEL DETECTED!</h3>
              <div className="text-sm text-blue-300">
                ✅ Carousel layout is working!
              </div>
            </div>
          )}

          {config.gallery_layout === 'grid' && (
            <div className="p-6 bg-purple-900/20 border border-purple-600/30 rounded-lg">
              <h3 className="text-lg font-bold text-purple-400 mb-4">📋 GRID DETECTED!</h3>
              <div className="text-sm text-purple-300">
                ✅ Grid layout is working!
              </div>
            </div>
          )}

          {!config.gallery_layout && (
            <div className="p-6 bg-red-900/20 border border-red-600/30 rounded-lg">
              <h3 className="text-lg font-bold text-red-400 mb-4">❌ NO LAYOUT DETECTED!</h3>
              <div className="text-sm text-red-300">
                Config.gallery_layout is undefined or null
              </div>
            </div>
          )}
        </div>

        {/* Raw Config Display */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">📄 Raw Config</h2>
          <pre className="bg-gray-800 p-4 rounded-lg text-xs overflow-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}