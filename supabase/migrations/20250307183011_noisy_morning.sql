/*
  # Add Provider Fallback Option to Configs Table

  1. Changes
     - Add new boolean column `use_provider_fallback` to `configs` table 
     - Default value set to false to avoid unexpected behavior

  This migration provides users with the ability to control whether 
  the system should attempt to use a secondary AI provider when the primary 
  provider fails.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'configs' AND column_name = 'use_provider_fallback'
  ) THEN
    ALTER TABLE configs ADD COLUMN use_provider_fallback BOOLEAN DEFAULT false;
  END IF;
END $$;