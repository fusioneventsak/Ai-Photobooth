#!/bin/bash

# Enhanced Supabase Edge Functions Deployment & Fix Script
# This script fixes the API key issues and redeploys the Edge Functions

echo "🔧 Starting Edge Functions Fix & Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found. Installing...${NC}"
    npm install -g supabase
    echo -e "${GREEN}✅ Supabase CLI installed successfully${NC}"
fi

# Check if user is logged in
echo -e "${BLUE}🔐 Checking Supabase authentication...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Supabase. Please run:${NC}"
    echo "   supabase login"
    echo "   Then run this script again."
    exit 1
fi

echo -e "${GREEN}✅ Supabase authentication verified${NC}"

# Check if project is linked
if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${RED}❌ Project not linked. Please run:${NC}"
    echo "   supabase link --project-ref YOUR_PROJECT_REF"
    echo "   Then run this script again."
    exit 1
fi

echo -e "${GREEN}✅ Project linked successfully${NC}"

# Get project reference for environment variable setup
PROJECT_REF=$(grep 'project_id' .supabase/config.toml | cut -d'"' -f2)
echo -e "${BLUE}📋 Project Reference: ${PROJECT_REF}${NC}"

# Check if edge function directories exist
if [ ! -d "supabase/functions/generate-stability-image" ]; then
    echo -e "${RED}❌ generate-stability-image function directory not found${NC}"
    exit 1
fi

if [ ! -d "supabase/functions/generate-replicate-content" ]; then
    echo -e "${RED}❌ generate-replicate-content function directory not found${NC}"
    exit 1
fi

# Deploy Edge Functions with error handling
echo -e "${BLUE}📦 Deploying Fixed Edge Functions...${NC}"

echo -e "${YELLOW}🔄 Deploying generate-stability-image function...${NC}"
if supabase functions deploy generate-stability-image --project-ref "$PROJECT_REF"; then
    echo -e "${GREEN}✅ generate-stability-image deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy generate-stability-image${NC}"
    echo -e "${YELLOW}💡 Try manually:${NC} supabase functions deploy generate-stability-image"
    exit 1
fi

echo -e "${YELLOW}🔄 Deploying generate-replicate-content function...${NC}"
if supabase functions deploy generate-replicate-content --project-ref "$PROJECT_REF"; then
    echo -e "${GREEN}✅ generate-replicate-content deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy generate-replicate-content${NC}"
    echo -e "${YELLOW}💡 Try manually:${NC} supabase functions deploy generate-replicate-content"
    exit 1
fi

# Check if functions are running
echo -e "${BLUE}🔍 Checking function status...${NC}"
supabase functions list

echo ""
echo -e "${GREEN}🎉 All Edge Functions deployed successfully!${NC}"
echo ""
echo -e "${YELLOW}📋 CRITICAL NEXT STEPS:${NC}"
echo "1. Go to your Supabase Dashboard → Settings → Edge Functions"
echo "2. Add these environment variables:"
echo -e "   ${BLUE}STABILITY_API_KEY${NC}=your_stability_ai_key_here"
echo -e "   ${BLUE}REPLICATE_API_KEY${NC}=your_replicate_key_here"
echo ""
echo -e "${YELLOW}🔗 Direct link to your project settings:${NC}"
echo "https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
echo ""
echo -e "${YELLOW}🧪 To test your API keys:${NC}"
echo "1. Set the environment variables in Supabase Dashboard first"
echo "2. Test your photobooth application"
echo "3. Check the browser console for any remaining errors"
echo ""
echo -e "${GREEN}🔒 Your API keys will now be secure and hidden from the frontend!${NC}"

# Additional troubleshooting info
echo ""
echo -e "${BLUE}🛠️  TROUBLESHOOTING:${NC}"
echo -e "${YELLOW}If you still get errors after setting environment variables:${NC}"
echo "1. Wait 2-3 minutes for environment variables to propagate"
echo "2. Clear your browser cache and reload the app"
echo "3. Check browser console for specific error messages"
echo "4. Verify your API keys are valid:"
echo "   - Stability AI: https://platform.stability.ai/account/keys"
echo "   - Replicate: https://replicate.com/account/api-tokens"
echo ""
echo -e "${YELLOW}Common fixes:${NC}"
echo "• Make sure API keys don't have extra spaces"
echo "• Stability AI keys should start with 'sk-'"
echo "• Replicate keys should start with 'r8_'"
echo "• Both services require sufficient credits/usage limits"
echo ""
echo -e "${GREEN}🚀 Ready to create amazing AI portraits!${NC}"