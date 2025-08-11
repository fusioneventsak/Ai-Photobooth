/*
  # Update storage and RLS policies

  1. Storage
    - Create photos storage bucket if it doesn't exist
    - Set up storage policies for public access

  2. Table Security
    - Update RLS policies for photos table
    - Allow public access for inserts and selects
*/

DO $$ 
BEGIN
  -- Create storage bucket for photos if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'photos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('photos', 'photos', true);
  END IF;
END $$;

-- Drop existing storage policies if they exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public uploads'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public downloads'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
  END IF;
END $$;

-- Create storage policies
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'photos'
  AND owner IS NULL
);

CREATE POLICY "Allow public downloads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'photos');

-- Update photos table policies
DROP POLICY IF EXISTS "Allow public users to insert photos" ON photos;
DROP POLICY IF EXISTS "Allow public users to read public photos" ON photos;
DROP POLICY IF EXISTS "Allow public users to update photos" ON photos;
DROP POLICY IF EXISTS "Allow public users to delete photos" ON photos;

-- Enable RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Enable insert for public"
ON photos
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Enable select for public photos"
ON photos
FOR SELECT
TO public
USING (public = true);

CREATE POLICY "Enable update for public"
ON photos
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for public"
ON photos
FOR DELETE
TO public
USING (true);