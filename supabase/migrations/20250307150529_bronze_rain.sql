/*
  # Virtual Photobooth Schema

  1. Custom Types
    - gallery_animation_type: Enum for gallery animation styles
    - gallery_layout_type: Enum for gallery layout options
  
  2. Tables
    - configs: Stores application configuration
    - photos: Stores user photos and processing results
  
  3. Security
    - RLS enabled on all tables
    - Public read access to configs
    - Authenticated users can update configs
    - Public read access to public photos
    - Public can create and update photos
*/

-- Create custom types if they don't exist
DO $$ BEGIN
  CREATE TYPE gallery_animation_type AS ENUM ('fade', 'slide', 'zoom');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gallery_layout_type AS ENUM ('grid', 'masonry', 'carousel');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create configs table
CREATE TABLE IF NOT EXISTS configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  brand_name text NOT NULL DEFAULT 'Virtual Photobooth',
  brand_logo_url text,
  primary_color text NOT NULL DEFAULT '#3B82F6',
  secondary_color text NOT NULL DEFAULT '#6B7280',
  global_prompt text NOT NULL DEFAULT 'Create a stunning artistic portrait',
  gallery_animation gallery_animation_type NOT NULL DEFAULT 'fade',
  gallery_speed integer NOT NULL DEFAULT 3000,
  gallery_layout gallery_layout_type NOT NULL DEFAULT 'grid',
  stability_api_key text,
  CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000),
  CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$')
);

-- Create photos table
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  original_url text NOT NULL,
  processed_url text,
  prompt text NOT NULL,
  public boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Configs policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read access to configs" ON configs;
  CREATE POLICY "Allow public read access to configs"
    ON configs
    FOR SELECT
    TO public
    USING (true);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to update configs" ON configs;
  CREATE POLICY "Allow authenticated users to update configs"
    ON configs
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Photos policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read access to public photos" ON photos;
  CREATE POLICY "Allow public read access to public photos"
    ON photos
    FOR SELECT
    TO public
    USING (public = true);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public to create photos" ON photos;
  CREATE POLICY "Allow public to create photos"
    ON photos
    FOR INSERT
    TO public
    WITH CHECK (true);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public to update their photos" ON photos;
  CREATE POLICY "Allow public to update their photos"
    ON photos
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create function to ensure single config row
CREATE OR REPLACE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) > 0 THEN
    RAISE EXCEPTION 'Only one config row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to ensure single config
DO $$ BEGIN
  DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
  CREATE TRIGGER ensure_single_config_row
    BEFORE INSERT ON configs
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_config_row();
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;