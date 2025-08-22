/*
  # Add Model Selection Fields to Configs

  1. New Columns
    - `replicate_image_model` (text, default 'flux-schnell')
      - Stores the selected Replicate image generation model
      - Default to 'flux-schnell' for fast generation
    - `replicate_video_model` (text, default 'stable-video-diffusion')
      - Stores the selected Replicate video generation model
      - Default to 'stable-video-diffusion' for high quality

  2. Purpose
    - Allow users to select different AI models for image and video generation
    - Provides flexibility to choose between speed vs quality
    - Supports the enhanced Replicate service with multiple model options

  3. Constraints
    - Both fields are optional (nullable) with sensible defaults
    - Text type allows for future model additions without schema changes
*/

-- Add model selection fields to configs table
ALTER TABLE configs 
ADD COLUMN replicate_image_model text DEFAULT 'flux-schnell',
ADD COLUMN replicate_video_model text DEFAULT 'stable-video-diffusion';

-- Add helpful comments to document the new columns
COMMENT ON COLUMN configs.replicate_image_model IS 'Selected Replicate model for image generation (flux-schnell, flux-dev, sdxl, realvisxl)';
COMMENT ON COLUMN configs.replicate_video_model IS 'Selected Replicate model for video generation (stable-video-diffusion, animatediff, zeroscope)';