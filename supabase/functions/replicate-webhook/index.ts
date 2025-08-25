      console.log('✅ Video uploaded to storage successfully:', filename);

      // Create gallery entry
      const { data: photoData, error: photoError } = await supabase.from('photos').insert({
        filename: filename,
        url: publicUrl,
        prompt: generation?.prompt || 'AI Generated Video',
        type: 'video',
        user_id: generation?.user_id,
        metadata: {
          model: generation?.model || 'unknown',
          prediction_id: predictionId,
          file_size: videoBlob.size,
          format: 'mp4',
          duration: 5
        }
      }).select().single();

      if (photoError) {
        console.error('❌ Failed to create gallery entry:', photoError);
@@ .. @@
        throw new Error(`Failed to create gallery entry: ${photoError.message}`);
      }

      console.log('✅ Gallery entry created:', photoData.id);

      // Update generation record with gallery photo ID
      const { error: updateError } = await supabase
        .from('photo_generations')
        .update({ 
          status: 'completed',
          gallery_photo_id: photoData.id,
          completed_at: new Date().toISOString()
        })
        .eq('prediction_id', predictionId);

      if (updateError) {
        console.error('❌ Failed to update generation record:', updateError);
      }

      // Create success notification for the user
      if (generation?.user_id) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: generation.user_id,
          type: 'video_generated',
          title: 'Video Ready!',
          message: 'Your AI-generated video is ready to view in the gallery.',
          data: {
            prediction_id: predictionId,
            photo_id: photoData.id,
            model: generation.model,
            prompt: generation.prompt
          }
        });

        if (notificationError) {
          console.error('❌ Failed to create success notification:', notificationError);
        } else {
          console.log('✅ Success notification created for user:', generation.user_id);
        }
      }

      console.log('🎉 Webhook processing completed successfully');
      
      return new Response(JSON.stringify({ 
@@ .. @@
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } else if (status === 'failed' || status === 'canceled') {
      console.log(`❌ Generation ${status}:`, predictionId);
      
      // Update generation record with error
      const errorMessage = prediction.error || `Generation ${status}`;
      const { error: updateError } = await supabase
        .from('photo_generations')
        .update({ 
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('prediction_id', predictionId);

      if (updateError) {
        console.error('❌ Failed to update generation record:', updateError);
      }

      // Create failure notification for the user
      if (generation?.user_id) {
        const { error: notificationError } = await supabase.from('notifications').insert({
          user_id: generation.user_id,
          type: 'generation_failed',
          title: 'Video Generation Failed',
          message: `Your video generation failed: ${errorMessage}`,
          data: {
            prediction_id: predictionId,
            error: errorMessage,
            model: generation?.model,
            prompt: generation?.prompt
          }
        });

        if (notificationError) {
          console.error('❌ Failed to create failure notification:', notificationError);
        } else {
          console.log('✅ Failure notification created for user:', generation.user_id);
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Generation ${status}`,