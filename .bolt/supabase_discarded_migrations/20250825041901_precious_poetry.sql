/*
  # Create Async Video Generation Tables

  This migration creates the proper tables for async video generation that match
  the webhook expectations and adds the missing user_id tracking.

  ## New Tables
  1. **photo_generations** - Tracks async video generation requests
     - `id` (uuid, primary key)
     - `prediction_id` (text, unique) - Replicate prediction ID
     - `user_id` (uuid) - References auth.users for user-specific notifications
     - `prompt` (text) - Generation prompt
     - `model` (text) - Model used for generation
     - `status` (text) - processing/completed/failed
     - `type` (text) - content type (video/image)
     - `error_message` (text) - Error details if failed
     - `gallery_photo_id` (uuid) - Links to photos table when complete
     - `created_at` (timestamp)
     - `completed_at` (timestamp)

  2. **notifications** - User notifications for async operations
     - `id` (uuid, primary key)
     - `user_id` (uuid) - References auth.users
     - `type` (text) - notification type
     - `data` (jsonb) - notification payload
     - `read` (boolean) - read status
     - `created_at` (timestamp)

  ## Schema Updates
  - Adds missing columns to photos table for webhook compatibility
  - Creates storage policies for public access
  - Enables RLS on all tables

  ## Security
  - Enable RLS on all new tables
  - Add policies for authenticated users to manage their own data
  - Public read access for completed photos/videos
*/

-- Create photo_generations table for tracking async video generation
CREATE TABLE IF NOT EXISTS photo_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  type TEXT NOT NULL DEFAULT 'video',
  error_message TEXT,
  gallery_photo_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_status CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT valid_type CHECK (type IN ('image', 'video'))
);

-- Create notifications table for user notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_notification_type CHECK (type IN ('video_generated', 'generation_failed', 'image_generated'))
);

-- Add missing columns to photos table for webhook compatibility
-- Check if columns exist before adding them
DO $$
BEGIN
  -- Add filename column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'photos' AND column_name = 'filename'
  ) THEN
    ALTER TABLE photos ADD COLUMN filename TEXT;
  END IF;
  
  -- Add url column if it doesn't exist  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'photos' AND column_name = 'url'
  ) THEN
    ALTER TABLE photos ADD COLUMN url TEXT;
  END IF;
  
  -- Add type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'photos' AND column_name = 'type'
  ) THEN
    ALTER TABLE photos ADD COLUMN type TEXT DEFAULT 'image';
  END IF;
  
  -- Add user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'photos' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE photos ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
  
  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'photos' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE photos ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_photo_generations_prediction_id ON photo_generations(prediction_id);
CREATE INDEX IF NOT EXISTS idx_photo_generations_user_id ON photo_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_generations_status ON photo_generations(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(type);

-- Create storage bucket for photos/videos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE photo_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for photo_generations
CREATE POLICY "Users can view their own generations" ON photo_generations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations" ON photo_generations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generations" ON photo_generations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Allow service role to insert notifications (for webhooks)
CREATE POLICY "Service role can insert notifications" ON notifications
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Allow service role to manage photo_generations (for webhooks)
CREATE POLICY "Service role can manage photo_generations" ON photo_generations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Storage policies for photos bucket
CREATE POLICY IF NOT EXISTS "Public Access" ON storage.objects 
  FOR SELECT USING (bucket_id = 'photos');

CREATE POLICY IF NOT EXISTS "Authenticated Upload Access" ON storage.objects 
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');

CREATE POLICY IF NOT EXISTS "Service Role Upload Access" ON storage.objects 
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'photos');

-- Update existing photos to have compatible data
-- Set url = processed_url where url is null and processed_url exists
UPDATE photos 
SET url = processed_url 
WHERE url IS NULL AND processed_url IS NOT NULL;

-- Set type = content_type where type is null and content_type exists
UPDATE photos 
SET type = content_type 
WHERE type IS NULL AND content_type IS NOT NULL;

-- Set filename from url if filename is null
UPDATE photos 
SET filename = COALESCE(
  regexp_replace(url, '^.*/([^/]+)$', '\1'),
  'photo_' || id::text
)
WHERE filename IS NULL AND url IS NOT NULL;