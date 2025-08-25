/*
  # Setup Video Storage with Subfolders

  1. Storage bucket setup
    - Ensure photos bucket exists and is public
    - Create storage policies for video subfolders
    
  2. Table updates
    - Add video-specific metadata fields
    - Update storage paths for video organization
    
  3. Real-time updates
    - Create gallery_updates table for real-time notifications
*/

-- Ensure photos bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos', 
  'photos', 
  true, 
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/mov', 'video/avi']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/mov', 'video/avi'];

-- Storage policies for public access to videos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Videos public access" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY "Videos public access" ON storage.objects  
  FOR INSERT WITH CHECK (bucket_id = 'photos');

CREATE POLICY "Service role can manage all files" ON storage.objects
  FOR ALL USING (auth.role() = 'service_role');

-- Update photos table to include video-specific fields
ALTER TABLE photos 
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_size_mb DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS original_url TEXT,
  ADD COLUMN IF NOT EXISTS processing_duration INTEGER;

-- Add indexes for video queries
CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(type);
CREATE INDEX IF NOT EXISTS idx_photos_created_desc ON photos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_storage_path ON photos(storage_path);

-- Create gallery_updates table for real-time notifications
CREATE TABLE IF NOT EXISTS gallery_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  prediction_id TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on gallery_updates
ALTER TABLE gallery_updates ENABLE ROW LEVEL SECURITY;

-- Policy for gallery_updates
CREATE POLICY "Public can read gallery updates" ON gallery_updates
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage gallery updates" ON gallery_updates
  FOR ALL USING (auth.role() = 'service_role');

-- Add indexes for gallery_updates
CREATE INDEX IF NOT EXISTS idx_gallery_updates_created ON gallery_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_updates_photo_id ON gallery_updates(photo_id);

-- Update existing photos to have storage_path
UPDATE photos 
SET storage_path = filename 
WHERE storage_path IS NULL AND filename IS NOT NULL;

-- Comment the tables
COMMENT ON TABLE photos IS 'Gallery photos and videos with organized storage paths';
COMMENT ON TABLE gallery_updates IS 'Real-time updates for gallery changes';
COMMENT ON COLUMN photos.storage_path IS 'Full storage path including subfolders (e.g., videos/kling-v1.6-pro/...)';
COMMENT ON COLUMN photos.file_size_mb IS 'File size in megabytes for display purposes';
COMMENT ON COLUMN photos.original_url IS 'Original Replicate URL before download';
COMMENT ON COLUMN photos.processing_duration IS 'Time in milliseconds from creation to completion';

-- Create notification for successful migration
DO $$
BEGIN
  RAISE NOTICE '✅ Video storage migration completed';
  RAISE NOTICE 'Videos will be organized in: photos/videos/{model_name}/{prediction_id}.mp4';
  RAISE NOTICE 'Storage bucket allows up to 50MB files';
  RAISE NOTICE 'Supported formats: MP4, MOV, AVI, JPEG, PNG, WebP';
END $$;