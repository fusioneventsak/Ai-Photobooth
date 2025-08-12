/*
  # Add Missing Config Fields

  1. Changes
    - Add gallery_images_per_page if missing
    - Add model_type, video_duration, providers, and face_preservation_mode
    - Update constraints as needed
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add missing fields to configs table
DO $$ BEGIN
  -- Add gallery_images_per_page if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'gallery_images_per_page'
  ) THEN
    ALTER TABLE configs ADD COLUMN gallery_images_per_page integer DEFAULT 12;
    ALTER TABLE configs ADD CONSTRAINT gallery_images_per_page_range 
      CHECK (gallery_images_per_page >= 6 AND gallery_images_per_page <= 36);
  END IF;

  -- Add model_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'model_type'
  ) THEN
    ALTER TABLE configs ADD COLUMN model_type text DEFAULT 'image';
    ALTER TABLE configs ADD CONSTRAINT model_type_check 
      CHECK (model_type IN ('image', 'video'));
  END IF;

  -- Add video_duration if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'video_duration'
  ) THEN
    ALTER TABLE configs ADD COLUMN video_duration integer DEFAULT 5;
    ALTER TABLE configs ADD CONSTRAINT video_duration_range 
      CHECK (video_duration >= 1 AND video_duration <= 30);
  END IF;

  -- Add provider fields if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'image_provider'
  ) THEN
    ALTER TABLE configs ADD COLUMN image_provider text DEFAULT 'stability';
    ALTER TABLE configs ADD COLUMN video_provider text DEFAULT 'stability';
    ALTER TABLE configs ADD COLUMN use_provider_fallback boolean DEFAULT true;
    
    ALTER TABLE configs ADD CONSTRAINT image_provider_check 
      CHECK (image_provider IN ('stability', 'replicate'));
    ALTER TABLE configs ADD CONSTRAINT video_provider_check 
      CHECK (video_provider IN ('stability', 'replicate'));
  END IF;

  -- Add face_preservation_mode if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'face_preservation_mode'
  ) THEN
    ALTER TABLE configs ADD COLUMN face_preservation_mode text DEFAULT 'preserve_face';
    ALTER TABLE configs ADD CONSTRAINT face_preservation_mode_check 
      CHECK (face_preservation_mode IN ('preserve_face', 'replace_face'));
  END IF;
END $$;

-- Update existing config row with new defaults if it exists
UPDATE configs SET 
  gallery_images_per_page = COALESCE(gallery_images_per_page, 12),
  model_type = COALESCE(model_type, 'image'),
  video_duration = COALESCE(video_duration, 5),
  image_provider = COALESCE(image_provider, 'stability'),
  video_provider = COALESCE(video_provider, 'stability'),
  use_provider_fallback = COALESCE(use_provider_fallback, true),
  face_preservation_mode = COALESCE(face_preservation_mode, 'preserve_face')
WHERE id IS NOT NULL;