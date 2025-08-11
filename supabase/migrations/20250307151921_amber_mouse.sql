/*
  # Create configs table

  1. New Tables
    - `configs`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz)
      - `brand_name` (text, default: 'Virtual Photobooth')
      - `brand_logo_url` (text, nullable)
      - `primary_color` (text, default: '#3B82F6')
      - `secondary_color` (text, default: '#6B7280')
      - `global_prompt` (text, default prompt for AI image generation)
      - `gallery_animation` (gallery_animation_type enum)
      - `gallery_speed` (integer, default: 3000)
      - `gallery_layout` (gallery_layout_type enum)
      - `stability_api_key` (text, nullable)

  2. Types
    - Use existing enum types for gallery animation and layout options

  3. Constraints
    - Color format validation using regex
    - Gallery speed range validation (500-10000ms)
    - Single row enforcement using trigger

  4. Security
    - Enable RLS
    - Allow public read access
    - Allow authenticated users to update
*/

-- Create configs table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS configs (
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
    
    -- Add constraints
    CONSTRAINT valid_color_primary CHECK (primary_color ~* '^#[0-9A-F]{6}$'),
    CONSTRAINT valid_color_secondary CHECK (secondary_color ~* '^#[0-9A-F]{6}$'),
    CONSTRAINT gallery_speed_range CHECK (gallery_speed >= 500 AND gallery_speed <= 10000)
  );
END $$;

-- Create function to ensure only one config row exists
CREATE OR REPLACE FUNCTION ensure_single_config_row()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM configs) > 0 THEN
    RAISE EXCEPTION 'Only one config row is allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DO $$ BEGIN
  DROP TRIGGER IF EXISTS ensure_single_config_row ON configs;
  CREATE TRIGGER ensure_single_config_row
    BEFORE INSERT ON configs
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_config_row();
END $$;

-- Enable RLS
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and create new ones
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read access to configs" ON configs;
  DROP POLICY IF EXISTS "Allow authenticated users to update configs" ON configs;
  
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
END $$;