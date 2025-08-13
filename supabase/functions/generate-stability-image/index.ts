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
  useControlNet?: boolean
  controlNetType?: string
}

// Add request size limits to prevent stack overflow
const MAX_REQUEST_SIZE = 50 * 1024 * 1024 // 50MB limit
const MAX_IMAGE_SIZE = 4096 * 4096 // Max image dimensions

function validateImageSize(base64Data: string): boolean {
  try {
    // Rough calculation of image size from base64
    const sizeInBytes = (base64Data.length * 3) / 4
    return sizeInBytes < MAX_REQUEST_SIZE
  } catch {
    return false
  }
}

function sanitizePrompt(prompt: string): string {
  // Prevent extremely long prompts that could cause issues
  return prompt.slice(0, 1000).trim()
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

    // Check content length to prevent large requests
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request too large' }),
        { 
          status: 413, 
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

    // Parse request body with size validation
    let body: StabilityRequest
    try {
      const requestText = await req.text()
      if (requestText.length > MAX_REQUEST_SIZE) {
        throw new Error('Request body too large')
      }
      body = JSON.parse(requestText)
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON or request too large' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { 
      prompt, 
      imageData, 
      mode, 
      maskData, 
      strength = 0.8, 
      cfgScale = 7, 
      negativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy',
      useControlNet = true,
      controlNetType = 'auto'
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

    // Sanitize inputs to prevent stack overflow
    const sanitizedPrompt = sanitizePrompt(prompt)
    const sanitizedNegativePrompt = sanitizePrompt(negativePrompt)

    // Validate image data format
    if (!imageData.startsWith('data:image/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid image data format - must be data URL' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert base64 to blob with size validation
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

    // Validate image size before processing
    if (!validateImageSize(base64Data)) {
      return new Response(
        JSON.stringify({ error: 'Image too large' }),
        { 
          status: 413, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let imageBytes: Uint8Array
    let imageBlob: Blob
    
    try {
      imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      imageBlob = new Blob([imageBytes], { type: 'image/png' })
    } catch (conversionError) {
      return new Response(
        JSON.stringify({ error: 'Failed to process image data' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Choose API endpoint based on mode
    const apiUrl = mode === 'inpaint' 
      ? 'https://api.stability.ai/v2beta/stable-image/edit/inpaint'
      : 'https://api.stability.ai/v2beta/stable-image/generate/sd3'

    // Prepare form data based on mode
    const formData = new FormData()
    
    // Common parameters with bounds checking
    formData.append('prompt', sanitizedPrompt)
    formData.append('negative_prompt', sanitizedNegativePrompt)
    formData.append('cfg_scale', Math.max(1, Math.min(20, cfgScale)).toString())
    formData.append('output_format', 'png')

    // Add ControlNet parameters if enabled
    if (useControlNet && controlNetType) {
      formData.append('control_strength', '0.8') // How strongly to apply control guidance
      if (controlNetType !== 'auto') {
        formData.append('control_type', controlNetType)
      }
    }
    if (mode === 'inpaint' && maskData) {
      // Inpainting mode - requires image, mask, and strength
      formData.append('image', imageBlob, 'image.png')
      formData.append('strength', Math.max(0.1, Math.min(1.0, strength)).toString())
      
      // Add control image for ControlNet (same as input image for pose guidance)
      if (useControlNet) {
        formData.append('control_image', imageBlob, 'control.png')
      }
      
      // Validate and process mask data
      if (!maskData.startsWith('data:image/')) {
        return new Response(
          JSON.stringify({ error: 'Invalid mask data format' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const maskBase64 = maskData.split(',')[1]
      if (maskBase64) {
        if (!validateImageSize(maskBase64)) {
          return new Response(
            JSON.stringify({ error: 'Mask image too large' }),
            { 
              status: 413, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }

        try {
          const maskBytes = Uint8Array.from(atob(maskBase64), c => c.charCodeAt(0))
          const maskBlob = new Blob([maskBytes], { type: 'image/png' })
          formData.append('mask', maskBlob, 'mask.png')
        } catch (maskError) {
          return new Response(
            JSON.stringify({ error: 'Failed to process mask data' }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      }
    } else {
      // Image-to-image mode - requires explicit mode parameter
      formData.append('mode', 'image-to-image')
      formData.append('image', imageBlob, 'image.png')
      formData.append('strength', Math.max(0.1, Math.min(1.0, strength)).toString())
      
      // Add control image for ControlNet
      if (useControlNet) {
        formData.append('control_image', imageBlob, 'control.png')
      }
    }

    console.log(`Making request to Stability AI: ${mode} mode, prompt length: ${sanitizedPrompt.length}, ControlNet: ${useControlNet ? controlNetType : 'disabled'}`)

    // Make request to Stability AI with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout
    
    let response: Response
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'image/*',
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
        },
        body: formData,
        signal: controller.signal
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Request timeout', details: 'Generation took too long' }),
          { 
            status: 408, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      throw fetchError
    } finally {
      clearTimeout(timeoutId)
    }

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
      } else if (response.status === 400) {
        errorMessage = 'Invalid request parameters'
      }

      return new Response(
        JSON.stringify({ error: errorMessage, details: errorText }),
        { 
          status: response.status >= 500 ? 500 : response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert response to base64 with memory management
    let imageBuffer: ArrayBuffer
    try {
      imageBuffer = await response.arrayBuffer()
      
      // Check response size
      if (imageBuffer.byteLength > MAX_REQUEST_SIZE) {
        throw new Error('Response image too large')
      }
    } catch (bufferError) {
      return new Response(
        JSON.stringify({ error: 'Failed to process response image' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Convert to base64 safely
    let base64Image: string
    try {
      const uint8Array = new Uint8Array(imageBuffer)
      base64Image = btoa(String.fromCharCode(...uint8Array))
    } catch (conversionError) {
      return new Response(
        JSON.stringify({ error: 'Failed to encode response image' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const dataUrl = `data:image/png;base64,${base64Image}`

    console.log('Stability AI generation successful, response size:', imageBuffer.byteLength)

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
    
    // Ensure error message is safe
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const safeErrorMessage = errorMessage.slice(0, 500) // Limit error message length
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: safeErrorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})