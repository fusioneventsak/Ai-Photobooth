/*
  # Add Photo Generation Tracking

  1. New Tables
    - `photo_generations`
      - `id` (uuid, primary key)
      - `prediction_id` (text, unique) - Replicate prediction ID
      - `prompt` (text) - Generation prompt
      - `model` (text) - Model used for generation
      - `status` (text) - processing/completed/failed
      - `gallery_photo_id` (uuid) - Reference to final photo
      - `error_message` (text) - Error details if failed
      - `created_at` (timestamp)
      - `completed_at` (timestamp)
    
    - `gallery_updates`
      - `id` (uuid, primary key)
      - `action` (text) - Type of update
      - `photo_id` (uuid) - Reference to photo
      - `prediction_id` (text) - Reference to prediction
      - `message` (text) - Update message
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for public access (matching existing pattern)
    - Add indexes for performance
*/

-- Track ongoing generations
CREATE TABLE photo_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id TEXT UNIQUE NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  gallery_photo_id UUID REFERENCES photos(id),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Real-time notifications for frontend
CREATE TABLE gallery_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  photo_id UUID REFERENCES photos(id),
  prediction_id TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE photo_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_updates ENABLE ROW LEVEL SECURITY;

-- Add policies for public access (matching existing pattern)
CREATE POLICY "Photo generations public access"
  ON photo_generations
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Gallery updates public access"
  ON gallery_updates
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_photo_generations_prediction_id ON photo_generations(prediction_id);
CREATE INDEX idx_photo_generations_status ON photo_generations(status);
CREATE INDEX idx_photo_generations_created_at ON photo_generations(created_at DESC);
CREATE INDEX idx_gallery_updates_created_at ON gallery_updates(created_at DESC);
CREATE INDEX idx_gallery_updates_photo_id ON gallery_updates(photo_id);