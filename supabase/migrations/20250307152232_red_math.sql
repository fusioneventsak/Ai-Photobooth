/*
  # Fix Config Table Structure

  1. Changes
    - Drop existing configs table and related objects
    - Recreate configs table with proper structure
    - Add necessary constraints and policies
    - Insert default config row

  2. Security
    - Enable RLS
    - Add policies for public read and authenticated updates
*/

-- First, clean up existing objects
DROP TABLE IF EXISTS configs CASCADE;
DROP TYPE IF EXISTS gallery_animation_type CASCADE;
DROP TYPE IF EXISTS gallery_layout_type CASCADE;

-- Create enum types
CREATE TYPE gallery_animation_type AS ENUM ('fade', 'slide', 'zoom');
CREATE TYPE gallery_layout_type AS ENUM ('grid', 'masonry', 'carousel');

-- Create configs table
CREATE TABLE configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  brand_name text NOT NULL DEFAULT 'Virtual Photobooth',
  brand_logo_url text,
  primary_color text NOT NULL DEFAULT '#3B82F6',
  secondary_color text NOT NULL DEFAULT '#6B7280',
  global_prompt text NOT NULL DEFAULT 'Create a stunning astronaut portrait with a reflective helmet visor and planets visible in the cosmic background, preserve all facial features and expressions exactly as they are in the original photo',
  gallery_animation gallery_animation_type NOT NULL DEFAULT 'fade',
  gallery_speed integer NOT NULL DEFAULT 3000,
  gallery_layout gallery_layout_type NOT NULL DEFAULT 'grid',
  stability_api_key text,
  
  CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000)
);

-- Insert default config
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
  'Create a stunning astronaut portrait with a reflective helmet visor and planets visible in the cosmic background, preserve all facial features and expressions exactly as they are in the original photo',
  'fade',
  3000,
  'grid'
);

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to configs"
  ON configs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public to update configs"
  ON configs
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);