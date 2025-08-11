/*
  # Fix Config Initialization

  1. Changes
    - Drop existing triggers that might interfere with config management
    - Add new function to ensure config table always has exactly one row
    - Add trigger to maintain single config row
    - Initialize config if empty

  2. Security
    - Maintain existing RLS policies
    - Ensure public read access
    - Allow authenticated updates
*/

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
DROP TRIGGER IF EXISTS initialize_config ON configs;
DROP FUNCTION IF EXISTS ensure_single_config_row();
DROP FUNCTION IF EXISTS initialize_config();

-- Create function to ensure single config row
CREATE OR REPLACE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) = 0 THEN
    -- Allow insert if table is empty
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    -- Prevent additional inserts if row exists
    RAISE EXCEPTION 'Config table must contain exactly one row';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER ensure_single_config_row
  BEFORE INSERT ON configs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_config_row();

-- Initialize config if empty
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) = 0 THEN
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