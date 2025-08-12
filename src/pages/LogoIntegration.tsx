import React, { useState, useRef, ChangeEvent } from 'react';
import { Upload, Wand2, AlertCircle, RefreshCw, Image as ImageIcon, Layers, Settings, Eye, Info } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { uploadPhoto } from '../lib/supabase';

type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'top-center' | 'bottom-center';
type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light';

interface OverlaySettings {
  position: OverlayPosition;
  scale: number;
  opacity: number;
  blendMode: BlendMode;
  offsetX: number;
  offsetY: number;
}

export default function OverlayIntegration() {
  const { config } = useConfigStore();
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [overlayName, setOverlayName] = useState('');
  const [testImage, setTestImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const overlayFileRef = useRef<HTMLInputElement>(null);
  const testFileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    position: 'bottom-right',
    scale: 0.3,
    opacity: 0.8,
    blendMode: 'normal',
    offsetX: 20,
    offsetY: 20
  });

  // **FIXED: Handle overlay image upload with proper file reading**
  const handleOverlayChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    
    const file = event.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file for the overlay');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('Overlay file is too large (max 10MB)');
      return;
    }

    // **FIXED: Actually read the file and convert to base64**
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        console.log('✅ Overlay image loaded successfully:', {
          size: file.size,
          type: file.type,
          name: file.name
        });
        setOverlayImage(e.target.result);
        setError(null);
      } else {
        setError('Failed to read overlay image file');
      }
    };
    
    reader.onerror = () => {
      setError('Failed to read overlay image file');
    };
    
    reader.readAsDataURL(file);
  };

  // Handle test image upload
  const handleTestImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    
    const file = event.target.files[0];
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file for testing');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('Test image file is too large (max 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        setTestImage(e.target.result);
        setError(null);
      } else {
        setError('Failed to read test image file');
      }
    };
    
    reader.onerror = () => {
      setError('Failed to read test image file');
    };
    
    reader.readAsDataURL(file);
  };

  // Generate preview with overlay
  const generatePreview = async (overlayData: string, backgroundData: string) => {
    try {
      setError(null);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Cannot get canvas context');
      }

      // Load both images
      const bgImg = new Image();
      const overlayImg = new Image();

      await new Promise<void>((resolve, reject) => {
        let loadedCount = 0;
        
        const checkComplete = () => {
          loadedCount++;
          if (loadedCount === 2) resolve();
        };

        bgImg.onload = checkComplete;
        bgImg.onerror = () => reject(new Error('Failed to load background image'));
        
        overlayImg.onload = checkComplete;
        overlayImg.onerror = () => reject(new Error('Failed to load overlay image'));
        
        bgImg.src = backgroundData;
        overlayImg.src = overlayData;
      });

      // Set canvas size to background image size
      canvas.width = bgImg.width;
      canvas.height = bgImg.height;

      // Draw background
      ctx.drawImage(bgImg, 0, 0);

      // Calculate overlay position and size
      const overlayWidth = overlayImg.width * overlaySettings.scale;
      const overlayHeight = overlayImg.height * overlaySettings.scale;

      let overlayX = 0;
      let overlayY = 0;

      // Calculate position based on setting
      switch (overlaySettings.position) {
        case 'top-left':
          overlayX = overlaySettings.offsetX;
          overlayY = overlaySettings.offsetY;
          break;
        case 'top-right':
          overlayX = canvas.width - overlayWidth - overlaySettings.offsetX;
          overlayY = overlaySettings.offsetY;
          break;
        case 'bottom-left':
          overlayX = overlaySettings.offsetX;
          overlayY = canvas.height - overlayHeight - overlaySettings.offsetY;
          break;
        case 'bottom-right':
          overlayX = canvas.width - overlayWidth - overlaySettings.offsetX;
          overlayY = canvas.height - overlayHeight - overlaySettings.offsetY;
          break;
        case 'center':
          overlayX = (canvas.width - overlayWidth) / 2;
          overlayY = (canvas.height - overlayHeight) / 2;
          break;
        case 'top-center':
          overlayX = (canvas.width - overlayWidth) / 2;
          overlayY = overlaySettings.offsetY;
          break;
        case 'bottom-center':
          overlayX = (canvas.width - overlayWidth) / 2;
          overlayY = canvas.height - overlayHeight - overlaySettings.offsetY;
          break;
      }

      // Apply overlay settings
      ctx.globalAlpha = overlaySettings.opacity;
      ctx.globalCompositeOperation = overlaySettings.blendMode as GlobalCompositeOperation;

      // Draw overlay
      ctx.drawImage(overlayImg, overlayX, overlayY, overlayWidth, overlayHeight);

      // Reset canvas state
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Convert to data URL
      const resultDataUrl = canvas.toDataURL('image/png', 0.95);
      setResultImage(resultDataUrl);

    } catch (error) {
      console.error('Error generating preview:', error);
      setError('Failed to generate preview');
    }
  };

  // Update preview when settings change
  React.useEffect(() => {
    if (overlayImage && testImage) {
      generatePreview(overlayImage, testImage);
    }
  }, [overlaySettings, overlayImage, testImage]);

  // **ENHANCED: Save overlay configuration with better error handling**
  const saveOverlayConfig = async () => {
    if (!overlayImage || !overlayName.trim()) {
      setError('Please provide an overlay image and name');
      return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      console.log('💾 Saving overlay configuration...', {
        name: overlayName,
        hasImage: !!overlayImage,
        imageSize: overlayImage.length,
        settings: overlaySettings
      });

      // Save overlay configuration to localStorage
      const overlayConfig = {
        name: overlayName,
        image: overlayImage,
        settings: overlaySettings,
        createdAt: new Date().toISOString()
      };

      // Get existing overlays and add new one
      const existingOverlays = JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
      
      // Check if overlay with same name exists and ask for confirmation
      const existingIndex = existingOverlays.findIndex((overlay: any) => overlay.name === overlayName);
      if (existingIndex !== -1) {
        const shouldReplace = confirm(`An overlay named "${overlayName}" already exists. Do you want to replace it?`);
        if (shouldReplace) {
          existingOverlays[existingIndex] = overlayConfig;
        } else {
          setProcessing(false);
          return;
        }
      } else {
        existingOverlays.push(overlayConfig);
      }

      // Save to localStorage
      localStorage.setItem('photoboothOverlays', JSON.stringify(existingOverlays));
      
      console.log('✅ Overlay saved to localStorage successfully');

      // Also save test result to gallery if available
      if (resultImage) {
        try {
          const uploadResult = await uploadPhoto(
            resultImage,
            `Overlay Preview: ${overlayName} - ${overlaySettings.position} at ${Math.round(overlaySettings.scale * 100)}% scale`,
            'image'
          );

          if (uploadResult) {
            console.log('✅ Preview uploaded to gallery');
            // Dispatch gallery update
            window.dispatchEvent(new CustomEvent('galleryUpdate', {
              detail: { newPhoto: uploadResult, source: 'overlay_preview' }
            }));
          }
        } catch (uploadError) {
          console.warn('⚠️ Failed to upload preview to gallery:', uploadError);
          // Don't fail the whole process if gallery upload fails
        }
      }

      // Success message
      alert(`✅ Overlay "${overlayName}" saved successfully!\n\nThis overlay will now be automatically applied to all AI generated photos.\n\nRecommended overlay size: 200x200 to 512x512 pixels for best quality.`);
      
      // Reset form
      resetForm();
      
    } catch (err) {
      console.error('❌ Error saving overlay:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to save overlay';
      setError(`Failed to save overlay: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setOverlayImage(null);
    setOverlayName('');
    setTestImage(null);
    setResultImage(null);
    setError(null);
    setShowPreview(false);
    
    // Clear file inputs
    if (overlayFileRef.current) overlayFileRef.current.value = '';
    if (testFileRef.current) testFileRef.current.value = '';
    
    // Reset settings
    setOverlaySettings({
      position: 'bottom-right',
      scale: 0.3,
      opacity: 0.8,
      blendMode: 'normal',
      offsetX: 20,
      offsetY: 20
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center" style={{ color: config?.primary_color }}>
          <Layers className="w-10 h-10 inline mr-3" />
          Overlay Integration
        </h1>
        
        <div className="mb-6 text-center">
          <p className="text-gray-300">
            Upload a custom overlay (logo, watermark, frame) that will be automatically applied to all AI generated photos.
          </p>
          
          {/* **NEW: Size recommendations** */}
          <div className="mt-4 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h3 className="font-semibold text-blue-400 mb-2">Overlay Size Recommendations:</h3>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• <strong>Small logos/watermarks:</strong> 100x100 to 200x200 pixels</li>
                  <li>• <strong>Large logos:</strong> 300x300 to 512x512 pixels</li>
                  <li>• <strong>Frames/borders:</strong> Same size as your AI images (typically 512x512 or 1024x1024)</li>
                  <li>• <strong>File format:</strong> PNG with transparency for best results</li>
                  <li>• <strong>Max file size:</strong> 10MB</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Upload & Settings */}
          <div className="space-y-6">
            {/* Overlay Upload */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Overlay
              </h2>
              
              <div 
                onClick={() => overlayFileRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition"
              >
                {overlayImage ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={overlayImage} 
                      alt="Overlay Preview" 
                      className="max-h-32 max-w-full mb-2 rounded"
                    />
                    <p className="text-sm text-gray-400">Click to change overlay</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Layers className="w-12 h-12 mb-2 text-gray-500" />
                    <p>Upload your overlay image</p>
                    <p className="text-sm text-gray-500 mt-1">PNG with transparency recommended</p>
                  </div>
                )}
              </div>
              <input
                ref={overlayFileRef}
                type="file"
                onChange={handleOverlayChange}
                accept="image/*"
                className="hidden"
              />
              
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">Overlay Name *</label>
                <input
                  type="text"
                  value={overlayName}
                  onChange={(e) => setOverlayName(e.target.value)}
                  placeholder="e.g., Company Logo, Watermark, etc."
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                  required
                />
              </div>
            </div>

            {/* Test Image Upload */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Test Image (Optional)
              </h2>
              
              <div 
                onClick={() => testFileRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition"
              >
                {testImage ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={testImage} 
                      alt="Test Image Preview" 
                      className="max-h-32 max-w-full mb-2 rounded"
                    />
                    <p className="text-sm text-gray-400">Click to change test image</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <ImageIcon className="w-12 h-12 mb-2 text-gray-500" />
                    <p>Upload a test image to preview overlay</p>
                    <p className="text-sm text-gray-500 mt-1">See how your overlay will look</p>
                  </div>
                )}
              </div>
              <input
                ref={testFileRef}
                type="file"
                onChange={handleTestImageChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Overlay Settings */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Overlay Settings
              </h2>
              
              <div className="space-y-4">
                {/* Position */}
                <div>
                  <label className="block text-sm font-medium mb-2">Position</label>
                  <select
                    value={overlaySettings.position}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, position: e.target.value as OverlayPosition }))}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="top-left">Top Left</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-right">Top Right</option>
                    <option value="center">Center</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                  </select>
                </div>

                {/* Scale */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Scale: {Math.round(overlaySettings.scale * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={overlaySettings.scale}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                {/* Opacity */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Opacity: {Math.round(overlaySettings.opacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={overlaySettings.opacity}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                {/* Blend Mode */}
                <div>
                  <label className="block text-sm font-medium mb-2">Blend Mode</label>
                  <select
                    value={overlaySettings.blendMode}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, blendMode: e.target.value as BlendMode }))}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                    <option value="soft-light">Soft Light</option>
                    <option value="hard-light">Hard Light</option>
                  </select>
                </div>

                {/* Offset X */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Horizontal Offset: {overlaySettings.offsetX}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={overlaySettings.offsetX}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, offsetX: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                {/* Offset Y */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Vertical Offset: {overlaySettings.offsetY}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={overlaySettings.offsetY}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, offsetY: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Preview & Actions */}
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Preview
              </h2>
              
              <div className="border border-gray-600 rounded-lg p-4 min-h-[300px] flex items-center justify-center">
                {resultImage ? (
                  <img 
                    src={resultImage} 
                    alt="Overlay Preview" 
                    className="max-w-full max-h-[400px] rounded shadow-lg" 
                  />
                ) : overlayImage && testImage ? (
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-500" />
                    <p>Generating preview...</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <Layers className="w-12 h-12 mx-auto mb-3" />
                    <p>Upload overlay and test image to see preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Actions</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{error}</span>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                <button
                  onClick={saveOverlayConfig}
                  disabled={!overlayImage || !overlayName.trim() || processing}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition disabled:opacity-50"
                  style={{ backgroundColor: config?.primary_color }}
                >
                  <Wand2 className="w-5 h-5" />
                  {processing ? 'Saving...' : 'Save Overlay Configuration'}
                </button>
                
                <button
                  onClick={resetForm}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
                >
                  <RefreshCw className="w-5 h-5" />
                  Reset Form
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
                <h3 className="font-semibold text-blue-400 mb-2">How it works:</h3>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• Upload your overlay image (logo, watermark, etc.)</li>
                  <li>• Adjust position, size, and opacity settings</li>
                  <li>• Test with a sample image to preview the result</li>
                  <li>• Save configuration - it will apply to ALL future AI photos!</li>
                  <li>• Your overlay will be permanently embedded in generated images</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}