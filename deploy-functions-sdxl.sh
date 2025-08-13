#!/bin/bash

# Enhanced Supabase Edge Functions Deployment Script
# Deploys SDXL Inpainting + ControlNet enabled Edge Functions

echo "🚀 Starting SDXL Inpainting Edge Functions deployment..."

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

# Deploy Database Migration First
echo "📊 Deploying SDXL database migration..."
if supabase db push; then
    echo "✅ Database migration deployed successfully"
else
    echo "❌ Failed to deploy database migration"
    exit 1
fi

# Deploy Enhanced Edge Functions
echo "📦 Deploying Enhanced Edge Functions..."

echo "🎨 Deploying SDXL Inpainting function..."
if supabase functions deploy generate-stability-image; then
    echo "✅ generate-stability-image (SDXL Inpainting) deployed successfully"
else
    echo "❌ Failed to deploy generate-stability-image"
    exit 1
fi

echo "🔄 Deploying enhanced Replicate function..."
if supabase functions deploy generate-replicate-content; then
    echo "✅ generate-replicate-content deployed successfully"
else
    echo "❌ Failed to deploy generate-replicate-content"
    exit 1
fi

echo ""
echo "🎉 All SDXL Inpainting Edge Functions deployed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Go to your Supabase Dashboard → Settings → Edge Functions"
echo "2. Add these environment variables:"
echo "   STABILITY_API_KEY=your_stability_ai_key_here"
echo "   REPLICATE_API_KEY=your_replicate_key_here"
echo "3. Test your SDXL Inpainting photobooth application"
echo ""
echo "🎭 SDXL Inpainting Features Now Available:"
echo "   ✅ Superior face preservation with smart masking"
echo "   ✅ ControlNet integration for better composition"
echo "   ✅ Enhanced prompt engineering for face quality"
echo "   ✅ Optimized 1024x1024 native resolution"
echo "   ✅ Advanced feathering and blending"
echo "   ✅ Fallback masking for edge cases"
echo ""
echo "🔒 Your API keys are secure and hidden from the frontend!"
echo "🚀 Ready to create amazing AI portraits with SDXL Inpainting!"