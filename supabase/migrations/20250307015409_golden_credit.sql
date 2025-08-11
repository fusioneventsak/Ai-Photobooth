/*
  # Create configs table with single row constraint

  1. New Tables
    - `configs` table for application configuration
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
      - `stability_api_key` (text)

  2. Functions
    - `ensure_single_config_row`: Ensures only one row exists in the configs table
    - `initialize_config`: Creates initial config row if table is empty

  3. Security
    - Enable RLS on configs table
    - Add policies for public read access and authenticated update access
*/

-- Drop existing objects if they exist
DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
DROP TRIGGER IF EXISTS initialize_config ON configs;
DROP FUNCTION IF EXISTS ensure_single_config_row();
DROP FUNCTION IF EXISTS initialize_config();
DROP TABLE IF EXISTS configs;

-- Create the configs table
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
  gallery_layout text DEFAULT 'grid',
  stability_api_key text
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

-- Function to initialize config
CREATE FUNCTION initialize_config()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) = 0 THEN
    INSERT INTO configs DEFAULT VALUES;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER ensure_single_config_row
  BEFORE INSERT ON configs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_config_row();

CREATE TRIGGER initialize_config
  AFTER INSERT ON configs
  FOR EACH STATEMENT
  EXECUTE FUNCTION initialize_config();

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to configs" ON configs;
DROP POLICY IF EXISTS "Allow authenticated users to update configs" ON configs;

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

-- Initialize the first row
INSERT INTO configs DEFAULT VALUES;