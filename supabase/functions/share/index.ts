import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface ShareRequest {
  photoId: string
  platform?: 'twitter' | 'facebook' | 'instagram' | 'email' | 'copy'
  message?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate request method
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle GET request for share link generation
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const photoId = url.searchParams.get('photoId')
      
      if (!photoId) {
        return new Response(
          JSON.stringify({ error: 'Photo ID is required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Generate shareable link
      const shareUrl = `${url.origin}/shared/${photoId}`
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          shareUrl,
          photoId 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle POST request for sharing actions
    const body: ShareRequest = await req.json()
    const { photoId, platform = 'copy', message = 'Check out this amazing AI-generated photo!' } = body

    // Validate required fields
    if (!photoId) {
      return new Response(
        JSON.stringify({ error: 'Photo ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Processing share request for photo ${photoId} on platform: ${platform}`)

    // Get photo details from database
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: photo, error: photoError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', photoId)
      .eq('public', true)
      .single()

    if (photoError || !photo) {
      return new Response(
        JSON.stringify({ error: 'Photo not found or not public' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Generate share URLs based on platform
    const baseUrl = `${new URL(req.url).origin}`
    const shareUrl = `${baseUrl}/shared/${photoId}`
    const photoUrl = photo.processed_url || photo.original_url
    
    let platformUrl = ''
    
    switch (platform) {
      case 'twitter':
        platformUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`
        break
      case 'facebook':
        platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
        break
      case 'instagram':
        // Instagram doesn't support direct URL sharing, return instructions
        platformUrl = shareUrl
        break
      case 'email':
        platformUrl = `mailto:?subject=${encodeURIComponent('Amazing AI Photo')}&body=${encodeURIComponent(`${message}\n\nView the photo: ${shareUrl}`)}`
        break
      case 'copy':
      default:
        platformUrl = shareUrl
        break
    }

    // Log share activity (optional analytics)
    const { error: logError } = await supabase
      .from('share_logs')
      .insert([{
        photo_id: photoId,
        platform: platform,
        shared_at: new Date().toISOString(),
        share_url: shareUrl
      }])
      .select()

    if (logError) {
      console.warn('Failed to log share activity:', logError)
      // Don't fail the request if logging fails
    }

    console.log(`Share URL generated for ${platform}:`, platformUrl)

    return new Response(
      JSON.stringify({ 
        success: true, 
        shareUrl: platformUrl,
        photoUrl,
        platform,
        message: platform === 'instagram' 
          ? 'Copy this link and share it on Instagram' 
          : 'Share URL generated successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Share function error:', error)
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