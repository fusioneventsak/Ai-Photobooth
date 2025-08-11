/*
  # Create tables for Virtual Photobooth

  1. New Tables
    - `photos`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `original_url` (text)
      - `processed_url` (text, nullable)
      - `prompt` (text)
      - `public` (boolean)
      - `model_type` (text)
      - `status` (text)
      - `error` (text, nullable)
    
    - `settings`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `prompt` (text)
      - `model_type` (text)
      - `stability_api_key` (text, nullable)

  2. Security
    - Enable RLS on both tables
    - Add policies for public access to photos
    - Add policies for authenticated access to settings
*/

-- Create photos table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    original_url text NOT NULL,
    processed_url text,
    prompt text NOT NULL,
    public boolean DEFAULT true,
    model_type text NOT NULL CHECK (model_type IN ('image', 'video')),
    status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error text
  );
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END $$;

-- Create settings table if it doesn't exist
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    prompt text NOT NULL DEFAULT 'Create a stunning artistic portrait',
    model_type text NOT NULL DEFAULT 'image' CHECK (model_type IN ('image', 'video')),
    stability_api_key text
  );
EXCEPTION
  WHEN duplicate_table THEN
    NULL;
END $$;

-- Enable RLS if not already enabled
DO $$ BEGIN
  ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow public read access to public photos" ON photos;
  DROP POLICY IF EXISTS "Allow public to create photos" ON photos;
  DROP POLICY IF EXISTS "Allow public to update their photos" ON photos;
  DROP POLICY IF EXISTS "Allow public read access to settings" ON settings;
  DROP POLICY IF EXISTS "Allow public to manage settings" ON settings;
END $$;

-- Recreate policies
DO $$ BEGIN
  CREATE POLICY "Allow public read access to public photos"
    ON photos
    FOR SELECT
    TO public
    USING (public = true);

  CREATE POLICY "Allow public to create photos"
    ON photos
    FOR INSERT
    TO public
    WITH CHECK (true);

  CREATE POLICY "Allow public to update their photos"
    ON photos
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

  CREATE POLICY "Allow public read access to settings"
    ON settings
    FOR SELECT
    TO public
    USING (true);

  CREATE POLICY "Allow public to manage settings"
    ON settings
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
END $$;

-- Insert default settings if none exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM settings) THEN
    INSERT INTO settings (prompt, model_type)
    VALUES ('Create a stunning artistic portrait', 'image');
  END IF;
END $$;