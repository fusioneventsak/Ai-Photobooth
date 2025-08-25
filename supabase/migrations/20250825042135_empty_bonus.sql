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
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create photos table for storing completed videos
CREATE TABLE IF NOT EXISTS photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  prompt TEXT,
  type TEXT NOT NULL DEFAULT 'video',
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table for user notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for photos/videos (will fail silently if exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Check if policies exist and create them conditionally
DO $$
BEGIN
    -- Create Public Access policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Public Access'
    ) THEN
        CREATE POLICY "Public Access" ON storage.objects 
        FOR SELECT USING (bucket_id = 'photos');
    END IF;

    -- Create Upload Access policy if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Upload Access'
    ) THEN
        CREATE POLICY "Upload Access" ON storage.objects 
        FOR INSERT WITH CHECK (bucket_id = 'photos');
    END IF;
END
$$;

-- Enable RLS on all tables
ALTER TABLE photo_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for photo_generations
CREATE POLICY "Users can view their own generations" ON photo_generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all generations" ON photo_generations
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for photos
CREATE POLICY "Users can view their own photos" ON photos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all photos" ON photos
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_photo_generations_user_id ON photo_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_photo_generations_prediction_id ON photo_generations(prediction_id);
CREATE INDEX IF NOT EXISTS idx_photo_generations_status ON photo_generations(status);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);