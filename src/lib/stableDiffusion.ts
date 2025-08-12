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

// Maximum size limits
const MAX_REQUEST_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_IMAGE_SIZE = 25 * 1024 * 1024   // 25MB for response
const MAX_BASE64_SIZE = 37 * 1024 * 1024  // 37MB for base64 input

// Utility function to convert ArrayBuffer to Base64 safely
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    console.log(`Converting ArrayBuffer of size ${buffer.byteLength} to base64...`);
    
    // For large buffers, process in chunks to avoid memory issues
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32KB chunks
    let result = '';
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      result += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Result = btoa(result);
    console.log(`Base64 conversion complete. Result length: ${base64Result.length}`);
    return base64Result;
  } catch (error) {
    console.error('Error converting ArrayBuffer to base64:', error);
    throw new Error('Failed to encode image data: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Utility function to validate base64 image data
function validateBase64Image(imageData: string): boolean {
  try {
    if (!imageData || typeof imageData !== 'string') {
      return false;
    }
    
    if (!imageData.startsWith('data:image/')) {
      return false;
    }
    
    const base64Part = imageData.split(',')[1];
    if (!base64Part) {
      return false;
    }
    
    // Try to decode to validate
    atob(base64Part);
    return true;
  } catch {
    return false;
  }
}

// Main serve function
serve(async (req) => {
  console.log(`📨 Received ${req.method} request`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      console.error('❌ Invalid request method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get API key from environment
    const STABILITY_API_KEY = Deno.env.get('STABILITY_API_KEY');
    if (!STABILITY_API_KEY) {
      console.error('❌ STABILITY_API_KEY not found in environment');
      return new Response(
        JSON.stringify({ error: 'API configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ API key found');

    // Parse request body with size limits
    let body: StabilityRequest;
    try {
      console.log('📖 Reading request body...');
      const requestText = await req.text();
      
      // Check request size
      if (requestText.length > MAX_REQUEST_SIZE) {
        console.error('❌ Request too large:', requestText.length);
        return new Response(
          JSON.stringify({ error: 'Request too large' }),
          { 
            status: 413, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      console.log(`📋 Request size: ${requestText.length} bytes`);
      body = JSON.parse(requestText);
      console.log('✅ Request body parsed successfully');
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { 
      prompt, 
      imageData, 
      mode, 
      maskData, 
      strength = 0.8, 
      cfgScale = 7, 
      negativePrompt = 'blurry, low quality, distorted, deformed, ugly, bad anatomy'
    } = body;

    console.log(`🎯 Processing request - Mode: ${mode}, Prompt: "${prompt?.slice(0, 50)}..."`);

    // Validate required fields
    if (!prompt || !imageData) {
      console.error('❌ Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Missing required fields: prompt and imageData' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate image data format
    if (!validateBase64Image(imageData)) {
      console.error('❌ Invalid image data format');
      return new Response(
        JSON.stringify({ error: 'Invalid image data format - must be valid data URL' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Image data validation passed');

    // Convert base64 to blob with error handling
    let imageBlob: Blob;
    try {
      console.log('🔄 Converting image data to blob...');
      const base64Data = imageData.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid base64 format');
      }

      // Check base64 size
      if (base64Data.length > MAX_BASE64_SIZE) {
        console.error('❌ Image too large:', base64Data.length);
        return new Response(
          JSON.stringify({ error: 'Image too large' }),
          { 
            status: 413, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log(`📊 Base64 size: ${base64Data.length} bytes`);
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      imageBlob = new Blob([imageBytes], { type: 'image/png' });
      console.log(`✅ Image blob created: ${imageBlob.size} bytes`);
    } catch (conversionError) {
      console.error('❌ Image conversion error:', conversionError);
      return new Response(
        JSON.stringify({ error: 'Failed to process image data' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Choose API endpoint based on mode
    const apiUrl = mode === 'inpaint' 
      ? 'https://api.stability.ai/v2beta/stable-image/edit/inpaint'
      : 'https://api.stability.ai/v2beta/stable-image/generate/sd3';

    console.log(`🎯 Using API endpoint: ${apiUrl}`);

    // Prepare form data based on mode
    const formData = new FormData();
    
    // Common parameters with validation
    const sanitizedPrompt = prompt.slice(0, 1000).trim();
    const sanitizedNegativePrompt = negativePrompt.slice(0, 1000).trim();
    const validatedStrength = Math.max(0.1, Math.min(1.0, strength));
    const validatedCfgScale = Math.max(1, Math.min(20, cfgScale));

    formData.append('prompt', sanitizedPrompt);
    formData.append('negative_prompt', sanitizedNegativePrompt);
    formData.append('cfg_scale', validatedCfgScale.toString());
    formData.append('output_format', 'png');

    console.log(`📝 Parameters - Strength: ${validatedStrength}, CFG Scale: ${validatedCfgScale}`);

    if (mode === 'inpaint' && maskData) {
      console.log('🎭 Processing inpaint mode with mask...');
      // Inpainting mode
      formData.append('image', imageBlob, 'image.png');
      formData.append('strength', validatedStrength.toString());
      
      // Process mask data
      try {
        if (!validateBase64Image(maskData)) {
          throw new Error('Invalid mask format');
        }

        const maskBase64 = maskData.split(',')[1];
        if (!maskBase64) {
          throw new Error('Invalid mask base64');
        }

        console.log(`🎭 Mask size: ${maskBase64.length} bytes`);
        const maskBytes = Uint8Array.from(atob(maskBase64), c => c.charCodeAt(0));
        const maskBlob = new Blob([maskBytes], { type: 'image/png' });
        formData.append('mask', maskBlob, 'mask.png');
        console.log('✅ Mask processed successfully');
      } catch (maskError) {
        console.error('❌ Mask processing error:', maskError);
        return new Response(
          JSON.stringify({ error: 'Failed to process mask data' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      console.log('🖼️ Processing image-to-image mode...');
      // Image-to-image mode
      formData.append('mode', 'image-to-image');
      formData.append('image', imageBlob, 'image.png');
      formData.append('strength', validatedStrength.toString());
    }

    console.log(`🚀 Making request to Stability AI: ${mode} mode`);

    // Make request to Stability AI with timeout
    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Request timeout, aborting...');
        controller.abort();
      }, 120000); // 2 minute timeout
      
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'image/*',
          'Authorization': `Bearer ${STABILITY_API_KEY}`,
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log(`📡 Received response with status: ${response.status}`);
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ error: 'Request timeout', details: 'Generation took too long' }),
          { 
            status: 408, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Network error', details: fetchError.message }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Handle API errors
    if (!response.ok) {
      let errorText = 'Unknown error';
      try {
        errorText = await response.text();
      } catch {
        errorText = `HTTP ${response.status} ${response.statusText}`;
      }
      
      console.error(`❌ Stability AI API error (${response.status}):`, errorText);
      
      let errorMessage = 'Image generation failed';
      if (response.status === 401) {
        errorMessage = 'Invalid API key';
      } else if (response.status === 402) {
        errorMessage = 'Insufficient credits';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded';
      } else if (response.status === 400) {
        errorMessage = 'Invalid request parameters';
      }

      return new Response(
        JSON.stringify({ error: errorMessage, details: errorText }),
        { 
          status: response.status >= 500 ? 500 : response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Convert response to base64 with memory management
    let imageBuffer: ArrayBuffer;
    let base64Image: string;
    
    try {
      console.log('📥 Processing response from Stability AI...');
      
      // Get the response as ArrayBuffer
      imageBuffer = await response.arrayBuffer();
      console.log(`📊 Received image buffer of size: ${imageBuffer.byteLength} bytes`);
      
      // Check response size
      if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
        console.error('❌ Response image too large:', imageBuffer.byteLength);
        return new Response(
          JSON.stringify({ error: 'Generated image too large' }),
          { 
            status: 413, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      // Convert to base64 using our safe function
      console.log('🔄 Converting to base64...');
      base64Image = arrayBufferToBase64(imageBuffer);
      console.log('✅ Base64 conversion successful, length:', base64Image.length);
      
    } catch (bufferError) {
      console.error('❌ Failed to process response image:', bufferError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to encode response image',
          details: bufferError instanceof Error ? bufferError.message : 'Unknown encoding error'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const dataUrl = `data:image/png;base64,${base64Image}`;

    console.log('✅ Stability AI generation successful');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageData: dataUrl,
        mode: mode,
        metadata: {
          originalSize: imageBuffer.byteLength,
          base64Length: base64Image.length,
          prompt: sanitizedPrompt.slice(0, 100) + '...'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Edge function error:', error);
    
    // Ensure error message is safe and limited
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const safeErrorMessage = errorMessage.slice(0, 500);
    const errorStack = error instanceof Error ? error.stack?.slice(0, 1000) : undefined;
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: safeErrorMessage,
        stack: errorStack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});