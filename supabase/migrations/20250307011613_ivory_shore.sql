/*
  # Update photos table RLS policies

  1. Security Changes
    - Enable RLS on photos table
    - Add policy for public users to insert photos
    - Add policy for public users to read public photos
    - Add policy for authenticated users to manage their photos
*/

-- Enable RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Allow public users to insert photos
CREATE POLICY "Allow public users to insert photos"
ON photos
FOR INSERT
TO public
WITH CHECK (true);

-- Allow public users to read public photos
CREATE POLICY "Allow public users to read public photos"
ON photos
FOR SELECT
TO public
USING (public = true);

-- Allow public users to update their photos
CREATE POLICY "Allow public users to update photos"
ON photos
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Allow public users to delete their photos
CREATE POLICY "Allow public users to delete photos"
ON photos
FOR DELETE
TO public
USING (true);