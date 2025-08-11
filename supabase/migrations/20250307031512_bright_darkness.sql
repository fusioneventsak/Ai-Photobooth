/*
  # Create configs table with proper structure and policies

  1. New Tables
    - `configs`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz)
      - `brand_name` (text, default: 'Virtual Photobooth')
      - `brand_logo_url` (text, nullable)
      - `primary_color` (text, default: '#3B82F6')
      - `secondary_color` (text, default: '#6B7280')
      - `global_prompt` (text, default: 'Create a stunning artistic portrait')
      - `gallery_animation` (gallery_animation_type, default: 'fade')
      - `gallery_speed` (integer, default: 3000)
      - `gallery_layout` (gallery_layout_type, default: 'grid')
      - `stability_api_key` (text, nullable)

  2. Security
    - Enable RLS on `configs` table
    - Add policies for:
      - Public read access to configs
      - Authenticated users can update configs
    - Add constraints for:
      - Valid color formats (hex codes)
      - Gallery speed range (500-10000ms)
      - Single row enforcement

  3. Triggers
    - Add trigger to ensure only one config row exists
*/

-- Create enum types if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gallery_animation_type') THEN
    CREATE TYPE gallery_animation_type AS ENUM ('fade', 'slide', 'zoom');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gallery_layout_type') THEN
    CREATE TYPE gallery_layout_type AS ENUM ('grid', 'masonry', 'carousel');
  END IF;
END $$;

-- Create configs table if it doesn't exist
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
  
  -- Add constraints if they don't exist
  CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000)
);

-- Enable RLS if not already enabled
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read access to configs" ON configs;
  DROP POLICY IF EXISTS "Allow authenticated users to update configs" ON configs;
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

-- Create or replace function to ensure single row
CREATE OR REPLACE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) > 0 THEN
    RAISE EXCEPTION 'Only one configuration row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
CREATE TRIGGER ensure_single_config_row
  BEFORE INSERT ON configs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_config_row();

-- Insert default config if none exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM configs LIMIT 1) THEN
    INSERT INTO configs (
      brand_name,
      primary_color,
      secondary_color,
      global_prompt,
      gallery_animation,
      gallery_speed,
      gallery_layout
    ) VALUES (
      'Virtual Photobooth',
      '#3B82F6',
      '#6B7280',
      'Create a stunning artistic portrait',
      'fade',
      3000,
      'grid'
    );
  END IF;
END $$;