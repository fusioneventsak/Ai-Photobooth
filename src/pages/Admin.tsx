import React from 'react';
import { Settings, Image as ImageIcon, Layout, Clock, Video, Wand2 } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import type { Config } from '../types/supabase';

export default function Admin() {
  const { config, updateConfig } = useConfigStore();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<Config>>({});
  const [imageProvider, setImageProvider] = React.useState<'stability' | 'replicate'>('stability');
  const [videoProvider, setVideoProvider] = React.useState<'stability' | 'replicate'>('stability');
  const [enableFallback, setEnableFallback] = React.useState(false);

  React.useEffect(() => {
    if (config) {
      setFormData({
        brand_name: config.brand_name,
        brand_logo_url: config.brand_logo_url,
        primary_color: config.primary_color,
        secondary_color: config.secondary_color,
        global_prompt: config.global_prompt,
        gallery_animation: config.gallery_animation,
        gallery_speed: config.gallery_speed,
        gallery_layout: config.gallery_layout,
        model_type: config.model_type,
        video_duration: config.video_duration,
        image_provider: config.image_provider || 'stability',
        video_provider: config.video_provider || 'stability',
        use_provider_fallback: config.use_provider_fallback || false
      });
      
      setImageProvider(config.image_provider || 'stability');
      setVideoProvider(config.video_provider || 'stability');
      setEnableFallback(config.use_provider_fallback || false);
    }
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleProviderChange = (type: 'image' | 'video', value: 'stability' | 'replicate') => {
    if (type === 'image') {
      setImageProvider(value);
      setFormData(prev => ({ ...prev, image_provider: value }));
    } else {
      setVideoProvider(value);
      setFormData(prev => ({ ...prev, video_provider: value }));
    }
    setError(null);
    setSuccess(false);
  };

  const handleFallbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEnableFallback(checked);
    setFormData(prev => ({ ...prev, use_provider_fallback: checked }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate required fields
      if (!formData.brand_name?.trim()) {
        throw new Error('Brand name is required');
      }

      if (!formData.global_prompt?.trim()) {
        throw new Error('Global prompt is required');
      }

      // Validate color formats
      const colorRegex = /^#[0-9A-F]{6}$/i;
      if (!colorRegex.test(formData.primary_color || '')) {
        throw new Error('Invalid primary color format');
      }
      if (!colorRegex.test(formData.secondary_color || '')) {
        throw new Error('Invalid secondary color format');
      }

      // Validate gallery speed
      const speed = Number(formData.gallery_speed);
      if (isNaN(speed) || speed < 500 || speed > 10000) {
        throw new Error('Gallery speed must be between 500 and 10000');
      }

      // Validate video duration
      if (formData.model_type === 'video') {
        const duration = Number(formData.video_duration);
        if (isNaN(duration) || duration < 1 || duration > 5) {
          throw new Error('Video duration must be between 1 and 5 seconds');
        }
      }

      // Create updates object with only changed fields
      const updates: Partial<Config> = {};
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== config?.[key as keyof Config]) {
          updates[key as keyof Config] = value;
        }
      });

      if (Object.keys(updates).length === 0) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        return;
      }

      const result = await updateConfig(updates);
      if (!result) {
        throw new Error('Failed to update settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading configuration...</h2>
          <p className="text-gray-400">Please wait while we load your settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Admin Panel</h1>
        
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-lg text-green-200">
            Settings saved successfully!
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Branding
            </h2>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="brand_name"
                value={formData.brand_name || ''}
                onChange={handleChange}
                required
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Logo URL</label>
              <input
                type="url"
                name="brand_logo_url"
                value={formData.brand_logo_url || ''}
                onChange={handleChange}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Primary Color <span className="text-red-500">*</span>
                </label>
                <input
                  type="color"
                  name="primary_color"
                  value={formData.primary_color || '#3B82F6'}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-700 rounded-lg h-10"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Secondary Color <span className="text-red-500">*</span>
                </label>
                <input
                  type="color"
                  name="secondary_color"
                  value={formData.secondary_color || '#6B7280'}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-700 rounded-lg h-10"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              AI Generation Settings
            </h2>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Global Prompt <span className="text-red-500">*</span>
              </label>
              <textarea
                name="global_prompt"
                value={formData.global_prompt || ''}
                onChange={handleChange}
                required
                rows={3}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                placeholder="Enter a prompt that will be applied to all photos..."
              />
              <p className="mt-1 text-xs text-gray-400">
                This prompt will be used to generate AI content for all uploads
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Model Type</label>
                <select
                  name="model_type"
                  value={formData.model_type || 'image'}
                  onChange={handleChange}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>
              
              {/* Image Provider Selection - Always visible */}
              <div>
                <label className="block text-sm font-medium mb-1">Image Provider</label>
                <select
                  name="image_provider"
                  value={imageProvider}
                  onChange={(e) => handleProviderChange('image', e.target.value as 'stability' | 'replicate')}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="stability">Stability AI</option>
                  <option value="replicate">Replicate</option>
                </select>
              </div>

              {/* Video Provider Selection - Only visible when model type is video */}
              {formData.model_type === 'video' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Video Provider</label>
                  <select
                    name="video_provider"
                    value={videoProvider}
                    onChange={(e) => handleProviderChange('video', e.target.value as 'stability' | 'replicate')}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="stability">Stability AI</option>
                    <option value="replicate">Replicate</option>
                  </select>
                </div>
              )}

              {formData.model_type === 'video' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Video Duration (seconds)
                  </label>
                  <input
                    type="number"
                    name="video_duration"
                    value={formData.video_duration || 5}
                    onChange={handleChange}
                    min={1}
                    max={5}
                    className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Duration must be between 1 and 5 seconds
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="use_provider_fallback"
                name="use_provider_fallback"
                checked={enableFallback}
                onChange={handleFallbackChange}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="use_provider_fallback" className="text-sm font-medium">
                Enable provider fallback
              </label>
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              When enabled, if your primary AI provider fails, the system will try your secondary provider.
              When disabled, only the selected provider will be used.
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Layout className="w-5 h-5" />
              Gallery Settings
            </h2>
            
            <div>
              <label className="block text-sm font-medium mb-1">Layout</label>
              <select
                name="gallery_layout"
                value={formData.gallery_layout || 'grid'}
                onChange={handleChange}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="grid">Grid</option>
                <option value="masonry">Masonry</option>
                <option value="carousel">Carousel</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Animation</label>
              <select
                name="gallery_animation"
                value={formData.gallery_animation || 'fade'}
                onChange={handleChange}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
                <option value="zoom">Zoom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Animation Speed (ms)
                </span>
              </label>
              <input
                type="number"
                name="gallery_speed"
                value={formData.gallery_speed || 3000}
                onChange={handleChange}
                min={500}
                max={10000}
                step={100}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
              />
              <p className="mt-1 text-xs text-gray-400">
                Speed must be between 500ms and 10000ms
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-4 py-2 text-white font-medium transition"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}