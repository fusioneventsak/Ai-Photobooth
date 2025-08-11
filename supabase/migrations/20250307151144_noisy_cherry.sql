/*
  # Update default prompt to astronaut theme

  1. Changes
    - Update default value for global_prompt in configs table
    - Update existing records to use new default prompt
*/

-- Update existing records
UPDATE configs 
SET global_prompt = 'Create a stunning astronaut portrait in a cosmic environment' 
WHERE global_prompt = 'Create a stunning artistic portrait';

-- Update default value for new records
ALTER TABLE configs 
ALTER COLUMN global_prompt 
SET DEFAULT 'Create a stunning astronaut portrait in a cosmic environment';