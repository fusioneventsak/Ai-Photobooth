@@ .. @@
       // Create gallery entry
-      const { data: photoData, error: photoError } = await supabase.from('photos').insert({
-        original_url: publicUrl,
-        processed_url: publicUrl,
-        prompt: generation?.prompt || 'AI Generated Video',
-        content_type: 'video',
-        public: true,
-        duration: 5 // Default duration since we don't get exact duration from Replicate
-      }).select().single();
+      const { data: photoData, error: photoError } = await supabase.from('photos').insert({
+        filename: filename,
+        url: publicUrl,
+        original_url: publicUrl, // Keep compatibility with existing schema
+        processed_url: publicUrl, // Keep compatibility with existing schema
+        prompt: generation?.prompt || 'AI Generated Video',
+        type: 'video',
+        content_type: 'video', // Keep compatibility with existing schema
+        public: true,
+        user_id: generation?.user_id || null,
+        metadata: {
+          model: generation?.model || 'unknown',
+          prediction_id: predictionId,
+          file_size: videoBlob.size,
+          format: 'mp4'
+        },
+        duration: 5 // Default duration since we don't get exact duration from Replicate
+      }).select().single();