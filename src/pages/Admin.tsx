// src/pages/Admin.tsx - Fixed version with proper model persistence
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Palette, 
  Type, 
  Layout, 
  Image, 
  RefreshCw, 
  Save, 
  Eye,
  Monitor,
  Smartphone,
  Download,
  Share2,
  Users,
  Lock,
  Globe,
  Wand2,
  Zap,
  Clock,
  Star,
  Camera,
  Video,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import type { Config } from '../types/config';
import { REPLICATE_MODELS, getModelInfo, testReplicateConnection, ImageModel, VideoModel } from '../lib/replicateService';

interface AdminFormData extends Partial<Config> {
  gallery_public_access?: boolean;
  gallery_allow_downloads?: boolean;
  gallery_show_metadata?: boolean;
  gallery_require_admin?: boolean;
  gallery_watermark_enabled?: boolean;
  gallery_social_sharing?: boolean;
  model_type?: 'image' | 'video';
  video_duration?: number;
  face_preservation_mode?: 'preserve_face' | 'replace_face';
  image_provider?: 'stability' | 'replicate';
  video_provider?: 'stability' | 'replicate';
  use_provider_fallback?: boolean;
  replicate_image_model?: ImageModel;
  replicate_video_model?: VideoModel;
}

export default function Admin() {
  const { config, fetchConfig, updateConfig } = useConfigStore();
  const [formData, setFormData] = useState<AdminFormData>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'branding' | 'gallery' | 'privacy' | 'advanced'>('branding');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; error?: string; model?: string } | null>(null);

  useEffect(() => {
    console.log('Config updated:', config);
    if (config) {
      setFormData({
        ...config,
        // Ensure gallery layout options are always available
        gallery_animation: config.gallery_animation ?? 'fade',
        gallery_layout: config.gallery_layout ?? 'grid',
        gallery_speed: config.gallery_speed ?? 3000,
        gallery_public_access: true,
        gallery_allow_downloads: true,
        gallery_show_metadata: false,
        gallery_require_admin: false,
        gallery_watermark_enabled: false,
        gallery_social_sharing: true,
        model_type: config.model_type || 'image',
        video_duration: config.video_duration || 5,
        face_preservation_mode: config.face_preservation_mode || 'preserve_face',
        use_controlnet: config.use_controlnet ?? true,
        controlnet_type: config.controlnet_type || 'auto',
        // CRITICAL FIX: Proper provider defaults with fallbacks
        image_provider: config.image_provider || 'stability',
        video_provider: config.video_provider || 'stability',
        use_provider_fallback: config.use_provider_fallback ?? true,
        // CRITICAL FIX: Model selections from config (cast to any to access extended fields)
        replicate_image_model: (config as any).replicate_image_model || 'flux-schnell',
        replicate_video_model: (config as any).replicate_video_model || 'stable-video-diffusion',
      });
      console.log('Form data initialized:', formData);
    }
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    console.log(`Field changed: ${name} = ${value}`);
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              type === 'number' ? Number(value) : value
    }));
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    
    try {
      const result = await testReplicateConnection();
      setConnectionResult(result);
    } catch (error) {
      setConnectionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // CRITICAL FIX: Create complete updates object
      const updates: Partial<Config> = {};
      
      // Core config fields
      if (formData.brand_name !== undefined) updates.brand_name = formData.brand_name;
      if (formData.brand_logo_url !== undefined) updates.brand_logo_url = formData.brand_logo_url;
      if (formData.primary_color !== undefined) updates.primary_color = formData.primary_color;
      if (formData.secondary_color !== undefined) updates.secondary_color = formData.secondary_color;
      if (formData.global_prompt !== undefined) updates.global_prompt = formData.global_prompt;
      
      // Gallery settings
      if (formData.gallery_animation !== undefined) updates.gallery_animation = formData.gallery_animation;
      if (formData.gallery_speed !== undefined) updates.gallery_speed = formData.gallery_speed;
      if (formData.gallery_layout !== undefined) updates.gallery_layout = formData.gallery_layout;
      if (formData.gallery_images_per_page !== undefined) updates.gallery_images_per_page = formData.gallery_images_per_page;
      
      // CRITICAL FIX: Always save provider configuration - force replicate for video
      updates.image_provider = formData.image_provider || 'stability';
      updates.video_provider = 'replicate'; // Always use Replicate for video
      updates.use_provider_fallback = formData.use_provider_fallback ?? true;
      
      // AI settings
      if (formData.model_type !== undefined) updates.model_type = formData.model_type;
      if (formData.video_duration !== undefined) updates.video_duration = formData.video_duration;
      if (formData.face_preservation_mode !== undefined) updates.face_preservation_mode = formData.face_preservation_mode;
      if (formData.stability_api_key !== undefined) updates.stability_api_key = formData.stability_api_key;
      if (formData.use_controlnet !== undefined) updates.use_controlnet = formData.use_controlnet;
      if (formData.controlnet_type !== undefined) updates.controlnet_type = formData.controlnet_type;
      
      // CRITICAL FIX: Always save model selections (no undefined checks)
      (updates as any).replicate_image_model = formData.replicate_image_model || 'flux-schnell';
      (updates as any).replicate_video_model = formData.replicate_video_model || 'stable-video-diffusion';

      console.log('Saving configuration with updates:', updates);

      const result = await updateConfig(updates);
      
      if (result) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        console.log('Configuration updated successfully');
        await fetchConfig(); // Refresh to get latest data
      } else {
        throw new Error('Failed to update configuration');
      }
    } catch (error) {
      console.error('Failed to update configuration:', error);
      setError(error instanceof Error ? error.message : 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const getSpeedIcon = (speed: string) => {
    if (speed.includes('Fast')) return <Zap className="w-4 h-4 text-green-500" />;
    if (speed.includes('Medium')) return <Clock className="w-4 h-4 text-yellow-500" />;
    return <Clock className="w-4 h-4 text-red-500" />;
  };

  const getQualityIcon = (quality: string) => {
    if (quality.includes('Premium')) return <Star className="w-4 h-4 text-purple-500" />;
    if (quality.includes('Photorealistic')) return <Camera className="w-4 h-4 text-blue-500" />;
    return <Star className="w-4 h-4 text-yellow-500" />;
  };

  const previewColors = {
    primary: formData.primary_color || '#3B82F6',
    secondary: formData.secondary_color || '#6B7280'
  };

  const tabs = [
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'gallery', label: 'Gallery', icon: Layout },
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'advanced', label: 'Advanced', icon: Settings }
  ];

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="container mx-auto">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mr-3" />
            <span>Loading configuration...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-6xl font-light mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Admin Settings
          </h1>
          <p className="text-xl text-gray-300 font-light">
            Configure your photobooth experience
          </p>
        </motion.div>

        {/* Success/Error Messages */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-900/20 border border-green-600/30 rounded-xl text-green-200"
          >
            Configuration updated successfully!
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-xl text-red-200"
          >
            {error}
          </motion.div>
        )}

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Settings Form */}
            <div className="lg:col-span-2">
              {/* Tab Navigation */}
              <div className="flex flex-wrap gap-2 mb-8 bg-gray-800/50 rounded-2xl p-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
                        activeTab === tab.id
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Branding Tab */}
                {activeTab === 'branding' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
                      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                        <Type className="w-6 h-6 text-blue-400" />
                        Brand Identity
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Brand Name</label>
                          <input
                            type="text"
                            name="brand_name"
                            value={formData.brand_name || ''}
                            onChange={handleChange}
                            placeholder="Virtual Photobooth"
                            className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Logo URL</label>
                          <input
                            type="url"
                            name="brand_logo_url"
                            value={formData.brand_logo_url || ''}
                            onChange={handleChange}
                            placeholder="https://example.com/logo.png"
                            className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
                      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                        <Palette className="w-6 h-6 text-purple-400" />
                        Color Scheme
                      </h2>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Primary Color</label>
                          <div className="flex gap-3">
                            <input
                              type="color"
                              name="primary_color"
                              value={formData.primary_color || '#3B82F6'}
                              onChange={handleChange}
                              className="w-16 h-12 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                            />
                            <input
                              type="text"
                              name="primary_color"
                              value={formData.primary_color || '#3B82F6'}
                              onChange={handleChange}
                              className="flex-1 bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Secondary Color</label>
                          <div className="flex gap-3">
                            <input
                              type="color"
                              name="secondary_color"
                              value={formData.secondary_color || '#6B7280'}
                              onChange={handleChange}
                              className="w-16 h-12 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                            />
                            <input
                              type="text"
                              name="secondary_color"
                              value={formData.secondary_color || '#6B7280'}
                              onChange={handleChange}
                              className="flex-1 bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
                      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                        <Image className="w-6 h-6 text-green-400" />
                        Default Prompt
                      </h2>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Global AI Prompt</label>
                        <textarea
                          name="global_prompt"
                          value={formData.global_prompt || ''}
                          onChange={handleChange}
                          rows={4}
                          placeholder="Enter the default prompt for AI generation..."
                          className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-2">
                          This prompt will be used as the base for all AI generations
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Gallery Tab */}
                {activeTab === 'gallery' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
                      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                        <Layout className="w-6 h-6 text-blue-400" />
                        Display Settings
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Animation Style</label>
                          <select
                            name="gallery_animation"
                            value={formData.gallery_animation || 'fade'}
                            onChange={handleChange}
                            className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          >
                            <option value="fade">Fade</option>
                            <option value="slide">Slide</option>
                            <option value="zoom">Zoom</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Layout Style</label>
                          <select
                            name="gallery_layout"
                            value={formData.gallery_layout || 'grid'}
                            onChange={handleChange}
                            className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          >
                            <option value="grid">Grid</option>
                            <option value="masonry">Masonry</option>
                            <option value="carousel">Carousel</option>