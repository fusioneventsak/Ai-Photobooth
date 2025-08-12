import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface StabilityRequest {
  prompt: string
  imageData: string
  mode: 'image-to-image' | 'inpaint'
  maskData?: string
  strength?: number
  cfgScale?: number
  negativePrompt?: string
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
    const STABILITY_API_KEY = Deno.env.get('STABILITY_API_KEY')
    if (!STABILITY_API_KEY) {
      console.error('STABILITY_API_KEY not found in environment')
      return new Response(
        JSON.stringify({ error: 'API configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const body: StabilityRequest = await req.json()
    const { 
      prompt, 
      imageData, 
      mode, 
      maskData, 
      strength = 0.8, 
      cfgScale = 7, 
      negativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy'
    } = body

    // Validate required fields
    if (!prompt || !imageData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: prompt and imageData' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert base64 to blob
    const base64Data = imageData.split(',')[1]
    if (!base64Data) {
      return new Response(
        JSON.stringify({ error: 'Invalid image data format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    const imageBlob = new Blob([imageBytes], { type: 'image/png' })

    // Choose API endpoint based on mode
    const apiUrl = mode === 'inpaint' 
      ? 'https://api.stability.ai/v2beta/stable-image/edit/inpaint'
      : 'https://api.stability.ai/v2beta/stable-image/generate/sd3'

    // Prepare form data based on mode
    const formData = new FormData()
    
    // Common parameters
    formData.append('prompt', prompt)
    formData.append('negative_prompt', negativePrompt)
    formData.append('cfg_scale', cfgScale.toString())
    formData.append('output_format', 'png')

    if (mode === 'inpaint' && maskData) {
      // Inpainting mode - requires image, mask, and strength
      formData.append('image', imageBlob, 'image.png')
      formData.append('strength', strength.toString())
      
      const maskBase64 = maskData.split(',')[1]
      if (maskBase64) {
        const maskBytes = Uint8Array.from(atob(maskBase64), c => c.charCodeAt(0))
        const maskBlob = new Blob([maskBytes], { type: 'image/png' })
        formData.append('mask', maskBlob, 'mask.png')
      }
    } else {
      // Image-to-image mode - requires explicit mode parameter
      formData.append('mode', 'image-to-image')
      formData.append('image', imageBlob, 'image.png')
      formData.append('strength', strength.toString())
    }

    console.log(`Making request to Stability AI: ${mode} mode`)

    // Make request to Stability AI
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'image/*',
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
      },
      body: formData,
    })

    // Handle API errors
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Stability AI API error (${response.status}):`, errorText)
      
      let errorMessage = 'Image generation failed'
      if (response.status === 401) {
        errorMessage = 'Invalid API key'
      } else if (response.status === 402) {
        errorMessage = 'Insufficient credits'
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded'
      }

      return new Response(
        JSON.stringify({ error: errorMessage, details: errorText }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert response to base64
    const imageBuffer = await response.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))
    const dataUrl = `data:image/png;base64,${base64Image}`

    console.log('Stability AI generation successful')

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageData: dataUrl,
        mode: mode
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