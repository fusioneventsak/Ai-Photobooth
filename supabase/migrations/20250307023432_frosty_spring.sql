/*
  # Fix Configuration Table Setup

  1. Changes
    - Drop existing constraints before adding new ones
    - Ensure single row configuration
    - Add proper validation constraints
    - Enable RLS with appropriate policies
    - Initialize default configuration

  2. Security
    - Enable RLS
    - Add policies for public read and authenticated update
*/

-- Drop existing constraints if they exist
DO $$ 
BEGIN
  ALTER TABLE IF EXISTS configs
    DROP CONSTRAINT IF EXISTS valid_color_primary,
    DROP CONSTRAINT IF EXISTS valid_color_secondary,
    DROP CONSTRAINT IF EXISTS gallery_speed_range;
END $$;

-- Drop existing triggers
DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
DROP TRIGGER IF EXISTS initialize_config ON configs;

-- Drop existing functions
DROP FUNCTION IF EXISTS ensure_single_config_row();

-- Create or replace the ensure_single_config_row function
CREATE OR REPLACE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) > 0 THEN
    RAISE EXCEPTION 'Only one configuration row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for single row constraint
CREATE TRIGGER ensure_single_config_row
  BEFORE INSERT ON configs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_config_row();

-- Add constraints
ALTER TABLE configs
  ADD CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  ADD CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
  ADD CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000);

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access to configs" ON configs;
DROP POLICY IF EXISTS "Allow authenticated users to update configs" ON configs;

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

-- Initialize default config if none exists
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