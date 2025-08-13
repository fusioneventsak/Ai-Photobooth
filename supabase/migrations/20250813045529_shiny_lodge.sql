/*
  # Add ControlNet Settings to Configs Table

  1. Changes
    - Add use_controlnet boolean field (default: true)
    - Add controlnet_type text field (default: 'auto')
    - Add proper constraints for controlnet_type values
    - Update existing config row with new defaults
    
  2. New Fields
    - use_controlnet: boolean (enables/disables ControlNet)
    - controlnet_type: text (canny, depth, openpose, auto)
*/

-- Add ControlNet settings fields
DO $$ BEGIN
  -- Add use_controlnet if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'use_controlnet'
  ) THEN
    ALTER TABLE configs ADD COLUMN use_controlnet boolean DEFAULT true;
  END IF;

  -- Add controlnet_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'controlnet_type'
  ) THEN
    ALTER TABLE configs ADD COLUMN controlnet_type text DEFAULT 'auto';
    
    -- Add constraint for valid controlnet_type values
    ALTER TABLE configs ADD CONSTRAINT controlnet_type_check 
      CHECK (controlnet_type IN ('canny', 'depth', 'openpose', 'auto'));
  END IF;
END $$;

-- Update existing config row with new defaults
UPDATE configs SET 
  use_controlnet = COALESCE(use_controlnet, true),
  controlnet_type = COALESCE(controlnet_type, 'auto')
WHERE id IS NOT NULL;