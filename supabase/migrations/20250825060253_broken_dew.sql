-- Fix model name mismatch between database and UI
-- This updates the database constraint and default to match the UI

-- Remove existing constraint
ALTER TABLE configs 
  DROP CONSTRAINT IF EXISTS replicate_video_model_check;

-- Add updated constraint that includes both hailuo and hailuo-2
ALTER TABLE configs 
  ADD CONSTRAINT replicate_video_model_check 
  CHECK (replicate_video_model IN (
    'hailuo-2',           -- Primary UI model name
    'hailuo',             -- Legacy database name  
    'wan-2.2',            -- Alibaba model
    'cogvideo',           -- CogVideo model
    'hunyuan-video',      -- Tencent model
    'stable-video-diffusion' -- Fallback
  ));

-- Update default to match UI
ALTER TABLE configs 
  ALTER COLUMN replicate_video_model SET DEFAULT 'hailuo-2';

-- Update existing 'hailuo' records to 'hailuo-2' for consistency
UPDATE configs 
SET replicate_video_model = 'hailuo-2' 
WHERE replicate_video_model = 'hailuo';

-- Verify the update
DO $$ 
DECLARE
    updated_count INTEGER;
BEGIN 
    SELECT COUNT(*) INTO updated_count FROM configs WHERE replicate_video_model = 'hailuo-2';
    RAISE NOTICE 'Migration complete: % configs now using hailuo-2', updated_count;
    RAISE NOTICE 'New default: hailuo-2 (matches Admin UI)';
END $$;