/*
  # Fix Configuration System

  1. Changes
    - Drop and recreate configs table with proper structure
    - Add proper constraints and defaults
    - Insert initial configuration
    
  2. Security
    - Enable RLS
    - Add policies for public read and authenticated updates
*/

-- Drop existing table and types if they exist
DROP TABLE IF EXISTS configs;
DROP TYPE IF EXISTS gallery_animation_type;
DROP TYPE IF EXISTS gallery_layout_type;

-- Create custom types
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
  stability_api_key text DEFAULT NULL,
  CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
  CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000)
);

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access to configs"
  ON configs FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow authenticated users to update configs"
  ON configs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert initial configuration
INSERT INTO configs (
  brand_name,
  primary_color,
  secondary_color,
  global_prompt,
  gallery_animation,
  gallery_speed,
  gallery_layout,
  stability_api_key
) VALUES (
  'Virtual Photobooth',
  '#3B82F6',
  '#6B7280',
  'Create a stunning artistic portrait',
  'fade',
  3000,
  'grid',
  current_setting('app.settings.stability_api_key', true)
);