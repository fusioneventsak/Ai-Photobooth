/*
  # Add Gallery Settings Fields

  1. Changes
    - Add missing gallery settings fields to configs table
    - Set proper defaults for new fields
    - Update existing config row if it exists
    
  2. New Fields
    - gallery_allow_downloads: boolean
    - gallery_social_sharing: boolean
    - gallery_show_metadata: boolean
    - gallery_require_admin: boolean
    - gallery_watermark_enabled: boolean
    - gallery_public_access: boolean
*/

-- Add missing gallery settings fields
DO $$ BEGIN
  -- Add gallery_allow_downloads if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'gallery_allow_downloads'
  ) THEN
    ALTER TABLE configs ADD COLUMN gallery_allow_downloads boolean DEFAULT true;
  END IF;

  -- Add gallery_social_sharing if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'gallery_social_sharing'
  ) THEN
    ALTER TABLE configs ADD COLUMN gallery_social_sharing boolean DEFAULT true;
  END IF;

  -- Add gallery_show_metadata if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'gallery_show_metadata'
  ) THEN
    ALTER TABLE configs ADD COLUMN gallery_show_metadata boolean DEFAULT false;
  END IF;

  -- Add gallery_require_admin if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'gallery_require_admin'
  ) THEN
    ALTER TABLE configs ADD COLUMN gallery_require_admin boolean DEFAULT false;
  END IF;

  -- Add gallery_watermark_enabled if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'gallery_watermark_enabled'
  ) THEN
    ALTER TABLE configs ADD COLUMN gallery_watermark_enabled boolean DEFAULT false;
  END IF;

  -- Add gallery_public_access if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'gallery_public_access'
  ) THEN
    ALTER TABLE configs ADD COLUMN gallery_public_access boolean DEFAULT true;
  END IF;
END $$;

-- Update existing config row with new defaults
UPDATE configs SET 
  gallery_allow_downloads = COALESCE(gallery_allow_downloads, true),
  gallery_social_sharing = COALESCE(gallery_social_sharing, true),
  gallery_show_metadata = COALESCE(gallery_show_metadata, false),
  gallery_require_admin = COALESCE(gallery_require_admin, false),
  gallery_watermark_enabled = COALESCE(gallery_watermark_enabled, false),
  gallery_public_access = COALESCE(gallery_public_access, true)
WHERE id IS NOT NULL;