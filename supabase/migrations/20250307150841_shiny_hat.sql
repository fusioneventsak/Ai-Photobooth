/*
  # Initial Schema Setup

  1. Tables
    - `configs`: Stores application configuration
      - Single row table with branding and gallery settings
      - Includes validation constraints for colors and animation speed
    - `photos`: Stores user-generated photos
      - Tracks original and processed images
      - Includes public/private visibility flag

  2. Security
    - RLS enabled on all tables
    - Public read access to configs
    - Authenticated users can update configs
    - Public read access to public photos
    - Public can create and update photos

  3. Constraints
    - Single config row enforcement
    - Color format validation
    - Gallery speed range validation
*/

-- Create tables with IF NOT EXISTS to handle existing tables
CREATE TABLE IF NOT EXISTS configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  brand_name text NOT NULL DEFAULT 'Virtual Photobooth',
  brand_logo_url text,
  primary_color text NOT NULL DEFAULT '#3B82F6',
  secondary_color text NOT NULL DEFAULT '#6B7280',
  global_prompt text NOT NULL DEFAULT 'Create a stunning artistic portrait',
  gallery_animation text NOT NULL DEFAULT 'fade',
  gallery_speed integer NOT NULL DEFAULT 3000,
  gallery_layout text NOT NULL DEFAULT 'grid',
  stability_api_key text,
  CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000),
  CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT valid_gallery_animation CHECK (gallery_animation IN ('fade', 'slide', 'zoom')),
  CONSTRAINT valid_gallery_layout CHECK (gallery_layout IN ('grid', 'masonry', 'carousel'))
);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  original_url text NOT NULL,
  processed_url text,
  prompt text NOT NULL,
  public boolean DEFAULT false
);

-- Enable RLS
DO $$ 
BEGIN
  EXECUTE 'ALTER TABLE configs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE photos ENABLE ROW LEVEL SECURITY';
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Allow public read access to configs" ON configs';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated users to update configs" ON configs';
  EXECUTE 'DROP POLICY IF EXISTS "Allow public read access to public photos" ON photos';
  EXECUTE 'DROP POLICY IF EXISTS "Allow public to create photos" ON photos';
  EXECUTE 'DROP POLICY IF EXISTS "Allow public to update their photos" ON photos';
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Create policies
CREATE POLICY "Allow public read access to configs"
  ON configs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to update configs"
  ON configs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public read access to public photos"
  ON photos
  FOR SELECT
  TO public
  USING (public = true);

CREATE POLICY "Allow public to create photos"
  ON photos
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public to update their photos"
  ON photos
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

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

-- Create trigger
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
  CREATE TRIGGER ensure_single_config_row
    BEFORE INSERT ON configs
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_config_row();
EXCEPTION 
  WHEN others THEN NULL;
END $$;