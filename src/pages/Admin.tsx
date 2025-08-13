// src/pages/Admin.tsx
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
  Wand2
} from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import type { Config } from '../types/config';

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
}

export default function Admin() {
  const { config, fetchConfig, updateConfig } = useConfigStore();
  const [formData, setFormData] = useState<AdminFormData>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'branding' | 'gallery' | 'privacy' | 'advanced'>('branding');

  useEffect(() => {
    if (config) {
      setFormData({
        ...config,
        // Default gallery settings
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
      });
    }
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              type === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Only send fields that actually exist in the Config type
      const updates: Partial<Config> = {};
      
      // Core config fields
      if (formData.brand_name !== undefined) updates.brand_name = formData.brand_name;
      if (formData.brand_logo_url !== undefined) updates.brand_logo_url = formData.brand_logo_url;
      if (formData.primary_color !== undefined) updates.primary_color = formData.primary_color;
      if (formData.secondary_color !== undefined) updates.secondary_color = formData.secondary_color;
      if (formData.global_prompt !== undefined) updates.global_prompt = formData.global_prompt;
      if (formData.gallery_animation !== undefined) updates.gallery_animation = formData.gallery_animation;
      if (formData.gallery_speed !== undefined) updates.gallery_speed = formData.gallery_speed;
      if (formData.gallery_layout !== undefined) updates.gallery_layout = formData.gallery_layout;
      if (formData.stability_api_key !== undefined) updates.stability_api_key = formData.stability_api_key;
      if (formData.gallery_images_per_page !== undefined) updates.gallery_images_per_page = formData.gallery_images_per_page;
      if (formData.model_type !== undefined) updates.model_type = formData.model_type;
      if (formData.video_duration !== undefined) updates.video_duration = formData.video_duration;
      if (formData.face_preservation_mode !== undefined) updates.face_preservation_mode = formData.face_preservation_mode;
      if (formData.use_controlnet !== undefined) updates.use_controlnet = formData.use_controlnet;
      if (formData.controlnet_type !== undefined) updates.controlnet_type = formData.controlnet_type;

      const result = await updateConfig(updates);
      
      if (result) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        console.log('✅ Configuration updated successfully');
        await fetchConfig(); // Refresh to get latest data
      } else {
        throw new Error('Failed to update configuration');
      }
    } catch (error) {
      console.error('❌ Failed to update configuration:', error);
      setError(error instanceof Error ? error.message : 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
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
            ✅ Configuration updated successfully!
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-xl text-red-200"
          >
            ❌ {error}
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
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">
                            Animation Speed (ms)
                          </label>
                          <input
                            type="range"
                            name="gallery_speed"
                            value={formData.gallery_speed || 3000}
                            onChange={handleChange}
                            min={500}
                            max={10000}
                            step={500}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="text-center text-sm text-gray-400 mt-1">
                            {formData.gallery_speed || 3000}ms
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
                      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                        <Users className="w-6 h-6 text-purple-400" />
                        User Experience
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Gallery Features */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-gray-200">Gallery Features</h3>
                          
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              name="gallery_allow_downloads"
                              checked={formData.gallery_allow_downloads ?? true}
                              onChange={handleChange}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-2">
                              <Download className="w-4 h-4 text-green-400" />
                              <span>Allow Image Downloads</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              name="gallery_social_sharing"
                              checked={formData.gallery_social_sharing ?? true}
                              onChange={handleChange}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-2">
                              <Share2 className="w-4 h-4 text-blue-400" />
                              <span>Enable Social Sharing</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              name="gallery_show_metadata"
                              checked={formData.gallery_show_metadata ?? false}
                              onChange={handleChange}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-yellow-400" />
                              <span>Show Image Metadata</span>
                            </div>
                          </label>
                        </div>

                        {/* Display Options */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium text-gray-200">Display Options</h3>
                          
                          <div>
                            <label className="block text-sm font-medium mb-2 text-gray-300">Images per Page</label>
                            <select
                              name="gallery_images_per_page"
                              value={formData.gallery_images_per_page || 12}
                              onChange={handleChange}
                              className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                            >
                              <option value={6}>6 images</option>
                              <option value={12}>12 images</option>
                              <option value={18}>18 images</option>
                              <option value={24}>24 images</option>
                              <option value={36}>36 images</option>
                            </select>
                          </div>

                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              name="gallery_watermark_enabled"
                              checked={formData.gallery_watermark_enabled ?? false}
                              onChange={handleChange}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <div className="flex items-center gap-2">
                              <Image className="w-4 h-4 text-gray-400" />
                              <span>Add Watermark to Images</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Privacy Tab */}
                {activeTab === 'privacy' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
                      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                        <Lock className="w-6 h-6 text-red-400" />
                        Access Control
                      </h2>

                      <div className="space-y-6">
                        <label className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5 text-blue-400" />
                            <div>
                              <div className="font-medium">Public Gallery Access</div>
                              <div className="text-sm text-gray-400">Allow anyone to view the gallery</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="gallery_public_access"
                            checked={formData.gallery_public_access ?? true}
                            onChange={handleChange}
                            className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                          />
                        </label>

                        <label className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Lock className="w-5 h-5 text-red-400" />
                            <div>
                              <div className="font-medium">Require Admin for Controls</div>
                              <div className="text-sm text-gray-400">Hide admin controls from public users</div>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            name="gallery_require_admin"
                            checked={formData.gallery_require_admin ?? false}
                            onChange={handleChange}
                            className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                          />
                        </label>

                        <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-xl">
                          <div className="flex items-start gap-3">
                            <Eye className="w-5 h-5 text-yellow-400 mt-0.5" />
                            <div>
                              <div className="font-medium text-yellow-200">Admin Access</div>
                              <div className="text-sm text-yellow-300/80 mt-1">
                                Press <kbd className="px-2 py-1 bg-gray-800 rounded text-xs">Ctrl+Shift+A</kbd> in the gallery to toggle admin controls
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Advanced Tab */}
                {activeTab === 'advanced' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
                      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                        <Wand2 className="w-6 h-6 text-purple-400" />
                        AI Model Configuration
                      </h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Model Type</label>
                          <select
                            name="model_type"
                            value={formData.model_type || 'image'}
                            onChange={handleChange}
                            className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          >
                            <option value="image">Image Generation (SDXL)</option>
                            <option value="video">Video Generation</option>
                          </select>
                          <p className="text-xs text-gray-400 mt-2">
                            Choose between AI image or video generation
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-300">Face Preservation Mode</label>
                          <select
                            name="face_preservation_mode"
                            value={formData.face_preservation_mode || 'preserve_face'}
                            onChange={handleChange}
                            className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                          >
                            <option value="preserve_face">Preserve Face</option>
                            <option value="replace_face">Replace Face</option>
                          </select>
                          <p className="text-xs text-gray-400 mt-2">
                            Preserve original face or allow complete transformation
                          </p>
                        </div>
                      </div>

                      {/* ControlNet Settings */}
                      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                        <h3 className="text-lg font-medium text-blue-200 mb-4 flex items-center gap-2">
                          <Eye className="w-5 h-5" />
                          ControlNet (Advanced Pose & Structure Control)
                        </h3>
                        
                        <div className="space-y-4">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              name="use_controlnet"
                              checked={formData.use_controlnet ?? true}
                              onChange={handleChange}
                              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-white font-medium">Enable ControlNet</span>
                              <p className="text-sm text-gray-300">
                                Improves pose preservation, face-to-body matching, and overall consistency
                              </p>
                            </div>
                          </label>

                          {formData.use_controlnet && (
                            <div>
                              <label className="block text-sm font-medium mb-2 text-gray-300">ControlNet Type</label>
                              <select
                                name="controlnet_type"
                                value={formData.controlnet_type || 'auto'}
                                onChange={handleChange}
                                className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                              >
                                <option value="auto">Auto (Recommended)</option>
                                <option value="openpose">OpenPose (Body & Face Pose)</option>
                                <option value="canny">Canny Edge Detection</option>
                                <option value="depth">Depth Map</option>
                              </select>
                              <p className="text-xs text-gray-400 mt-2">
                                Auto mode automatically selects the best ControlNet type for your image
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      {formData.model_type === 'video' && (
                        <div className="mt-6">
                          <label className="block text-sm font-medium mb-2 text-gray-300">
                            Video Duration: {formData.video_duration || 5} seconds
                          </label>
                          <input
                            type="range"
                            name="video_duration"
                            value={formData.video_duration || 5}
                            onChange={handleChange}
                            min={1}
                            max={5}
                            step={1}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>1s</span>
                            <span>2s</span>
                            <span>3s</span>
                            <span>4s</span>
                            <span>5s</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6">
                      <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                        <Settings className="w-6 h-6 text-gray-400" />
                        API Configuration
                      </h2>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-300">Stability AI API Key</label>
                        <input
                          type="password"
                          name="stability_api_key"
                          value={formData.stability_api_key || ''}
                          onChange={handleChange}
                          placeholder="sk-..."
                          className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                        />
                        <p className="text-xs text-gray-400 mt-2">
                          Required for AI image generation. Get your key from{' '}
                          <a href="https://platform.stability.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                            platform.stability.ai
                          </a>
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Save Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4"
                >
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 text-white px-8 py-4 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-3 shadow-lg disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Saving Changes...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Configuration
                      </>
                    )}
                  </button>
                </motion.div>
              </form>
            </div>

            {/* Live Preview */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">Live Preview</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewMode('desktop')}
                        className={`p-2 rounded-lg transition ${
                          previewMode === 'desktop' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:text-white'
                        }`}
                      >
                        <Monitor className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setPreviewMode('mobile')}
                        className={`p-2 rounded-lg transition ${
                          previewMode === 'mobile' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-700 text-gray-300 hover:text-white'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Preview Window */}
                  <div className={`border rounded-lg overflow-hidden ${
                    previewMode === 'mobile' ? 'max-w-[240px] mx-auto' : 'w-full'
                  }`}>
                    {/* Navbar Preview */}
                    <div 
                      className="h-12 flex items-center px-4 text-sm"
                      style={{ backgroundColor: '#374151' }}
                    >
                      <span style={{ color: previewColors.primary }}>
                        {formData.brand_name || 'Virtual Photobooth'}
                      </span>
                    </div>

                    {/* Gallery Preview */}
                    <div className="bg-gray-900 p-4 aspect-[4/3]">
                      <div className="text-center mb-4">
                        <h2 
                          className="text-lg font-light"
                          style={{ color: previewColors.primary }}
                        >
                          Gallery
                        </h2>
                      </div>

                      {/* Grid Preview */}
                      <div className={`grid gap-2 ${
                        formData.gallery_layout === 'masonry' 
                          ? 'grid-cols-3' 
                          : formData.gallery_layout === 'carousel'
                          ? 'grid-cols-1'
                          : 'grid-cols-3'
                      }`}>
                        {[...Array(previewMode === 'mobile' ? 6 : 9)].map((_, i) => (
                          <div
                            key={i}
                            className="bg-gray-700 rounded aspect-square flex items-center justify-center"
                            style={{ 
                              height: formData.gallery_layout === 'masonry' 
                                ? Math.random() > 0.5 ? '40px' : '60px'
                                : '40px'
                            }}
                          >
                            <Image className="w-4 h-4 text-gray-500" />
                          </div>
                        ))}
                      </div>

                      {/* Animation Preview */}
                      <div className="mt-4 text-center">
                        <div className="text-xs text-gray-400">
                          Animation: {formData.gallery_animation || 'fade'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Speed: {formData.gallery_speed || 3000}ms
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Color Swatches */}
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div 
                        className="w-full h-8 rounded-lg mb-2"
                        style={{ backgroundColor: previewColors.primary }}
                      />
                      <div className="text-xs text-gray-400">Primary</div>
                    </div>
                    <div className="text-center">
                      <div 
                        className="w-full h-8 rounded-lg mb-2"
                        style={{ backgroundColor: previewColors.secondary }}
                      />
                      <div className="text-xs text-gray-400">Secondary</div>
                    </div>
                  </div>

                  {/* Settings Summary */}
                  <div className="mt-6 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Images/Page:</span>
                      <span>{formData.gallery_images_per_page || 12}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Layout:</span>
                      <span className="capitalize">{formData.gallery_layout || 'grid'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Downloads:</span>
                      <span>{formData.gallery_allow_downloads ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Metadata:</span>
                      <span>{formData.gallery_show_metadata ? 'Shown' : 'Hidden'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Model:</span>
                      <span className="capitalize">{formData.model_type || 'image'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Face Mode:</span>
                      <span className="capitalize">{(formData.face_preservation_mode || 'preserve_face').replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ControlNet:</span>
                      <span>{formData.use_controlnet ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    {formData.use_controlnet && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Control Type:</span>
                        <span className="capitalize">{formData.controlnet_type || 'auto'}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}