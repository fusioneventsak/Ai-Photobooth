/*
  # Fix Video Model Persistence Issue

  1. Changes
    - Update default value for replicate_video_model to 'hailuo'
    - Update existing configs to use 'hailuo' if currently set to 'stable-video-diffusion'
    - Ensure the column accepts all new video model values

  2. Purpose
    - Fix persistence issue where video model selection keeps reverting
    - Set better default for dramatic video transformation capabilities
*/

-- Update the default value for new rows
ALTER TABLE configs 
ALTER COLUMN replicate_video_model SET DEFAULT 'hailuo';

-- Update existing configs that are using the old default
UPDATE configs 
SET replicate_video_model = 'hailuo' 
WHERE replicate_video_model = 'stable-video-diffusion' OR replicate_video_model IS NULL;

-- Update the comment to reflect new options
COMMENT ON COLUMN configs.replicate_video_model IS 'Selected Replicate model for video generation (hailuo, cogvideo, kling, runway, stable-video-diffusion)';

-- Verify the change
DO $$ 
BEGIN 
    RAISE NOTICE 'Updated replicate_video_model default to hailuo and migrated existing data';
END $$;