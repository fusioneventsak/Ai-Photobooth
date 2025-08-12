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
  EyeOff,
  Monitor,
  Smartphone,
  Grid3X3,
  Columns,
  Play,
  Pause,
  Download,
  Share2,
  Users,
  Lock,
  Unlock,
  Globe
} from 'lucide-react';

// Mock config store for demonstration
const useConfigStore = () => ({
  config: {
    id: '1',
    created_at: '2024-01-01',
    brand_name: 'Virtual Photobooth',
    brand_logo_url: null,
    primary_color: '#3B82F6',
    secondary_color: '#6B7280',
    global_prompt: 'Create a stunning artistic portrait',
    gallery_animation: 'fade',
    gallery_speed: 3000,
    gallery_layout: 'grid',
    stability_api_key: null,
    model_type: 'image',
    video_duration: 5,
    image_provider: 'stability',
    video_provider: 'stability',
    use_provider_fallback: true,
    face_preservation_mode: 'preserve_face',
    gallery_images_per_page: 12
  },
  fetchConfig: async () => {},
  updateConfig: async (data) => ({ ...data })
});

interface AdminFormData {
  brand_name?: string;
  brand_logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  global_prompt?: string;
  gallery_animation?: string;
  gallery_speed?: number;
  gallery_layout?: string;
  stability_api_key?: string;
  gallery_images_per_page?: number;
  gallery_public_access?: boolean;
  gallery_allow_downloads?: boolean;
  gallery_show_metadata?: boolean;
  gallery_require_admin?: boolean;
  gallery_watermark_enabled?: boolean;
  gallery_social_sharing?: boolean;
}

export default function Admin() {
  const { config, fetchConfig, updateConfig } = useConfigStore();
  const [formData, setFormData] = useState<AdminFormData>({});
  const [saving, setSaving] = useState(false);
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
      });
    }
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const success = await updateConfig(formData);
      if (success) {
        console.log('✅ Configuration updated successfully');
        await fetchConfig(); // Refresh to get latest data
      }
    } catch (error) {
      console.error('❌ Failed to update configuration:', error);
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

              <div className="space-y-8">
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
                    onClick={handleSubmit}
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
              </div>
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