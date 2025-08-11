/*
  # Fix configs table and policies

  1. Changes
    - Drop existing policies to avoid conflicts
    - Recreate configs table with proper constraints
    - Add single row enforcement
    - Set up proper RLS policies
    - Insert default configuration

  2. Security
    - Enable RLS
    - Public read access
    - Authenticated users can update
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow public read access to configs" ON configs;
DROP POLICY IF EXISTS "Allow authenticated users to update configs" ON configs;

-- Create enum types if they don't exist
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

-- Create the configs table if it doesn't exist
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
  CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000)
);

-- Function to ensure only one row exists
CREATE OR REPLACE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) > 0 AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only one configuration row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single row
DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
CREATE TRIGGER ensure_single_config_row
  BEFORE INSERT ON configs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_config_row();

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Allow public read access to configs"
  ON configs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to update configs"
  ON configs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default config if none exists
INSERT INTO configs (brand_name)
SELECT 'Virtual Photobooth'
WHERE NOT EXISTS (SELECT 1 FROM configs);