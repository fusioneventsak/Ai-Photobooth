import React, { useState, useEffect } from 'react';
import { useConfigStore } from '../store/configStore';
import { Config } from '../types/config';
import { 
  Settings, 
  Users, 
  Eye, 
  Layout, 
  AlertTriangle,
  RefreshCw,
  UserX
} from 'lucide-react';

export default function Admin() {
  const { config, updateConfig } = useConfigStore();
  const [formData, setFormData] = useState<Partial<Config>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const updates: Partial<Config> = {};
      
      Object.entries(formData).forEach(([key, value]) => {
        if (config && value !== config[key as keyof Config]) {
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

  const getOptimalPromptForFaceMode = () => {
    const basePrompt = formData.global_prompt || '';
    const mode = formData.face_preservation_mode || 'preserve_face';
    
    if (mode === 'preserve_face') {
      return `${basePrompt}, preserve the exact facial features and expressions of the person, maintain original face structure, same person identity, keep all facial characteristics`;
    } else {
      return `${basePrompt}, generate new face that fits the scene, transform the person while maintaining body and background`;
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

        {/* Face Preservation Mode Selection */}
        <div className="mb-8 bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            AI Face Processing Mode
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                (formData.face_preservation_mode || 'preserve_face') === 'preserve_face' 
                  ? 'border-green-500 bg-green-900/30' 
                  : 'border-gray-600 bg-gray-800/30 hover:border-gray-500'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, face_preservation_mode: 'preserve_face' }))}
            >
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-green-400" />
                <h4 className="font-semibold text-green-300">Preserve Face</h4>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                Keep the person's face identical, transform background and clothing
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Maintains original identity</li>
                <li>• Changes scene, outfit, setting</li>
                <li>• Perfect for costume/environment changes</li>
              </ul>
            </div>

            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                formData.face_preservation_mode === 'replace_face' 
                  ? 'border-orange-500 bg-orange-900/30' 
                  : 'border-gray-600 bg-gray-800/30 hover:border-gray-500'
              }`}
              onClick={() => setFormData(prev => ({ ...prev, face_preservation_mode: 'replace_face' }))}
            >
              <div className="flex items-center gap-3 mb-2">
                <UserX className="w-5 h-5 text-orange-400" />
                <h4 className="font-semibold text-orange-300">Replace Face</h4>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                Generate new face/person, keep background and body pose
              </p>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Creates new identity/character</li>
                <li>• Preserves pose and setting</li>
                <li>• Great for character transformations</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded p-3">
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
              <div>
                <p className="text-xs font-medium text-blue-300 mb-1">Current Mode Preview:</p>
                <p className="text-xs text-gray-300 break-words">
                  {getOptimalPromptForFaceMode()}
                </p>
              </div>
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
                  {getOptimalPromptForFaceMode()}
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
                  Face processing works best with image generation
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
                    1-5 seconds (Note: Face processing is limited in videos)
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
                <li>• <strong>Primary:</strong> Stability AI Inpainting (precise face control)</li>
                <li>• <strong>Fallback:</strong> Stability AI Image-to-Image</li>
                <li>• <strong>Processing:</strong> Smart mask generation for face areas</li>
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
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Images per Page</label>
                <input
                  type="number"
                  name="gallery_images_per_page"
                  value={formData.gallery_images_per_page || 12}
                  onChange={handleChange}
                  min={6}
                  max={24}
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Hidden field for face_preservation_mode */}
          <input
            type="hidden"
            name="face_preservation_mode"
            value={formData.face_preservation_mode || 'preserve_face'}
          />

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}