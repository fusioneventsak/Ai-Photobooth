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

// Function to detect if the request is from a social media crawler
function isCrawler(userAgent: string): boolean {
  const crawlerPatterns = [
    'facebookexternalhit',
    'Facebot',
    'Twitterbot',
    'LinkedInBot',
    'WhatsApp',
    'TelegramBot',
    'SkypeUriPreview',
    'SlackBot',
    'DiscordBot',
    'GoogleBot',
    'bingbot',
    'YandexBot',
    'DuckDuckBot',
    'ia_archiver',
    'crawler',
    'spider',
    'bot'
  ];
  
  const lowerUserAgent = userAgent.toLowerCase();
  return crawlerPatterns.some(pattern => lowerUserAgent.includes(pattern.toLowerCase()));
}

// Function to generate Open Graph HTML for crawlers
function generateOpenGraphHTML(photo: any, baseUrl: string): string {
  const photoUrl = photo.processed_url || photo.original_url;
  const shareUrl = `${baseUrl}/shared/${photo.id}`;
  const title = `Amazing AI Generated ${photo.content_type === 'video' ? 'Video' : 'Photo'}`;
  const description = photo.prompt || 'Check out this incredible AI-generated content!';
  const siteName = 'AI Photobooth';
  
  // Truncate description for better social media display
  const truncatedDescription = description.length > 160 
    ? description.substring(0, 157) + '...' 
    : description;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${photo.content_type === 'video' ? 'video.other' : 'website'}" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${truncatedDescription}" />
  <meta property="og:image" content="${photoUrl}" />
  <meta property="og:site_name" content="${siteName}" />
  ${photo.content_type === 'video' ? `
  <meta property="og:video" content="${photoUrl}" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="1024" />
  <meta property="og:video:height" content="1024" />
  ` : `
  <meta property="og:image:width" content="1024" />
  <meta property="og:image:height" content="1024" />
  <meta property="og:image:type" content="image/png" />
  `}
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="${photo.content_type === 'video' ? 'player' : 'summary_large_image'}" />
  <meta name="twitter:url" content="${shareUrl}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${truncatedDescription}" />
  <meta name="twitter:image" content="${photoUrl}" />
  ${photo.content_type === 'video' ? `
  <meta name="twitter:player" content="${photoUrl}" />
  <meta name="twitter:player:width" content="1024" />
  <meta name="twitter:player:height" content="1024" />
  ` : ''}
  
  <!-- LinkedIn -->
  <meta property="og:locale" content="en_US" />
  
  <!-- WhatsApp -->
  <meta property="og:image:alt" content="${title}" />
  
  <!-- Redirect script for regular browsers -->
  <script>
    // Only redirect if this is not a crawler
    if (!navigator.userAgent.match(/bot|crawler|spider|crawling/i)) {
      window.location.href = '${shareUrl}';
    }
  </script>
  
  <!-- Fallback redirect -->
  <meta http-equiv="refresh" content="0; url=${shareUrl}">
</head>
<body>
  <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
    <h1>${title}</h1>
    <p>${truncatedDescription}</p>
    ${photo.content_type === 'video' ? `
    <video controls style="max-width: 100%; height: auto;">
      <source src="${photoUrl}" type="video/mp4">
      Your browser does not support the video tag.
    </video>
    ` : `
    <img src="${photoUrl}" alt="${title}" style="max-width: 100%; height: auto;" />
    `}
    <p><a href="${shareUrl}">View Full Experience</a></p>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const userAgent = req.headers.get('user-agent') || '';
    
    console.log('Share request:', {
      method: req.method,
      userAgent: userAgent.substring(0, 100),
      isCrawler: isCrawler(userAgent),
      pathname: url.pathname,
      search: url.search
    });

    // Initialize Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Handle GET requests (for sharing and crawlers)
    if (req.method === 'GET') {
      const photoId = url.searchParams.get('photoId') || url.pathname.split('/').pop();
      
      if (!photoId) {
        return new Response(
          JSON.stringify({ error: 'Photo ID is required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Fetch photo details
      const { data: photo, error: photoError } = await supabase
        .from('photos')
        .select('*')
        .eq('id', photoId)
        .eq('public', true)
        .single()

      if (photoError || !photo) {
        console.error('Photo not found:', photoError);
        
        // Return 404 page for crawlers
        if (isCrawler(userAgent)) {
          return new Response(
            `<!DOCTYPE html>
            <html><head><title>Photo Not Found</title></head>
            <body><h1>Photo Not Found</h1><p>The requested photo is not available.</p></body>
            </html>`,
            { 
              status: 404, 
              headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
            }
          )
        }
        
        return new Response(
          JSON.stringify({ error: 'Photo not found or not public' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      const baseUrl = `${url.protocol}//${url.host}`;

      // If this is a crawler, return HTML with Open Graph metadata
      if (isCrawler(userAgent)) {
        console.log('Serving Open Graph HTML for crawler');
        
        const html = generateOpenGraphHTML(photo, baseUrl);
        
        return new Response(html, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          }
        });
      }

      // For regular browsers, redirect to the frontend route
      const frontendUrl = `${baseUrl}/shared/${photoId}`;
      console.log('Redirecting browser to:', frontendUrl);
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': frontendUrl,
          'Cache-Control': 'no-cache'
        }
      });
    }

    // Handle POST requests (for API sharing functionality)
    if (req.method === 'POST') {
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
      const baseUrl = `${url.protocol}//${url.host}`
      const shareUrl = `${baseUrl}/functions/v1/share?photoId=${photoId}` // This will handle crawlers and redirect browsers
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
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
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