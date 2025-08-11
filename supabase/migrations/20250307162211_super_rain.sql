/*
  # Add AI provider preferences to configs table

  1. Changes
     - Add image_provider column to the configs table to track preferred image generation service
     - Add video_provider column to the configs table to track preferred video generation service
  
  2. Rationale
     - This allows users to select their preferred AI service provider for both image and video generation
     - Supports both Stability AI and Replicate as provider options
     - Default is 'stability' to maintain backward compatibility
*/

-- Add image_provider column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'configs' AND column_name = 'image_provider'
  ) THEN
    ALTER TABLE configs 
    ADD COLUMN image_provider text NOT NULL DEFAULT 'stability' 
    CHECK (image_provider IN ('stability', 'replicate'));
  END IF;
END $$;

-- Add video_provider column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'configs' AND column_name = 'video_provider'
  ) THEN
    ALTER TABLE configs 
    ADD COLUMN video_provider text NOT NULL DEFAULT 'stability'
    CHECK (video_provider IN ('stability', 'replicate'));
  END IF;
END $$;