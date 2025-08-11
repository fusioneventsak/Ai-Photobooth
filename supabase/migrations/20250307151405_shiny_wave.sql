/*
  # Update prompt to preserve facial features

  1. Changes
    - Update default value for global_prompt in configs table to include face preservation
    - Update existing records with the new prompt that preserves facial features
*/

-- Update existing records
UPDATE configs 
SET global_prompt = 'Create a stunning astronaut portrait with a reflective helmet visor and planets visible in the cosmic background, preserve all facial features and expressions exactly as they are in the original photo';

-- Update default value for new records
ALTER TABLE configs 
ALTER COLUMN global_prompt 
SET DEFAULT 'Create a stunning astronaut portrait with a reflective helmet visor and planets visible in the cosmic background, preserve all facial features and expressions exactly as they are in the original photo';