/*
  # Add video support to photos table

  1. Changes
    - Add `content_type` column to distinguish between images and videos
    - Add `duration` column for video length
    - Add `thumbnail_url` column for video previews
    - Update RLS policies to handle video content

  2. Security
    - Maintain existing RLS policies
    - Add new policies for video-specific operations
*/

-- Add new columns for video support
ALTER TABLE photos 
ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'image'
CHECK (content_type IN ('image', 'video')),
ADD COLUMN IF NOT EXISTS duration integer,
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD CONSTRAINT valid_duration 
CHECK (
  (content_type = 'video' AND duration BETWEEN 1 AND 5) OR
  (content_type = 'image' AND duration IS NULL)
);

-- Create index for content type queries
CREATE INDEX IF NOT EXISTS idx_photos_content_type 
ON photos(content_type);

-- Update RLS policies to handle video content
CREATE POLICY "Allow public read access to video content"
ON photos
FOR SELECT
TO public
USING (
  public = true AND 
  content_type = 'video'
);

COMMENT ON TABLE photos IS 'Stores both image and video content with type-specific metadata';