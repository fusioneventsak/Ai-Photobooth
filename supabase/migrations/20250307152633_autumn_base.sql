/*
  # Add Model Type Support

  1. Changes
    - Add model_type column to configs table
    - Add video_duration column to configs table
    - Update existing config row
*/

ALTER TABLE configs 
ADD COLUMN model_type text NOT NULL DEFAULT 'image' CHECK (model_type IN ('image', 'video')),
ADD COLUMN video_duration integer NOT NULL DEFAULT 5 CHECK (video_duration >= 1 AND video_duration <= 5);

-- Update existing config
UPDATE configs SET model_type = 'image', video_duration = 5;