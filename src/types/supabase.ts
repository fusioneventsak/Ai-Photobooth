export type Config = {
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
  model_type: 'image' | 'video';
  video_duration: number;
  image_provider: 'stability' | 'replicate';
  video_provider: 'stability' | 'replicate';
  use_provider_fallback: boolean;
};

export type Photo = {
  id: string;
  created_at: string;
  original_url: string;
  processed_url: string | null;
  content_type: 'image' | 'video';
  duration: number | null;
  thumbnail_url: string | null;
  prompt: string;
  public: boolean;
};