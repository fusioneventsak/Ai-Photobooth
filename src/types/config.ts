// src/types/config.ts - Updated with Kling-specific parameters
export interface Config {
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
  face_preservation_mode: 'preserve_face' | 'replace_face';
  gallery_images_per_page?: number;
  
  // Model selection fields
  replicate_image_model?: string;
  replicate_video_model?: string;
  
  // Enhanced SDXL Inpainting Settings
  sdxl_strength?: number; // 0.1-1.0, lower preserves more of original
  sdxl_cfg_scale?: number; // 1-20, guidance scale
  sdxl_steps?: number; // 10-50, number of steps
  sdxl_face_expansion?: number; // 1.0-2.0, how much to expand face mask
  sdxl_feather_radius?: number; // 0-50, mask feathering for smooth blending
  
  // ✅ NEW: Kling-specific video generation parameters
  kling_cfg_scale?: number; // 0.1-2.0, guidance scale for Kling models
  kling_negative_prompt?: string; // Negative prompt for what to avoid
  kling_aspect_ratio?: '16:9' | '9:16' | '1:1'; // Aspect ratio options
  kling_artistic_mode?: boolean; // Enable enhanced artistic effects
  
  // Advanced Settings
  use_controlnet?: boolean; // Enable ControlNet for better composition
  controlnet_type?: 'canny' | 'depth' | 'openpose' | 'auto';
  auto_enhance_prompt?: boolean; // Automatically enhance prompts for better results
  hd_upscaling?: boolean; // Enable post-processing upscaling
  
  // Gallery Settings
  gallery_allow_downloads?: boolean;
  gallery_social_sharing?: boolean;
  gallery_show_metadata?: boolean;
  gallery_require_admin?: boolean;
  gallery_watermark_enabled?: boolean;
  gallery_public_access?: boolean;
  
  // Header/UI Customization
  header_bg_color?: string;
  show_model_badge?: boolean;
  show_face_mode_badge?: boolean;
  show_processing_details?: boolean;
  
  // Performance Settings
  enable_debug_mode?: boolean;
  max_generation_attempts?: number;
  generation_timeout?: number; // milliseconds
  enable_fallback_masking?: boolean;
}