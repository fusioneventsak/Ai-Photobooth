/*
  # Update astronaut prompt with more details

  1. Changes
    - Update default value for global_prompt in configs table to include helmet and planets
    - Update existing records with the new detailed prompt
*/

-- Update existing records
UPDATE configs 
SET global_prompt = 'Create a stunning astronaut portrait with a reflective helmet visor and planets visible in the cosmic background' 
WHERE global_prompt = 'Create a stunning astronaut portrait in a cosmic environment';

-- Update default value for new records
ALTER TABLE configs 
ALTER COLUMN global_prompt 
SET DEFAULT 'Create a stunning astronaut portrait with a reflective helmet visor and planets visible in the cosmic background';