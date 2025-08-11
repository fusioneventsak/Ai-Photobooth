/*
  # Create configs table with single row constraint

  1. New Tables
    - `configs`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `brand_name` (text, default: 'Virtual Photobooth')
      - `brand_logo_url` (text, nullable)
      - `primary_color` (text, default: '#3B82F6')
      - `secondary_color` (text, default: '#6B7280')
      - `global_prompt` (text, default: 'Create a stunning artistic portrait')
      - `gallery_animation` (text, default: 'fade')
      - `gallery_speed` (integer, default: 3000)
      - `gallery_layout` (text, default: 'grid')

  2. Constraints
    - Ensure only one row can exist in the configs table
    - Add check constraints for valid values

  3. Security
    - Enable RLS
    - Add policies for public read access
    - Add policies for authenticated user updates
*/

-- Drop existing objects if they exist
DO $$ BEGIN
  -- Drop triggers
  DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
  DROP TRIGGER IF EXISTS initialize_config ON configs;
  
  -- Drop functions
  DROP FUNCTION IF EXISTS ensure_single_config_row();
  DROP FUNCTION IF EXISTS initialize_config();
  
  -- Drop table and types
  DROP TABLE IF EXISTS configs;
  DROP TYPE IF EXISTS gallery_animation_type;
  DROP TYPE IF EXISTS gallery_layout_type;
END $$;

-- Create enum types for valid values
CREATE TYPE gallery_animation_type AS ENUM ('fade', 'slide', 'zoom');
CREATE TYPE gallery_layout_type AS ENUM ('grid', 'masonry', 'carousel');

-- Create the configs table
CREATE TABLE configs (
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
  
  -- Add constraints
  CONSTRAINT gallery_speed_range CHECK (gallery_speed BETWEEN 500 AND 10000),
  CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$')
);

-- Function to ensure only one row exists
CREATE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) > 0 THEN
    RAISE EXCEPTION 'Only one row is allowed in the configs table';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single row
CREATE TRIGGER ensure_single_config_row
BEFORE INSERT ON configs
FOR EACH ROW
EXECUTE FUNCTION ensure_single_config_row();

-- Function to initialize default config if none exists
CREATE FUNCTION initialize_config()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) = 0 THEN
    INSERT INTO configs DEFAULT VALUES;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to initialize default config
CREATE TRIGGER initialize_config
AFTER INSERT ON configs
FOR EACH STATEMENT
EXECUTE FUNCTION initialize_config();

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to configs
CREATE POLICY "Allow public read access to configs"
ON configs FOR SELECT
TO public
USING (true);

-- Allow authenticated users to update configs
CREATE POLICY "Allow authenticated users to update configs"
ON configs FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Insert initial config if table is empty
DO $$ 
BEGIN
  IF (SELECT COUNT(*) FROM configs) = 0 THEN
    INSERT INTO configs DEFAULT VALUES;
  END IF;
END $$;