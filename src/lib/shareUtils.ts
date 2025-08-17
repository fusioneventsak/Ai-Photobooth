// src/lib/shareUtils.ts - Utility functions for sharing photos
import { supabase } from './supabase';
import type { Photo } from '../types/supabase';

export interface ShareOptions {
  platform: 'twitter' | 'facebook' | 'instagram' | 'email' | 'copy';
  message?: string;
}

// Generate a shareable URL for a photo (frontend route)
export function getShareableUrl(photo: Photo): string {
  return `${window.location.origin}/shared/${photo.id}`;
}

// Share a photo to a specific platform using the Edge Function
export async function sharePhoto(photo: Photo, options: ShareOptions): Promise<string> {
  try {
    console.log(`🔗 Sharing photo ${photo.id} to ${options.platform}...`);

    const { data, error } = await supabase.functions.invoke('share', {
      body: {
        photoId: photo.id,
        platform: options.platform,
        message: options.message || 'Check out this amazing AI-generated photo!'
      }
    });

    if (error) {
      console.error('Share function error:', error);
      throw new Error(error.message || 'Failed to generate share URL');
    }

    if (!data?.success || !data?.shareUrl) {
      throw new Error('Invalid response from share service');
    }

    console.log(`✅ Share URL generated for ${options.platform}:`, data.shareUrl);
    return data.shareUrl;

  } catch (error) {
    console.error('Share error:', error);
    throw error;
  }
}

// Copy share URL to clipboard
export async function copyShareUrl(photo: Photo): Promise<void> {
  try {
    const shareUrl = getShareableUrl(photo);
    await navigator.clipboard.writeText(shareUrl);
    console.log('✅ Share URL copied to clipboard:', shareUrl);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    throw new Error('Failed to copy share URL to clipboard');
  }
}

// Native sharing (if supported by browser)
export async function nativeShare(photo: Photo, message?: string): Promise<void> {
  if (!navigator.share) {
    throw new Error('Native sharing not supported');
  }

  try {
    const shareUrl = getShareableUrl(photo);
    
    await navigator.share({
      title: 'Amazing AI Generated Photo',
      text: message || 'Check out this incredible AI-generated photo!',
      url: shareUrl,
    });
    
    console.log('✅ Native share completed');
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      // User cancelled sharing - not an error
      console.log('ℹ️ User cancelled sharing');
      return;
    }
    console.error('Native share error:', error);
    throw error;
  }
}

// Download a photo
export async function downloadPhoto(photo: Photo): Promise<void> {
  try {
    console.log('📥 Starting photo download...');
    
    const imageUrl = photo.processed_url || photo.original_url;
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-photo-${photo.id.substring(0, 8)}.${photo.content_type === 'video' ? 'mp4' : 'png'}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
    
    console.log('✅ Photo download completed');
  } catch (error) {
    console.error('Download error:', error);
    throw new Error('Failed to download photo. Please try again.');
  }
}

// Generate social media specific share URLs
export function generateSocialShareUrls(photo: Photo, message?: string) {
  const shareUrl = getShareableUrl(photo);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedMessage = encodeURIComponent(message || 'Check out this amazing AI-generated photo!');
  
  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodedMessage}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedMessage}`,
    email: `mailto:?subject=${encodeURIComponent('Amazing AI Photo')}&body=${encodedMessage}%0A%0AView the photo: ${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedMessage} ${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`
  };
}

// Validate if a photo can be shared (is public)
export function canSharePhoto(photo: Photo): boolean {
  return photo.public === true;
}

// Get share analytics (if you want to track sharing)
export async function logShareActivity(photoId: string, platform: string): Promise<void> {
  try {
    // This would use the share Edge Function to log activity
    await supabase.functions.invoke('share', {
      body: {
        photoId,
        platform,
        action: 'log_share'
      }
    });
  } catch (error) {
    // Don't fail sharing if logging fails
    console.warn('Failed to log share activity:', error);
  }
}