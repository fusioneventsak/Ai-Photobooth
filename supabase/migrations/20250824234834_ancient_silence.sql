-- supabase/migrations/20250824120000_fix_video_model_defaults.sql
/*
  # Fix Video Model Selection Persistence

  1. Problem
    - replicate_video_model defaults to 'stable-video-diffusion' but admin panel expects 'hailuo'
    - Model selections are not persisting properly

  2. Changes
    - Update default value for replicate_video_model to match admin panel expectations
    - Ensure existing rows get updated with correct defaults
    - Add proper constraints for new model options

  3. Security
    - Maintain existing RLS policies
*/

-- Update the default value for replicate_video_model to match admin panel
ALTER TABLE configs 
  ALTER COLUMN replicate_video_model SET DEFAULT 'hailuo';

-- Update existing rows that have the old default
UPDATE configs 
SET replicate_video_model = 'hailuo' 
WHERE replicate_video_model = 'stable-video-diffusion' 
  OR replicate_video_model IS NULL;

-- Update existing rows for image model defaults
UPDATE configs 
SET replicate_image_model = 'flux-schnell' 
WHERE replicate_image_model IS NULL;

-- Update constraints to include all valid model options
ALTER TABLE configs 
  DROP CONSTRAINT IF EXISTS replicate_image_model_check;

ALTER TABLE configs 
  DROP CONSTRAINT IF EXISTS replicate_video_model_check;

-- Add comprehensive constraints for all model options
ALTER TABLE configs 
  ADD CONSTRAINT replicate_image_model_check 
  CHECK (replicate_image_model IN ('flux-schnell', 'flux-dev', 'sdxl', 'realvisxl'));

ALTER TABLE configs 
  ADD CONSTRAINT replicate_video_model_check 
  CHECK (replicate_video_model IN ('hailuo', 'cogvideo', 'kling', 'runway', 'stable-video-diffusion'));

-- Update comments to reflect new options
COMMENT ON COLUMN configs.replicate_image_model IS 'Selected Replicate model for image generation: flux-schnell, flux-dev, sdxl, realvisxl';
COMMENT ON COLUMN configs.replicate_video_model IS 'Selected Replicate model for video generation: hailuo, cogvideo, kling, runway, stable-video-diffusion';