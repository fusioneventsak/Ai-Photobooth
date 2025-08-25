@@ .. @@
-- Add indexes for video queries
-CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(type);
+CREATE INDEX IF NOT EXISTS idx_photos_content_type ON photos(content_type);
 CREATE INDEX IF NOT EXISTS idx_photos_created_desc ON photos(created_at DESC);
 CREATE INDEX IF NOT EXISTS idx_photos_storage_path ON photos(storage_path);