import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Camera, Download, Share2, ArrowLeft, Calendar, Wand2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useConfigStore } from '../store/configStore';
import type { Photo } from '../types/supabase';

export default function SharedPhoto() {
  const { photoId } = useParams<{ photoId: string }>();
  const { config } = useConfigStore();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (photoId) {
      fetchPhoto(photoId);
    }
  }, [photoId]);

  const fetchPhoto = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('photos')
        .select('*')
        .eq('id', id)
        .eq('public', true)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Photo not found or is not publicly available');
        } else {
          setError('Failed to load photo');
        }
        return;
      }

      setPhoto(data);
    } catch (err) {
      console.error('Error fetching photo:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!photo) return;

    try {
      const response = await fetch(photo.processed_url || photo.original_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-photo-${photo.id.substring(0, 8)}.${photo.content_type === 'video' ? 'mp4' : 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download photo. Please try again.');
    }
  };

  const handleShare = async () => {
    if (!photo) return;

    setSharing(true);
    try {
      const shareUrl = window.location.href;
      
      if (navigator.share) {
        // Use native sharing if available
        await navigator.share({
          title: 'Amazing AI Generated Photo',
          text: 'Check out this incredible AI-generated photo!',
          url: shareUrl,
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareUrl);
        alert('Share link copied to clipboard!');
      }
    } catch (error) {
      console.error('Share failed:', error);
      // Fallback to manual copy
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Share link copied to clipboard!');
      } catch (clipboardError) {
        alert('Unable to share. Please copy the URL from your browser.');
      }
    } finally {
      setSharing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-xl">Loading shared photo...</p>
        </div>
      </div>
    );
  }

  if (error || !photo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Photo Not Found</h1>
          <p className="text-gray-300 mb-6">
            {error || 'The photo you\'re looking for doesn\'t exist or is no longer available.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
          >
            <Camera className="w-5 h-5" />
            Create Your Own AI Photo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-300 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Photobooth</span>
            </Link>
            
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Camera className="w-6 h-6" style={{ color: config?.primary_color }} />
              {config?.brand_name || 'AI Photobooth'}
            </h1>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
              >
                <Share2 className="w-4 h-4" />
                {sharing ? 'Sharing...' : 'Share'}
              </button>
              
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Photo Display */}
          <div className="bg-gray-800 rounded-xl overflow-hidden shadow-2xl mb-6">
            <div className="relative">
              {photo.content_type === 'video' ? (
                <video
                  src={photo.processed_url || photo.original_url}
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-auto max-h-[70vh] object-contain bg-black"
                  poster={photo.thumbnail_url || undefined}
                />
              ) : (
                <img
                  src={photo.processed_url || photo.original_url}
                  alt="AI Generated Photo"
                  className="w-full h-auto max-h-[70vh] object-contain bg-black"
                />
              )}
              
              {/* AI Badge */}
              <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-400" />
                <span className="text-purple-400">AI Generated</span>
              </div>
              
              {/* Content Type Badge */}
              <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-lg text-sm">
                {photo.content_type === 'video' ? '🎬 Video' : '📸 Image'}
              </div>
            </div>
          </div>

          {/* Photo Details */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Wand2 className="w-6 h-6 text-purple-400" />
              AI Generated {photo.content_type === 'video' ? 'Video' : 'Photo'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Prompt */}
              <div>
                <h3 className="text-lg font-semibold mb-2 text-purple-300">AI Prompt</h3>
                <p className="text-gray-300 bg-gray-700/50 rounded-lg p-3 text-sm">
                  {photo.prompt}
                </p>
              </div>
              
              {/* Metadata */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span className="text-sm">Created: {formatDate(photo.created_at)}</span>
                </div>
                
                {photo.content_type === 'video' && photo.duration && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="w-4 h-4 text-center text-green-400">⏱️</span>
                    <span className="text-sm">Duration: {photo.duration} seconds</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="w-4 h-4 text-center text-yellow-400">✨</span>
                  <span className="text-sm">Type: {photo.content_type === 'video' ? 'AI Video' : 'AI Image'}</span>
                </div>
              </div>
            </div>
            
            {/* Call to Action */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="text-center">
                <p className="text-gray-300 mb-4">
                  Want to create your own amazing AI photos and videos?
                </p>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition"
                  style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
                >
                  <Camera className="w-5 h-5" />
                  Try AI Photobooth
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}