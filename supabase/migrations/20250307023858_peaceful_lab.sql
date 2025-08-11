/*
  # Fix configs table structure and constraints

  1. Changes
    - Drop existing constraints safely
    - Update configs table structure
    - Add proper constraints and policies
    - Ensure data consistency
    
  2. Security
    - Enable RLS
    - Add policies for public read and authenticated update
*/

-- Drop existing constraints safely
DO $$ 
BEGIN
  -- Drop existing constraints if they exist
  ALTER TABLE IF EXISTS configs
    DROP CONSTRAINT IF EXISTS valid_color_primary,
    DROP CONSTRAINT IF EXISTS valid_color_secondary,
    DROP CONSTRAINT IF EXISTS gallery_speed_range;
END $$;

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
DROP FUNCTION IF EXISTS ensure_single_config_row();

-- Add stability_api_key column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'stability_api_key'
  ) THEN
    ALTER TABLE configs ADD COLUMN stability_api_key text;
  END IF;
END $$;

-- Add constraints
ALTER TABLE configs
  ADD CONSTRAINT valid_color_primary 
    CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  ADD CONSTRAINT valid_color_secondary 
    CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
  ADD CONSTRAINT gallery_speed_range 
    CHECK (gallery_speed >= 500 AND gallery_speed <= 10000);

-- Enable RLS if not already enabled
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

-- Insert default config if none exists
INSERT INTO configs (brand_name)
SELECT 'Virtual Photobooth'
WHERE NOT EXISTS (SELECT 1 FROM configs);