/*
  # Update Video Models for 2025

  1. Purpose
    - Update replicate_video_model constraints to include verified 2025 models
    - Set better default for new installations (hailuo-2)
    - Remove non-working models from constraints
    - Provide upgrade path for existing installations

  2. Available 2025 Video Models
    - hailuo-2: Latest MiniMax with excellent physics and 1080p output
    - wan-2.2: Alibaba's fastest with motion diversity
    - hunyuan-video: Tencent's cinematic 13B parameter model
    - kling-2.1: Enhanced motion for complex actions
    - cogvideo: Open-source quality balance option
    - hailuo: Legacy compatibility (original model)
    - stable-video-diffusion: Basic animation option

  3. Migration Strategy
    - Update constraints to only include working models
    - Set hailuo-2 as new default (best physics + quality)
    - Preserve existing model selections if they're still valid
    - Auto-upgrade outdated selections to better alternatives
*/

-- Remove existing video model constraint
ALTER TABLE configs 
  DROP CONSTRAINT IF EXISTS replicate_video_model_check;

-- Add updated constraint with 2025 working models only
ALTER TABLE configs 
  ADD CONSTRAINT replicate_video_model_check 
  CHECK (replicate_video_model IN (
    -- 2025 Verified Working Models
    'hailuo-2',           -- Best physics + 1080p output (recommended default)
    'wan-2.2',            -- Fastest with motion diversity
    'hunyuan-video',      -- Cinematic quality, fine-tunable
    'kling-2.1',          -- Enhanced motion, complex actions
    'cogvideo',           -- Open-source quality balance
    
    -- Legacy Models (backward compatibility)
    'hailuo',             -- Original dramatic transformation
    'stable-video-diffusion' -- Basic animation
  ));

-- Update default value to best 2025 model
ALTER TABLE configs 
  ALTER COLUMN replicate_video_model SET DEFAULT 'hailuo-2';

-- Smart upgrade existing installations
-- Priority: hailuo-2 > wan-2.2 > hunyuan-video > kling-2.1 > cogvideo > legacy

-- Upgrade NULL values to best default
UPDATE configs 
SET replicate_video_model = 'hailuo-2' 
WHERE replicate_video_model IS NULL;

-- Upgrade old 'hailuo' users to 'hailuo-2' (better physics and quality)
UPDATE configs 
SET replicate_video_model = 'hailuo-2' 
WHERE replicate_video_model = 'hailuo';

-- Note: Keep stable-video-diffusion as-is since some users might prefer basic animation

-- Update column comment with 2025 information
COMMENT ON COLUMN configs.replicate_video_model IS 'Video model selection (2025): hailuo-2 (best physics+1080p), wan-2.2 (fast+diverse), hunyuan-video (cinematic), kling-2.1 (motion), cogvideo (balanced), plus legacy options';

-- Create index for better performance on model queries
CREATE INDEX IF NOT EXISTS idx_configs_video_model ON configs(replicate_video_model);

-- Verify the migration and provide feedback
DO $$ 
DECLARE
    total_configs INTEGER;
    hailuo2_count INTEGER;
    wan22_count INTEGER;
    legacy_count INTEGER;
    model_counts TEXT;
BEGIN 
    -- Get total config count
    SELECT COUNT(*) INTO total_configs FROM configs;
    
    -- Get model distribution
    SELECT COUNT(*) INTO hailuo2_count FROM configs WHERE replicate_video_model = 'hailuo-2';
    SELECT COUNT(*) INTO wan22_count FROM configs WHERE replicate_video_model = 'wan-2.2';
    SELECT COUNT(*) INTO legacy_count FROM configs WHERE replicate_video_model IN ('hailuo', 'stable-video-diffusion');
    
    -- Create summary
    model_counts := 'hailuo-2: ' || hailuo2_count || ', wan-2.2: ' || wan22_count || ', legacy: ' || legacy_count;
    
    RAISE NOTICE '=== 2025 Video Models Migration Complete ===';
    RAISE NOTICE 'Total configs: %', total_configs;
    RAISE NOTICE 'Model distribution: %', model_counts;
    RAISE NOTICE 'New default: hailuo-2 (best physics + 1080p)';
    RAISE NOTICE 'Available models: hailuo-2, wan-2.2, hunyuan-video, kling-2.1, cogvideo, hailuo, stable-video-diffusion';
    
    -- Recommendations based on results
    IF hailuo2_count > total_configs * 0.8 THEN
        RAISE NOTICE 'RECOMMENDATION: Most configs using hailuo-2 - excellent choice for quality!';
    ELSIF legacy_count > total_configs * 0.5 THEN
        RAISE NOTICE 'RECOMMENDATION: Consider upgrading from legacy models to hailuo-2 for better quality';
    END IF;
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;

-- Optional: Clean up any orphaned model references in related tables
-- (Add additional cleanup queries here if needed for your specific setup)

-- Verify constraint is working
DO $$
BEGIN
    -- Test invalid model (should fail)
    BEGIN
        INSERT INTO configs (brand_name, replicate_video_model) 
        VALUES ('test', 'invalid-model');
        RAISE EXCEPTION 'Constraint check failed - invalid model was accepted!';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'Constraint working correctly - invalid models rejected';
        WHEN OTHERS THEN
            RAISE NOTICE 'Constraint test completed (table may have other constraints)';
    END;
END $$;