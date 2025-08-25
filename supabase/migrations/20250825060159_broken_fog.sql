/*
  # Fix model name mismatch between database and UI

  This migration resolves the inconsistency between the Admin UI (which uses 'hailuo-2') 
  and the database constraint (which only allowed 'hailuo').

  ## Changes Made:
  1. **Updated Constraint**: Expanded replicate_video_model_check to include both 'hailuo' and 'hailuo-2'
  2. **New Default**: Changed default from 'hailuo' to 'hailuo-2' to match Admin UI
  3. **Data Migration**: Updated existing 'hailuo' records to 'hailuo-2' for consistency
  4. **Model Support**: Added all current video models including new ones

  ## Supported Models After Migration:
  - hailuo-2 (Primary - matches Admin UI)
  - hailuo (Legacy compatibility)
  - wan-2.2 (Alibaba fast model)
  - cogvideo (CogVideoX-5B)
  - hunyuan-video (Tencent model)
  - stable-video-diffusion (Fallback)

  ## Impact:
  - Existing configs will be updated to use 'hailuo-2'
  - New configs will default to 'hailuo-2'
  - Admin UI and database will be in sync
*/

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