import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ReplicateRequest {
  prompt: string
  inputData: string
  type: 'image' | 'video'
  duration?: number
  preserveFace?: boolean
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
      console.error('REPLICATE_API_KEY not found in environment')
      return new Response(
        JSON.stringify({ error: 'API configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get Supabase URL for webhook
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    if (!SUPABASE_URL) {
      console.error('SUPABASE_URL not found in environment')
      return new Response(
        JSON.stringify({ error: 'Webhook configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    // Parse request body
    const body: ReplicateRequest = await req.json()
    const { 
      prompt, 
      inputData, 
      type, 
      duration = 5, 
      preserveFace = true 
    } = body

    // Validate required fields
    if (!prompt || !inputData || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: prompt, inputData, and type' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Starting Replicate ${type} generation...`)

    // Upload input data to Replicate
    const uploadUrl = await uploadToReplicate(inputData, REPLICATE_API_KEY)
    
    // Construct webhook URL
    const webhookUrl = `${SUPABASE_URL}/functions/v1/replicate-webhook`
    console.log('Webhook URL configured:', webhookUrl)
    
    let modelVersion: string
    let modelInput: any

    if (type === 'video') {
      // Use Stable Video Diffusion for video generation
      modelVersion = "stability-ai/stable-video-diffusion:3f0457e4619daac51203dedb1a4c069b4bb91bc25be5667a0b525e63c21e2257"
      modelInput = {
        cond_aug: 0.02,
        decoding_t: 14,
        video_length: "14_frames_with_svd",
        sizing_strategy: "maintain_aspect_ratio",
        motion_bucket_id: 127,
        frames_per_second: 6,
        image: uploadUrl
      }
    } else {
      // Use FLUX for image generation
      modelVersion = "black-forest-labs/flux-schnell:bf2f717ca755455c3a0b80a3c0dbfbc1c3f2b79b18b9a60e1b02cbed0b8f8c33"
      modelInput = {
        image: uploadUrl,
        prompt: prompt,
        strength: preserveFace ? 0.5 : 0.7,
        num_inference_steps: 4,
        guidance_scale: 0,
        output_format: "png",
        output_quality: 95,
        seed: Math.floor(Math.random() * 2147483647)
      }
    }

    // Create prediction
    const predictionResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: modelVersion,
        input: modelInput,
        webhook: webhookUrl,
        webhook_events_filter: ["start", "completed"]
      })
    })

    if (!predictionResponse.ok) {
      const errorText = await predictionResponse.text()
      console.error(`Replicate API error (${predictionResponse.status}):`, errorText)
      
      let errorMessage = `${type} generation failed`
      if (predictionResponse.status === 401) {
        errorMessage = 'Invalid Replicate API key'
      } else if (predictionResponse.status === 402) {
        errorMessage = 'Insufficient Replicate credits'
      } else if (predictionResponse.status === 429) {
        errorMessage = 'Rate limit exceeded'
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
    console.log('Prediction created:', prediction.id)

    // Wait for prediction to complete
    const result = await waitForPrediction(prediction.id, REPLICATE_API_KEY)
    
    if (!result.output) {
      throw new Error('No output from Replicate model')
    }

    // Download and process result
    let finalResult: string
    
    if (type === 'video') {
      // For video, create blob URL
      const videoResponse = await fetch(result.output)
      if (!videoResponse.ok) {
        throw new Error('Failed to download video')
      }
      
      const videoBlob = await videoResponse.blob()
      finalResult = URL.createObjectURL(videoBlob)
    } else {
      // For image, convert to base64
      const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error('Failed to download image')
      }
      
      const imageBuffer = await imageResponse.arrayBuffer()
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))
      finalResult = `data:image/png;base64,${base64Image}`
    }

    console.log(`Replicate ${type} generation successful`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: finalResult,
        type: type
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
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

// Helper function to upload image to Replicate
async function uploadToReplicate(imageData: string, apiKey: string): Promise<string> {
  // Convert base64 to blob
  const base64Data = imageData.split(',')[1]
  if (!base64Data) {
    throw new Error('Invalid image data format')
  }

  const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
  const imageBlob = new Blob([imageBytes], { type: 'image/png' })

  // Get upload URL
  const uploadResponse = await fetch('https://api.replicate.com/v1/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ purpose: 'input' })
  })

  if (!uploadResponse.ok) {
    throw new Error('Failed to get upload URL')
  }

  const uploadData = await uploadResponse.json()

  // Upload file
  const uploadFileResponse = await fetch(uploadData.upload_url, {
    method: 'PUT',
    body: imageBlob
  })

  if (!uploadFileResponse.ok) {
    throw new Error('Failed to upload file')
  }

  return uploadData.serving_url
}

// Helper function to wait for prediction completion
async function waitForPrediction(predictionId: string, apiKey: string): Promise<any> {
  const maxAttempts = 60 // 5 minutes max
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to check prediction status')
    }

    const prediction = await response.json()
    
    if (prediction.status === 'succeeded') {
      return prediction
    } else if (prediction.status === 'failed') {
      throw new Error(`Prediction failed: ${prediction.error || 'Unknown error'}`)
    } else if (prediction.status === 'canceled') {
      throw new Error('Prediction was canceled')
    }
    
    // Wait 5 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  
  throw new Error('Prediction timed out')
}