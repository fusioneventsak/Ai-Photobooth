import React from 'react';
import { Settings, Image as ImageIcon, Layout, Clock, Video, Wand2, Users, Eye } from 'lucide-react';
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
  const [enableFacePreservation, setEnableFacePreservation] = React.useState(true);
  const [facePreservationStrength, setFacePreservationStrength] = React.useState(0.3);

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
        use_provider_fallback: config.use_provider_fallback || false,
        enable_face_preservation: config.enable_face_preservation ?? true,
        face_preservation_strength: config.face_preservation_strength || 0.3
      });
      
      setImageProvider(config.image_provider || 'stability');
      setVideoProvider(config.video_provider || 'stability');
      setEnableFallback(config.use_provider_fallback || false);
      setEnableFacePreservation(config.enable_face_preservation ?? true);
      setFacePreservationStrength(config.face_preservation_strength || 0.3);
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

  const handleFacePreservationToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setEnableFacePreservation(checked);
    setFormData(prev => ({ ...prev, enable_face_preservation: checked }));
    setError(null);
    setSuccess(false);
  };

  const handleFaceStrengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setFacePreservationStrength(value);
    setFormData(prev => ({ ...prev, face_preservation_strength: value }));
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

      // Validate face preservation strength
      if (formData.enable_face_preservation) {
        const strength = Number(formData.face_preservation_strength);
        if (isNaN(strength) || strength < 0.1 || strength > 1.0) {
          throw new Error('Face preservation strength must be between 0.1 and 1.0');
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

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Branding Settings */}
          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Branding Settings
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
                placeholder="Your brand name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Brand Logo URL</label>
              <input
                type="url"
                name="brand_logo_url"
                value={formData.brand_logo_url || ''}
                onChange={handleChange}
                className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                placeholder="https://example.com/logo.png"
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

          {/* AI Generation Settings */}
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
                placeholder="Create a stunning astronaut portrait in space..."
              />
              <p className="mt-1 text-xs text-gray-400">
                This prompt will be used to generate AI content for all uploads. Face preservation will be automatically added.
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

              {formData.model_type === 'video' && (
                <>
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
                  </div>
                </>
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
              If your primary provider fails, automatically try the secondary provider.
            </p>
          </div>

          {/* Face Preservation Settings */}
          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Face Preservation Settings
            </h2>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enable_face_preservation"
                name="enable_face_preservation"
                checked={enableFacePreservation}
                onChange={handleFacePreservationToggle}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="enable_face_preservation" className="text-sm font-medium">
                Enable smart face preservation
              </label>
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              When enabled, the AI will preserve the subject's facial features in generated images.
            </p>

            {enableFacePreservation && (
              <div className="bg-gray-700 p-4 rounded-lg">
                <label className="block text-sm font-medium mb-2">
                  Preservation Strength: {Math.round(facePreservationStrength * 100)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={facePreservationStrength}
                  onChange={handleFaceStrengthChange}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>More Creative (10%)</span>
                  <span>Balanced (40%)</span>
                  <span>More Accurate (80%)</span>
                </div>
                <div className="mt-2 text-xs text-gray-300">
                  <strong>Current Setting:</strong>{' '}
                  {facePreservationStrength <= 0.2 ? 'Very Creative - Face features may change significantly' :
                   facePreservationStrength <= 0.4 ? 'Balanced - Good mix of creativity and face preservation' :
                   facePreservationStrength <= 0.6 ? 'Face-Focused - Strong preservation of facial features' :
                   'Maximum Preservation - Minimal changes to face'}
                </div>
              </div>
            )}

            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-300 mb-2 flex items-center gap-2">
                <Eye className="w-4 h-4" />
                How Face Preservation Works
              </h4>
              <ul className="text-xs text-blue-200 space-y-1">
                <li>• AI analyzes the subject's facial features</li>
                <li>• Generates content while preserving key facial characteristics</li>
                <li>• Lower strength = more creative liberty with face changes</li>
                <li>• Higher strength = stronger preservation of original features</li>
                <li>• Works best with clear, well-lit face photos</li>
              </ul>
            </div>
          </div>

          {/* Gallery Settings */}
          <div className="bg-gray-800 p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Layout className="w-5 h-5" />
              Gallery Settings
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Animation Style</label>
                <select
                  name="gallery_animation"
                  value={formData.gallery_animation || 'fade'}
                  onChange={handleChange}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="fade">Fade</option>
                  <option value="slide">Slide</option>
                  <option value="zoom">Zoom</option>
                  <option value="none">No Animation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Animation Speed (ms)
                </label>
                <input
                  type="number"
                  name="gallery_speed"
                  value={formData.gallery_speed || 3000}
                  onChange={handleChange}
                  min={500}
                  max={10000}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Layout Style</label>
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
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Settings className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}