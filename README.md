# AI Photobooth - Secure Production Setup

## Security Features
- ✅ API keys stored securely in Supabase Edge Functions (server-side)
- ✅ No sensitive credentials exposed in frontend
- ✅ Production-ready architecture
- ✅ Proper error handling and validation
## Overview
## Setup Instructions
A secure React photobooth application with AI image/video generation using Supabase Edge Functions to protect API keys.
### 1. Prerequisites

Make sure you have Node.js installed, then install the Supabase CLI:

```bash
npm install -g supabase
```

### 2. Supabase Authentication & Project Setup

```bash
# Login to Supabase (opens browser for authentication)
supabase login

# Link to your existing Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

**To find your project reference:**
1. Go to your Supabase Dashboard
2. Select your project
3. Go to Settings → General
4. Copy the "Reference ID"

### 3. Deploy Edge Functions (Automated)

Use the provided deployment script:

```bash
# Make script executable and run deployment
npm run deploy:functions
```

**Or deploy manually:**

```bash
# Deploy individual functions
supabase functions deploy generate-stability-image
supabase functions deploy generate-replicate-content
```

### 4. Environment Variables (Supabase Dashboard)

**CRITICAL:** Set these in your Supabase Dashboard (NOT in your .env file):

1. Go to Supabase Dashboard → Settings → Edge Functions
2. Add these environment variables:

```bash
STABILITY_API_KEY=your_stability_ai_api_key_here
REPLICATE_API_KEY=your_replicate_api_key_here
```

### 5. Frontend Environment Variables

Update your `.env` file to only include:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Remove any API keys from your .env file - they're now secure in Supabase!**

### 6. Database Setup

Run the database migrations:

```
supabase db push
```

### 7. Local Development (Optional)

For local development with Supabase:

```bash
# Start local Supabase (includes Edge Functions)
npm run supabase:start

# Check status
npm run supabase:status

# Stop when done
npm run supabase:stop
```
## API Keys Required
### Stability AI
- Get your API key from: https://platform.stability.ai
- Used for: Image generation and inpainting
- Set as: `STABILITY_API_KEY` in Supabase Edge Functions
### Replicate
- Get your API key from: https://replicate.com
- Used for: Advanced image/video generation
- Set as: `REPLICATE_API_KEY` in Supabase Edge Functions
## Features
- 📸 Real-time camera capture
- 🎨 AI image generation with face preservation
- 🎬 AI video generation
- 🖼️ Custom overlay/border system
- 📱 Responsive design
- 🔒 Secure API key management
- 💾 Automatic photo gallery with Supabase storage
## Architecture
```
Frontend (React) → Supabase Edge Functions → AI APIs (Stability AI / Replicate)
```
This architecture ensures:
- API keys never exposed to browsers
- Secure server-side processing
- Scalable and production-ready
- Easy deployment and maintenance
## Development
```bash
npm install
npm run dev
```
## Deployment
```bash
npm run build
# Deploy to your preferred hosting platform
```
## Support
For issues or questions, check the Supabase Edge Functions documentation:
https://supabase.com/docs/guides/functions