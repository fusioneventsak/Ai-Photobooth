// src/pages/OverlayIntegration.tsx - Fixed version with working built-in borders
import React, { useState, useRef, ChangeEvent } from 'react';
import { Upload, Wand2, AlertCircle, RefreshCw, Image as ImageIcon, Layers, Settings, Eye, Info, Palette, Frame } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { saveOverlayConfig, generateBuiltInBorder } from '../lib/overlayUtils';

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

interface BuiltInBorder {
  id: string;
  name: string;
  description: string;
  category: 'elegant' | 'modern' | 'decorative' | 'tech';
}

const BUILT_IN_BORDERS: BuiltInBorder[] = [
  {
    id: 'chrome-metallic',
    name: 'Chrome Metallic',
    description: 'Shiny chrome with realistic reflections',
    category: 'modern',
  },
  {
    id: 'rose-gold-gradient',
    name: 'Rose Gold Gradient',
    description: 'Luxurious rose gold with warm highlights',
    category: 'elegant',
  },
  {
    id: 'holographic-prism',
    name: 'Holographic Prism',
    description: 'Iridescent rainbow holographic effect',
    category: 'modern',
  },
  {
    id: 'copper-oxidized',
    name: 'Oxidized Copper',
    description: 'Weathered copper with patina effects',
    category: 'modern',
  },
  {
    id: 'titanium-brushed',
    name: 'Brushed Titanium',
    description: 'Industrial brushed metal finish',
    category: 'modern',
  },
  {
    id: 'aurora-gradient',
    name: 'Aurora Borealis',
    description: 'Northern lights inspired flowing gradient',
    category: 'modern',
  },
  {
    id: 'carbon-fiber',
    name: 'Carbon Fiber',
    description: 'High-tech woven carbon fiber pattern',
    category: 'tech',
  },
  {
    id: 'neon-circuit',
    name: 'Neon Circuit',
    description: 'Electric circuit board pattern with glow',
    category: 'tech',
  },
  {
    id: 'neon-cyber',
    name: 'Neon Glow',
    description: 'Cyberpunk-style glowing border',
    category: 'tech',
  },
  {
    id: 'film-strip',
    name: 'Film Strip',
    description: 'Classic cinema film border',
    category: 'modern',
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    description: 'Instant photo border with shadow',
    category: 'modern',
  },
  {
    id: 'ornate-baroque',
    name: 'Ornate Baroque',
    description: 'Decorative vintage-style border',
    category: 'decorative',
  },
  {
    id: 'minimal-line',
    name: 'Minimal Line',
    description: 'Clean, thin border line',
    category: 'modern',
  },
  {
    id: 'grunge-torn',
    name: 'Grunge Torn',
    description: 'Rough, distressed edge effect',
    category: 'decorative',
  },
  {
    id: 'tech-grid',
    name: 'Tech Grid',
    description: 'Futuristic grid pattern border',
    category: 'tech',
  }
];

export default function OverlayIntegration() {
  const { config } = useConfigStore();
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [overlayName, setOverlayName] = useState('');
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    position: 'bottom-right',
    scale: 0.3,
    opacity: 0.8,
    blendMode: 'normal',
    offsetX: 20,
    offsetY: 20
  });
  const [testImage, setTestImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedBorder, setSelectedBorder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'borders'>('borders');

  const overlayFileRef = useRef<HTMLInputElement>(null);
  const testFileRef = useRef<HTMLInputElement>(null);

  // Handle overlay file upload
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

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        const imageData = e.target.result;
        
        // Load image to analyze dimensions for smart settings
        const img = new Image();
        img.onload = () => {
          const imageWidth = img.width;
          const imageHeight = img.height;
          
          console.log('📐 Analyzing uploaded image:', {
            dimensions: `${imageWidth}x${imageHeight}`,
            fileName: file.name
          });
          
          // Smart detection: Is this likely a border/frame or a logo/watermark?
          const isLikelyBorder = imageWidth >= 800 && imageHeight >= 800;
          
          setOverlayImage(imageData);
          setSelectedBorder(null); // Clear border selection
          
          // Auto-configure settings based on image analysis
          if (isLikelyBorder) {
            // Large image - treat as border/frame
            setOverlaySettings(prev => ({
              ...prev,
              position: 'center',
              scale: 1.0, // Will auto-scale to fit
              opacity: 0.85,
              blendMode: 'normal',
              offsetX: 0,
              offsetY: 0
            }));
            console.log('🖼️ Configured as border/frame');
          } else {
            // Smaller image - treat as logo/watermark
            setOverlaySettings(prev => ({
              ...prev,
              position: 'bottom-right', // Classic watermark position
              scale: 0.25, // Will auto-scale proportionally
              opacity: 0.8,
              blendMode: 'normal',
              offsetX: 20,
              offsetY: 20
            }));
            console.log('🏷️ Configured as logo/watermark');
          }
          
          setError(null);
        };
        
        img.onerror = () => {
          setError('Failed to analyze uploaded image');
        };
        
        img.src = imageData;
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

  // Handle border selection with auto-settings
  const handleBorderSelect = (borderId: string) => {
    try {
      // Generate border at preview resolution
      const borderImage = generateBuiltInBorder(borderId, 512, 512);
      if (!borderImage) {
        setError(`Failed to generate border: ${borderId}`);
        return;
      }

      const border = BUILT_IN_BORDERS.find(b => b.id === borderId);
      if (!border) {
        setError(`Border definition not found: ${borderId}`);
        return;
      }

      setOverlayImage(borderImage);
      setSelectedBorder(borderId);
      setOverlayName(border.name);
      
      // Auto-configure settings for borders
      setOverlaySettings(prev => ({
        ...prev,
        position: 'center',
        scale: 1.0, // Will be auto-scaled to fit image
        opacity: borderId.includes('holographic') || borderId.includes('aurora') ? 0.7 : 0.9,
        blendMode: borderId.includes('metallic') || borderId.includes('chrome') ? 'multiply' : 'normal',
        offsetX: 0,
        offsetY: 0
      }));
      
      setError(null);
      console.log('✅ Built-in border selected:', borderId);
    } catch (error) {
      console.error('Error selecting border:', error);
      setError(`Failed to select border: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Generate preview with overlay and proper scaling
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

      // Smart scaling based on overlay type
      let finalScale = overlaySettings.scale;
      let overlayWidth = overlayImg.width * finalScale;
      let overlayHeight = overlayImg.height * finalScale;

      // Auto-scale logic
      if (selectedBorder) {
        // For borders: scale to match canvas size exactly
        finalScale = 1.0;
        overlayWidth = canvas.width;
        overlayHeight = canvas.height;
      } else {
        // For logos/watermarks: intelligent scaling based on canvas size
        const canvasSize = Math.min(canvas.width, canvas.height);
        const overlaySize = Math.max(overlayImg.width, overlayImg.height);
        
        // Auto-scale if overlay is too large
        if (overlaySize > canvasSize * 0.5) {
          const autoScale = (canvasSize * 0.3) / overlaySize;
          finalScale = Math.min(finalScale, autoScale);
          overlayWidth = overlayImg.width * finalScale;
          overlayHeight = overlayImg.height * finalScale;
        }
      }

      // Position calculation
      let x = 0, y = 0;
      
      switch (overlaySettings.position) {
        case 'top-left':
          x = overlaySettings.offsetX;
          y = overlaySettings.offsetY;
          break;
        case 'top-right':
          x = canvas.width - overlayWidth - overlaySettings.offsetX;
          y = overlaySettings.offsetY;
          break;
        case 'bottom-left':
          x = overlaySettings.offsetX;
          y = canvas.height - overlayHeight - overlaySettings.offsetY;
          break;
        case 'bottom-right':
          x = canvas.width - overlayWidth - overlaySettings.offsetX;
          y = canvas.height - overlayHeight - overlaySettings.offsetY;
          break;
        case 'center':
          x = (canvas.width - overlayWidth) / 2 + overlaySettings.offsetX;
          y = (canvas.height - overlayHeight) / 2 + overlaySettings.offsetY;
          break;
        case 'top-center':
          x = (canvas.width - overlayWidth) / 2 + overlaySettings.offsetX;
          y = overlaySettings.offsetY;
          break;
        case 'bottom-center':
          x = (canvas.width - overlayWidth) / 2 + overlaySettings.offsetX;
          y = canvas.height - overlayHeight - overlaySettings.offsetY;
          break;
      }

      // Apply overlay settings
      ctx.globalAlpha = overlaySettings.opacity;
      ctx.globalCompositeOperation = overlaySettings.blendMode as GlobalCompositeOperation;

      // Draw overlay
      ctx.drawImage(overlayImg, x, y, overlayWidth, overlayHeight);

      // Reset context
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      return canvas.toDataURL('image/jpeg', 0.9);

    } catch (error) {
      console.error('Preview generation error:', error);
      throw error;
    }
  };

  // Generate preview when settings change
  const handlePreviewGeneration = async () => {
    if (!overlayImage || !testImage) {
      setError('Please select both an overlay and test image');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await generatePreview(overlayImage, testImage);
      setResultImage(result);
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      setError('Failed to generate preview. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Save overlay configuration
  const handleSaveOverlay = async () => {
    if (!overlayImage || !overlayName.trim()) {
      setError('Please provide both an overlay image and name');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const overlayConfig = {
        name: overlayName.trim(),
        image: overlayImage,
        settings: overlaySettings,
        createdAt: new Date().toISOString(),
        type: selectedBorder ? 'border' as const : 'custom' as const,
        ...(selectedBorder && { borderId: selectedBorder })
      };

      const success = saveOverlayConfig(overlayConfig);
      
      if (!success) {
        throw new Error('Failed to save overlay configuration');
      }
      
      const typeDescription = selectedBorder ? 'border/frame' : 'logo/watermark';
      alert(`✅ Overlay "${overlayName}" saved successfully as ${typeDescription}!\n\nThis overlay will now be automatically applied to all AI generated photos with smart auto-scaling.`);
      
      // Reset form
      resetForm();
      
    } catch (err) {
      console.error('Error saving overlay:', err);
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
    setSelectedBorder(null);
    
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

  const canSave = !!overlayImage && overlayName.trim().length > 0 && !processing;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center" style={{ color: config?.primary_color }}>
          <Layers className="w-10 h-10 inline mr-3" />
          Overlay Integration
        </h1>
        
        <div className="mb-6 text-center">
          <p className="text-gray-300">
            Upload a custom overlay or choose from built-in borders that will be automatically applied to all AI generated photos.
          </p>
          
          {/* Size recommendations */}
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
          {/* Left Column - Upload & Borders */}
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                    activeTab === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Custom Upload
                </button>
                <button
                  onClick={() => setActiveTab('borders')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                    activeTab === 'borders' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Frame className="w-4 h-4" />
                  Built-in Borders
                </button>
              </div>

              {activeTab === 'upload' ? (
                /* Custom Upload Tab */
                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Upload Custom Overlay
                  </h2>
                  
                  <div 
                    onClick={() => overlayFileRef.current?.click()}
                    className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition"
                  >
                    {overlayImage && !selectedBorder ? (
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
                </div>
              ) : (
                /* Built-in Borders Tab */
                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Choose Built-in Border
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {BUILT_IN_BORDERS.map((border) => (
                      <div
                        key={border.id}
                        onClick={() => handleBorderSelect(border.id)}
                        className={`p-3 rounded-lg cursor-pointer transition border-2 ${
                          selectedBorder === border.id
                            ? 'border-blue-500 bg-blue-900/30'
                            : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-sm font-medium mb-1">{border.name}</div>
                          <div className="text-xs text-gray-400 mb-2">{border.description}</div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            border.category === 'modern' ? 'bg-blue-600/30 text-blue-300' :
                            border.category === 'elegant' ? 'bg-purple-600/30 text-purple-300' :
                            border.category === 'tech' ? 'bg-green-600/30 text-green-300' :
                            'bg-orange-600/30 text-orange-300'
                          }`}>
                            {border.category}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Overlay Settings */}
            {overlayImage && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Overlay Settings
                </h2>
                
                <div className="space-y-4">
                  {/* Overlay Name */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Overlay Name</label>
                    <input
                      type="text"
                      value={overlayName}
                      onChange={(e) => setOverlayName(e.target.value)}
                      placeholder="Enter overlay name"
                      className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400"
                    />
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Position</label>
                    <select
                      value={overlaySettings.position}
                      onChange={(e) => setOverlaySettings(prev => ({ ...prev, position: e.target.value as OverlayPosition }))}
                      className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
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
                    <label className="block text-sm font-medium mb-1">
                      Scale: {overlaySettings.scale.toFixed(2)}x
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.05"
                      value={overlaySettings.scale}
                      onChange={(e) => setOverlaySettings(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>

                  {/* Opacity */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
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
                    <label className="block text-sm font-medium mb-1">Blend Mode</label>
                    <select
                      value={overlaySettings.blendMode}
                      onChange={(e) => setOverlaySettings(prev => ({ ...prev, blendMode: e.target.value as BlendMode }))}
                      className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                      <option value="soft-light">Soft Light</option>
                      <option value="hard-light">Hard Light</option>
                    </select>
                  </div>

                  {/* Offsets */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Offset X: {overlaySettings.offsetX}px
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={overlaySettings.offsetX}
                        onChange={(e) => setOverlaySettings(prev => ({ ...prev, offsetX: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Offset Y: {overlaySettings.offsetY}px
                      </label>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={overlaySettings.offsetY}
                        onChange={(e) => setOverlaySettings(prev => ({ ...prev, offsetY: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Preview & Testing */}
          <div className="space-y-6">
            {/* Test Image Upload */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Test with Sample Image
              </h2>
              
              <div 
                onClick={() => testFileRef.current?.click()}
                className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition"
              >
                {testImage ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={testImage} 
                      alt="Test Preview" 
                      className="max-h-32 max-w-full mb-2 rounded"
                    />
                    <p className="text-sm text-gray-400">Click to change test image</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <ImageIcon className="w-12 h-12 mb-2 text-gray-500" />
                    <p>Upload a test image</p>
                    <p className="text-sm text-gray-500 mt-1">See how your overlay looks</p>
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

              {/* Generate Preview Button */}
              {overlayImage && testImage && (
                <button
                  onClick={handlePreviewGeneration}
                  disabled={processing}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  <Eye className="w-5 h-5" />
                  {processing ? 'Generating...' : 'Generate Preview'}
                </button>
              )}
            </div>

            {/* Preview Result */}
            {resultImage && showPreview && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Preview Result</h2>
                <div className="text-center">
                  <img 
                    src={resultImage} 
                    alt="Preview Result" 
                    className="max-w-full h-auto rounded-lg border border-gray-600"
                  />
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-200">{error}</p>
              </div>
            )}

            {/* Save Controls */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex gap-3">
                <button
                  onClick={handleSaveOverlay}
                  disabled={!canSave}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition ${
                    canSave ? 'hover:opacity-90' : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{ backgroundColor: config?.primary_color || '#3B82F6' }}
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
                  <li>• Upload custom overlay or choose a built-in border</li>
                  <li>• Adjust position, size, and opacity settings</li>
                  <li>• Test with a sample image to preview the result</li>
                  <li>• Save configuration - it will apply to ALL future AI photos!</li>
                  <li>• Your overlay will be permanently embedded in generated images</li>
                  <li>• <strong>Note:</strong> Only one overlay can be active at a time</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}