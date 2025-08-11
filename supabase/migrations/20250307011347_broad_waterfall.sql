/*
  # Initial Schema Setup for Virtual Photobooth

  1. New Tables
    - `configs`
      - Stores global configuration and branding settings
      - Single row table (controlled by trigger)
    - `photos`
      - Stores photo metadata and URLs
      - Includes original and processed versions
    
  2. Security
    - Enable RLS on all tables
    - Public read access for photos marked as public
    - Admin access for configuration
*/

-- Create configs table
CREATE TABLE configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  brand_name text NOT NULL DEFAULT 'Virtual Photobooth',
  brand_logo_url text,
  primary_color text DEFAULT '#3B82F6',
  secondary_color text DEFAULT '#6B7280',
  global_prompt text DEFAULT 'Create a stunning artistic portrait',
  gallery_animation text DEFAULT 'fade',
  gallery_speed integer DEFAULT 3000,
  gallery_layout text DEFAULT 'grid'
);

-- Create photos table
CREATE TABLE photos (
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

-- RLS Policies
CREATE POLICY "Allow public read access to configs"
  ON configs
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow authenticated users to update configs"
  ON configs
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow public read access to public photos"
  ON photos
  FOR SELECT
  TO PUBLIC
  USING (public = true);

CREATE POLICY "Allow authenticated users to insert photos"
  ON photos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure single row in configs
CREATE OR REPLACE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) > 0 THEN
    RAISE EXCEPTION 'Only one config row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_config_row
BEFORE INSERT ON configs
FOR EACH ROW
EXECUTE FUNCTION ensure_single_config_row();

-- Insert initial config
INSERT INTO configs (brand_name) VALUES ('Virtual Photobooth');