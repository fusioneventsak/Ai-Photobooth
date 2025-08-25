import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReplicateRequest {
  prompt: string
  model: string
  duration?: number
  resolution?: string
  first_frame_image?: string
}

// Model mapping from frontend names to Replicate model versions
const MODEL_MAPPING = {
  'hailuo-2': {
    version: 'minimax/hailuo-02',
    maxDuration: 10,
    allowedDurations: [6, 10],
    defaultResolution: '1080p'
  },
  'hailuo': {
    version: 'minimax/video-01', 
    maxDuration: 6,
    allowedDurations: [6],
    defaultResolution: '1080p'
  },
  'wan-2.2': {
    version: 'alibaba-pai/emo-2',
    maxDuration: 8,
    allowedDurations: [3, 5, 8],
    defaultResolution: '720p'
  },
  'cogvideo': {
    version: 'thudm/cogvideox-5b',
    maxDuration: 8,
    allowedDurations: [2, 4, 6, 8],
    defaultResolution: '720p'
  },
  'hunyuan-video': {
    version: 'tencent/hunyuan-video',
    maxDuration: 5,
    allowedDurations: [2, 5],
    defaultResolution: '720p'
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get API key from environment
    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY')
    if (!REPLICATE_API_KEY) {
      console.error('❌ REPLICATE_API_KEY not found in environment')
      return new Response(
        JSON.stringify({ error: 'API configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Replicate API key found, length:', REPLICATE_API_KEY.length)

    // Get Supabase URL for webhook
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    if (!SUPABASE_URL) {
      console.error('❌ SUPABASE_URL not found in environment')
      return new Response(
        JSON.stringify({ error: 'Webhook configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const body: ReplicateRequest = await req.json()
    const { 
      prompt, 
      model = 'hailuo-2',
      duration = 6,
      resolution = '1080p',
      first_frame_image
    } = body

    // Validate required fields
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: prompt' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Using model:', model, '→', MODEL_MAPPING[model]?.version || 'unknown')

    // Get model configuration
    const modelConfig = MODEL_MAPPING[model]
    if (!modelConfig) {
      return new Response(
        JSON.stringify({ error: `Unsupported model: ${model}` }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate and adjust duration for the specific model
    let validDuration = duration
    if (modelConfig.allowedDurations && !modelConfig.allowedDurations.includes(duration)) {
      // Find closest allowed duration
      validDuration = modelConfig.allowedDurations.reduce((prev, curr) => 
        Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
      )
      console.log(`⚠️ Duration adjusted from ${duration}s to ${validDuration}s for model ${model}`)
    }

    // Construct webhook URL
    const webhookUrl = `${SUPABASE_URL}/functions/v1/replicate-webhook`
    console.log('Webhook URL configured:', webhookUrl)

    // Prepare model input based on the specific model
    let modelInput: any = {
      prompt: prompt,
      duration: validDuration,
      resolution: resolution || modelConfig.defaultResolution,
      prompt_optimizer: false
    }

    // Add first frame image if provided (for face preservation)
    if (first_frame_image && first_frame_image.startsWith('data:image/')) {
      modelInput.first_frame_image = first_frame_image
    }

    console.log('Prediction payload:', {
      version: modelConfig.version,
      input: {
        ...modelInput,
        first_frame_image: first_frame_image ? `${first_frame_image.substring(0, 50)}...` : undefined
      }
    })

    // Create prediction with webhook
    const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: modelConfig.version,
        input: modelInput,
        webhook: webhookUrl,
        webhook_events_filter: ["start", "completed"]
      })
    })

    if (!predictionResponse.ok) {
      const errorText = await predictionResponse.text()
      console.error(`❌ Replicate API error (${predictionResponse.status}):`, errorText)
      
      let errorMessage = 'Video generation failed'
      if (predictionResponse.status === 401) {
        errorMessage = 'Invalid Replicate API key'
      } else if (predictionResponse.status === 402) {
        errorMessage = 'Insufficient Replicate credits'
      } else if (predictionResponse.status === 429) {
        errorMessage = 'Rate limit exceeded'
      } else if (predictionResponse.status === 400) {
        errorMessage = 'Invalid request parameters'
      }

      return new Response(
        JSON.stringify({ error: errorMessage, details: errorText }),
        { 
          status: predictionResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const prediction = await predictionResponse.json()
    console.log('Prediction created:', {
      id: prediction.id,
      status: prediction.status,
      model: modelConfig.version
    })

    // Initialize Supabase client to create generation record
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Create generation tracking record
    const { error: insertError } = await supabase
      .from('photo_generations')
      .insert({
        prediction_id: prediction.id,
        prompt: prompt,
        model: model,
        status: 'processing'
      })

    if (insertError) {
      console.error('❌ Failed to create generation record:', insertError)
      // Don't fail the request if logging fails, but log the error
    } else {
      console.log('✅ Generation record created for prediction:', prediction.id)
    }

    // Return immediately with prediction ID (async operation)
    return new Response(
      JSON.stringify({ 
        success: true,
        predictionId: prediction.id,
        status: 'processing',
        message: `Video generation started with ${model}. You'll be notified when ready!`,
        model: modelConfig.version,
        estimatedDuration: `${validDuration} seconds`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})