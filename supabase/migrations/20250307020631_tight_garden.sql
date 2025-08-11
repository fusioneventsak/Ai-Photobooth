/*
  # Initialize Configuration Table

  1. Changes
    - Drop existing constraints and triggers to avoid conflicts
    - Recreate triggers for single config row management
    - Add proper constraints for colors and gallery speed
    - Initialize default config if none exists

  2. Security
    - Enable RLS on configs table
    - Add policies for public read access
    - Add policies for authenticated update access
*/

-- Drop existing constraints and triggers if they exist
DO $$ 
BEGIN
  -- Drop constraints if they exist
  ALTER TABLE IF EXISTS configs
    DROP CONSTRAINT IF EXISTS valid_color_primary,
    DROP CONSTRAINT IF EXISTS valid_color_secondary,
    DROP CONSTRAINT IF EXISTS gallery_speed_range;

  -- Drop triggers if they exist
  DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
  DROP TRIGGER IF EXISTS initialize_config ON configs;
  
  -- Drop functions if they exist
  DROP FUNCTION IF EXISTS ensure_single_config_row();
  DROP FUNCTION IF EXISTS initialize_config();
END $$;

-- Create function to ensure single config row
CREATE OR REPLACE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) > 0 THEN
    RAISE EXCEPTION 'Only one configuration row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to initialize config
CREATE OR REPLACE FUNCTION initialize_config()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) = 0 THEN
    INSERT INTO configs (
      brand_name,
      brand_logo_url,
      primary_color,
      secondary_color,
      global_prompt,
      gallery_animation,
      gallery_speed,
      gallery_layout
    ) VALUES (
      'Virtual Photobooth',
      NULL,
      '#3B82F6',
      '#6B7280',
      'Create a stunning artistic portrait',
      'fade',
      3000,
      'grid'
    );
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

-- Add constraints
ALTER TABLE configs
  ADD CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
  ADD CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
  ADD CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000);

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to configs" ON configs;
DROP POLICY IF EXISTS "Allow authenticated users to update configs" ON configs;

-- Add policies
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

-- Initialize first config row if none exists
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) = 0 THEN
    INSERT INTO configs (id) VALUES (gen_random_uuid());
  END IF;
END $$;