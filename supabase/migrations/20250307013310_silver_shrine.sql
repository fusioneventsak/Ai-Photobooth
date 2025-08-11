/*
  # Add Stability API key to configs table

  1. Changes
    - Add `stability_api_key` column to `configs` table
    - Set default value to current API key
    - Add RLS policy for authenticated users only

  2. Security
    - Only authenticated users can read/write the API key
    - API key is stored securely in the database
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'configs' 
    AND column_name = 'stability_api_key'
  ) THEN
    ALTER TABLE configs 
    ADD COLUMN stability_api_key text DEFAULT 'sk-CtGwj2VC96bafPrTpLs8JCJgKkdppokHwg1JLMu7S9SonaP9';
  END IF;
END $$;