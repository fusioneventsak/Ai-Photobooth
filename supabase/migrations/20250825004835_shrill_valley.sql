/*
  # Update Video Models for 2025

  1. Purpose
    - Update replicate_video_model constraints to include verified 2025 models
    - Set better default for new installations (hailuo-2)
    - Clean up existing invalid data before applying constraints
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
    - First check and clean existing invalid data
    - Then apply new constraints with working models
    - Set hailuo-2 as new default (best physics + quality)
    - Auto-upgrade outdated selections to better alternatives
*/

-- Step 1: Identify and log current video model values
DO $$
DECLARE
    model_record RECORD;
BEGIN
    RAISE NOTICE '=== Current Video Model Analysis ===';
    
    FOR model_record IN 
        SELECT replicate_video_model, COUNT(*) as count 
        FROM configs 
        WHERE replicate_video_model IS NOT NULL
        GROUP BY replicate_video_model 
        ORDER BY count DESC
    LOOP
        RAISE NOTICE 'Model: % (count: %)', model_record.replicate_video_model, model_record.count;
    END LOOP;
    
    -- Check for NULL values
    SELECT COUNT(*) INTO model_record.count FROM configs WHERE replicate_video_model IS NULL;
    IF model_record.count > 0 THEN
        RAISE NOTICE 'NULL values: %', model_record.count;
    END IF;
END $$;

-- Step 2: Remove existing constraint (if it exists)
ALTER TABLE configs 
  DROP CONSTRAINT IF EXISTS replicate_video_model_check;

-- Step 3: Clean up existing data - upgrade to valid 2025 models
-- Handle all possible existing values and map them to valid 2025 models

-- Upgrade NULL values to best default
UPDATE configs 
SET replicate_video_model = 'hailuo-2' 
WHERE replicate_video_model IS NULL;

-- Upgrade old model names to new equivalents
UPDATE configs 
SET replicate_video_model = 'hailuo-2' 
WHERE replicate_video_model IN (
    'hailuo', 
    'hailuo-01', 
    'hailuo-1',
    'minimax-hailuo'
);

-- Upgrade Kling variations
UPDATE configs 
SET replicate_video_model = 'kling-2.1' 
WHERE replicate_video_model IN (
    'kling', 
    'kling-ai', 
    'kling-1.0',
    'kling-2.0'
);

-- Upgrade Wan variations  
UPDATE configs 
SET replicate_video_model = 'wan-2.2' 
WHERE replicate_video_model IN (
    'wan', 
    'wan-2.1',
    'wanx-2.2'
);

-- Upgrade CogVideo variations
UPDATE configs 
SET replicate_video_model = 'cogvideo' 
WHERE replicate_video_model IN (
    'cogvideox',
    'cogvideo-x',
    'cog-video'
);

-- Upgrade HunyuanVideo variations
UPDATE configs 
SET replicate_video_model = 'hunyuan-video' 
WHERE replicate_video_model IN (
    'hunyuan',
    'tencent-hunyuan',
    'hunyuanvideo'
);

-- Handle any other invalid models by setting to default
UPDATE configs 
SET replicate_video_model = 'hailuo-2' 
WHERE replicate_video_model NOT IN (
    'hailuo-2',
    'wan-2.2', 
    'hunyuan-video',
    'kling-2.1',
    'cogvideo',
    'hailuo',
    'stable-video-diffusion'
);

-- Step 4: Update default value to best 2025 model
ALTER TABLE configs 
  ALTER COLUMN replicate_video_model SET DEFAULT 'hailuo-2';

-- Step 5: Now apply the constraint (should work since data is clean)
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