# AI Photobooth - Secure Production Setup

## Security Features
- ✅ API keys stored securely in Supabase Edge Functions (server-side)
- ✅ No sensitive credentials exposed in frontend
- ✅ Production-ready architecture
- ✅ Proper error handling and validation
## Overview
## Setup Instructions
A secure React photobooth application with AI image/video generation using Supabase Edge Functions to protect API keys.
### 1. Supabase Edge Functions Setup

Deploy the Edge Functions to your Supabase project:

```bash
# Install Supabase CLI
npm install -g supabase
# Login to Supabase
supabase login
# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
# Deploy Edge Functions
supabase functions deploy generate-stability-image
supabase functions deploy generate-replicate-content
```
### 2. Environment Variables (Supabase Dashboard)
Set these environment variables in your Supabase project dashboard under Settings > Edge Functions:
```
STABILITY_API_KEY=your_stability_ai_api_key_here
REPLICATE_API_KEY=your_replicate_api_key_here
```
### 3. Frontend Environment Variables
Only these are needed in your `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
### 4. Database Migrations
Run the database migrations to set up the required tables:

```bash
supabase db push
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