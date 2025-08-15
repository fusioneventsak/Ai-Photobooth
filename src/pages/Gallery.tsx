// src/types/supabase.ts - Enhanced Types for Robust Gallery
export interface Database {
  public: {
    Tables: {
      photos: {
        Row: {
          id: string;
          created_at: string;
          original_url: string;
          processed_url: string | null;
          prompt: string;
          public: boolean;
          content_type?: 'image' | 'video' | string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          original_url: string;
          processed_url?: string | null;
          prompt: string;
          public?: boolean;
          content_type?: 'image' | 'video' | string;
        };
        Update: {
          id?: string;
          created_at?: string;
          original_url?: string;
          processed_url?: string | null;
          prompt?: string;
          public?: boolean;
          content_type?: 'image' | 'video' | string;
        };
      };
      configs: {
        Row: {
          id: string;
          created_at: string;
          brand_name: string;
          brand_logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          global_prompt: string;
          gallery_animation: 'fade' | 'slide' | 'zoom';
          gallery_speed: number;
          gallery_layout: 'grid' | 'masonry' | 'carousel';
          stability_api_key: string | null;
          gallery_allow_downloads?: boolean;
          gallery_social_sharing?: boolean;
          gallery_show_metadata?: boolean;
          gallery_require_admin?: boolean;
          gallery_public_access?: boolean;
          gallery_images_per_page?: number;
          model_type?: 'image' | 'video';
        };
        Insert: {
          id?: string;
          created_at?: string;
          brand_name?: string;
          brand_logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          global_prompt?: string;
          gallery_animation?: 'fade' | 'slide' | 'zoom';
          gallery_speed?: number;
          gallery_layout?: 'grid' | 'masonry' | 'carousel';
          stability_api_key?: string | null;
          gallery_allow_downloads?: boolean;
          gallery_social_sharing?: boolean;
          gallery_show_metadata?: boolean;
          gallery_require_admin?: boolean;
          gallery_public_access?: boolean;
          gallery_images_per_page?: number;
          model_type?: 'image' | 'video';
        };
        Update: {
          id?: string;
          created_at?: string;
          brand_name?: string;
          brand_logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          global_prompt?: string;
          gallery_animation?: 'fade' | 'slide' | 'zoom';
          gallery_speed?: number;
          gallery_layout?: 'grid' | 'masonry' | 'carousel';
          stability_api_key?: string | null;
          gallery_allow_downloads?: boolean;
          gallery_social_sharing?: boolean;
          gallery_show_metadata?: boolean;
          gallery_require_admin?: boolean;
          gallery_public_access?: boolean;
          gallery_images_per_page?: number;
          model_type?: 'image' | 'video';
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      gallery_animation_type: 'fade' | 'slide' | 'zoom';
      gallery_layout_type: 'grid' | 'masonry' | 'carousel';
    };
  };
}

// Enhanced Photo type with additional metadata
export type Photo = Database['public']['Tables']['photos']['Row'] & {
  thumbnail_url?: string;
  file_size?: number;
  dimensions?: {
    width: number;
    height: number;
  };
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
};

// Enhanced Config type
export type Config = Database['public']['Tables']['configs']['Row'];

// Gallery update event types for real-time synchronization
export interface GalleryUpdateEvent {
  action: 'create' | 'update' | 'delete' | 'deleteAll';
  photoId?: string;
  newPhoto?: Photo;
  source?: string;
  count?: number;
  timestamp: string;
}

// Photo upload progress for better UX
export interface PhotoUploadProgress {
  stage: 'uploading' | 'processing' | 'saving' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

// Gallery state for persistence
export interface GalleryState {
  photos: Photo[];
  totalCount: number;
  lastSync: string;
  currentPage: number;
  selectedLayout: 'grid' | 'masonry' | 'carousel';
  filters: {
    contentType?: 'image' | 'video' | 'all';
    dateRange?: {
      start: string;
      end: string;
    };
    searchTerm?: string;
  };
}

// Real-time subscription payload
export interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Photo;
  old?: Photo;
  table: string;
  schema: string;
  commit_timestamp: string;
}

// Storage event for cross-tab communication
export interface StorageEventData {
  type: 'galleryRefresh' | 'photoAdded' | 'photoDeleted' | 'configUpdated';
  timestamp: string;
  data?: any;
}

// Error types for better error handling
export type GalleryError = 
  | 'network_error'
  | 'permission_denied'
  | 'not_found'
  | 'storage_limit'
  | 'invalid_format'
  | 'upload_failed'
  | 'delete_failed'
  | 'unknown_error';

export interface GalleryErrorDetails {
  type: GalleryError;
  message: string;
  code?: string;
  retryable: boolean;
  timestamp: string;
}

// Utility types for gallery operations
export type GalleryLayout = 'grid' | 'masonry' | 'carousel';
export type GalleryAnimation = 'fade' | 'slide' | 'zoom';
export type ContentType = 'image' | 'video';

// Configuration for gallery features
export interface GalleryFeatures {
  allowDownloads: boolean;
  socialSharing: boolean;
  showMetadata: boolean;
  requireAdmin: boolean;
  publicAccess: boolean;
  realTimeUpdates: boolean;
  autoRefresh: boolean;
  crossTabSync: boolean;
}

// Pagination configuration
export interface GalleryPagination {
  enabled: boolean;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// Gallery statistics for admin dashboard
export interface GalleryStats {
  totalPhotos: number;
  totalVideos: number;
  totalSize: number;
  todaysUploads: number;
  popularContentType: ContentType;
  averageFileSize: number;
  oldestPhoto: string;
  newestPhoto: string;
}

// Export commonly used composite types
export type PhotoWithMeta = Photo & {
  isNew?: boolean;
  isSelected?: boolean;
  uploadProgress?: PhotoUploadProgress;
};

export type ConfigWithFeatures = Config & {
  features: GalleryFeatures;
  pagination: GalleryPagination;
};

// Function signatures for gallery operations
export interface GalleryOperations {
  loadPhotos: (options?: { showLoading?: boolean; source?: string }) => Promise<Photo[]>;
  uploadPhoto: (data: string | File, prompt: string, type?: ContentType) => Promise<Photo | null>;
  deletePhoto: (id: string) => Promise<boolean>;
  deleteAllPhotos: () => Promise<boolean>;
  getPhotoCount: () => Promise<number>;
  subscribeToUpdates: (callback: (event: RealtimePayload) => void) => () => void;
  refreshGallery: (force?: boolean) => Promise<void>;
}