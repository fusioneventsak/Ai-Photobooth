/*
  # Add face preservation mode to configs table

  1. Changes
    - Add face_preservation_mode column to configs table
    - Set default value to 'preserve_face'
    - Add check constraint to ensure valid values
*/

-- Add the face_preservation_mode column
ALTER TABLE configs 
ADD COLUMN face_preservation_mode TEXT DEFAULT 'preserve_face';

-- Add check constraint to ensure only valid values
ALTER TABLE configs 
ADD CONSTRAINT face_preservation_mode_check 
CHECK (face_preservation_mode IN ('preserve_face', 'replace_face'));

-- Update existing records to have the default value
UPDATE configs 
SET face_preservation_mode = 'preserve_face' 
WHERE face_preservation_mode IS NULL;