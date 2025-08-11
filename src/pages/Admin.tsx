import React from 'react';
import { Settings, Image as ImageIcon, Layout, Clock, Video, Wand2, Users, Eye, AlertTriangle } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import type { Config } from '../types/supabase';

export default function Admin() {
  const { config, updateConfig } = useConfigStore();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<Config>>({});

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
        video_duration: config.video_duration
      });
    }
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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

  const getOptimalPromptForFacePreservation = () => {
    const basePrompt = formData.global_prompt || '';
    return `${basePrompt}, preserve the exact facial features and expressions of the person, maintain original face structure, same person identity, keep all facial characteristics`;
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

        {/* Face Preservation Info Box */}
        <div className="mb-8 bg-blue-900/30 border border-blue-500/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-300 mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Smart Face Preservation System
          </h3>
          <div className="space-y-3 text-sm text-blue-200">
            <p>
              <strong>✨ Automatic Face Preservation is now enabled!</strong> Your photobooth automatically preserves subjects' faces using advanced AI prompting.
            </p>
            <div className="bg-blue-800/30 rounded p-3">
              <p className="font-medium mb-2">How it works:</p>
              <ul className="space-y-1 text-xs">
                <li>• AI analyzes facial features in the original photo</li>
                <li>• Enhanced prompts preserve key facial characteristics</li>
                <li>• Lower transformation strength maintains face structure</li>
                <li>• Smart negative prompts prevent unwanted face changes</li>
              </ul>
            </div>
            <div className="flex items-start gap-2 mt-3">
              <Eye className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p className="text-xs">
                <strong>Current prompt will be enhanced with:</strong><br/>
                "preserve the exact facial features and expressions of the person, maintain original face structure, same person identity"
              </p>
            </div>
          </div>
        </div>

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
              <div className="mt-2 p-3 bg-green-900/30 border border-green-500/50 rounded">
                <p className="text-xs text-green-300 font-medium mb-1">✨ Auto-Enhanced Prompt Preview:</p>
                <p className="text-xs text-green-200 break-words">
                  {getOptimalPromptForFacePreservation()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Generation Type</label>
                <select
                  name="model_type"
                  value={formData.model_type || 'image'}
                  onChange={handleChange}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="image">Image Generation</option>
                  <option value="video">Video Generation</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Face preservation works best with image generation
                </p>
              </div>

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
                  <p className="text-xs text-gray-400 mt-1">
                    1-5 seconds (Note: Face preservation is limited in videos)
                  </p>
                </div>
              )}
            </div>

            {/* AI Provider Info */}
            <div className="bg-gray-700 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                AI Provider Configuration
              </h4>
              <p className="text-xs text-gray-400 mb-2">
                Your photobooth automatically uses the best available AI service:
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• <strong>Primary:</strong> Stability AI (better face preservation)</li>
                <li>• <strong>Fallback:</strong> Replicate (if Stability AI fails)</li>
                <li>• <strong>Face preservation:</strong> Enhanced prompts + lower transformation strength</li>
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
                Saving Settings...
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