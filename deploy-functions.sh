#!/bin/bash

# Supabase Edge Functions Deployment Script
# This script deploys the secure Edge Functions for the AI Photobooth

echo "🚀 Starting Supabase Edge Functions deployment..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
    echo "✅ Supabase CLI installed successfully"
fi

# Check if user is logged in
echo "🔐 Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   supabase login"
    echo "   Then run this script again."
    exit 1
fi

echo "✅ Supabase authentication verified"

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "❌ Project not linked. Please run:"
    echo "   supabase link --project-ref YOUR_PROJECT_REF"
    echo "   Then run this script again."
    exit 1
fi

echo "✅ Project linked successfully"

# Deploy Edge Functions
echo "📦 Deploying Edge Functions..."

echo "🔄 Deploying generate-stability-image function..."
if supabase functions deploy generate-stability-image; then
    echo "✅ generate-stability-image deployed successfully"
else
    echo "❌ Failed to deploy generate-stability-image"
    exit 1
fi

echo "🔄 Deploying generate-replicate-content function..."
if supabase functions deploy generate-replicate-content; then
    echo "✅ generate-replicate-content deployed successfully"
else
    echo "❌ Failed to deploy generate-replicate-content"
    exit 1
fi

echo ""
echo "🎉 All Edge Functions deployed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Go to your Supabase Dashboard → Settings → Edge Functions"
echo "2. Add these environment variables:"
echo "   STABILITY_API_KEY=your_stability_ai_key_here"
echo "   REPLICATE_API_KEY=your_replicate_key_here"
echo "3. Test your photobooth application"
echo ""
echo "🔒 Your API keys are now secure and hidden from the frontend!"