/*
  # Add provider fields to configs table

  1. Changes
    - Add `image_provider` and `video_provider` fields to the `configs` table
    - Set default values to 'stability'
    - Add check constraints to ensure valid providers

  2. Purpose
    - Enable users to select different AI providers for image and video generation
    - Support fallback mechanisms when a provider is unavailable
*/

-- Add image_provider column with default and constraint
ALTER TABLE IF EXISTS configs
ADD COLUMN IF NOT EXISTS image_provider text NOT NULL DEFAULT 'stability'::text;

-- Add check constraint for image_provider
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'configs_image_provider_check'
  ) THEN
    ALTER TABLE configs 
    ADD CONSTRAINT configs_image_provider_check 
    CHECK (image_provider = ANY (ARRAY['stability'::text, 'replicate'::text]));
  END IF;
END $$;

-- Add video_provider column with default and constraint
ALTER TABLE IF EXISTS configs
ADD COLUMN IF NOT EXISTS video_provider text NOT NULL DEFAULT 'stability'::text;

-- Add check constraint for video_provider
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'configs_video_provider_check'
  ) THEN
    ALTER TABLE configs 
    ADD CONSTRAINT configs_video_provider_check 
    CHECK (video_provider = ANY (ARRAY['stability'::text, 'replicate'::text]));
  END IF;
END $$;