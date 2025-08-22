// src/pages/OverlayIntegration.tsx - Complete updated version with trading card overlays
import React, { useState, useRef, ChangeEvent } from 'react';
import { Upload, Wand2, AlertCircle, RefreshCw, Image as ImageIcon, Layers, Settings, Eye, Info, Palette, Frame, Smartphone, Monitor, Square, Zap, Trophy } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { saveOverlayConfig, generateBuiltInBorder } from '../lib/overlayUtils';

type OverlayPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'top-center' | 'bottom-center';
type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light';
type AspectRatio = '1:1' | '9:16' | '16:9';

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
  category: 'elegant' | 'modern' | 'decorative' | 'tech' | 'trading';
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
    description: 'Instant photo border with transparent center',
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
  },
  // NEW TRADING CARD OVERLAYS
  {
    id: 'pokemon-classic',
    name: 'Pokemon Classic',
    description: 'Classic Pokemon card design with energy symbols',
    category: 'trading',
  },
  {
    id: 'pokemon-gx',
    name: 'Pokemon GX',
    description: 'Modern GX card style with holographic effect',
    category: 'trading',
  },
  {
    id: 'sports-baseball',
    name: 'Baseball Card',
    description: 'Classic baseball card with team colors',
    category: 'trading',
  },
  {
    id: 'sports-basketball',
    name: 'Basketball Card',
    description: 'Modern basketball card with court design',
    category: 'trading',
  },
  {
    id: 'sports-football',
    name: 'Football Card',
    description: 'NFL-style card with field pattern',
    category: 'trading',
  },
  {
    id: 'yugioh-classic',
    name: 'Yu-Gi-Oh Card',
    description: 'Classic duel monsters card frame',
    category: 'trading',
  },
];

// Aspect ratio configurations
const ASPECT_RATIOS = {
  '1:1': { width: 512, height: 512, label: 'Square (1:1)' },
  '9:16': { width: 512, height: 910, label: 'Portrait (9:16)' },
  '16:9': { width: 910, height: 512, label: 'Landscape (16:9)' }
};

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
  const [testImageAspectRatio, setTestImageAspectRatio] = useState<AspectRatio>('1:1');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedBorder, setSelectedBorder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'borders'>('borders');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const overlayFileRef = useRef<HTMLInputElement>(null);
  const testFileRef = useRef<HTMLInputElement>(null);

  // Auto-detect aspect ratio from image dimensions
  const detectAspectRatio = (width: number, height: number): AspectRatio => {
    const ratio = width / height;
    
    if (Math.abs(ratio - 1) < 0.1) {
      return '1:1'; // Square
    } else if (ratio < 1) {
      return '9:16'; // Portrait
    } else {
      return '16:9'; // Landscape
    }
  };

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

  // Handle test image upload with aspect ratio detection
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
        const imageData = e.target.result;
        
        // Auto-detect aspect ratio of test image
        const img = new Image();
        img.onload = () => {
          const detectedRatio = detectAspectRatio(img.width, img.height);
          setTestImageAspectRatio(detectedRatio);
          setSelectedAspectRatio(detectedRatio); // Auto-update selected ratio
          
          console.log('📱 Test image aspect ratio detected:', {
            dimensions: `${img.width}x${img.height}`,
            detectedRatio,
            ratio: img.width / img.height
          });
        };
        
        img.src = imageData;
        setTestImage(imageData);
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

  // Handle border selection with aspect ratio support
  const handleBorderSelect = (borderId: string) => {
    try {
      // Generate border for the selected aspect ratio
      const aspectConfig = ASPECT_RATIOS[selectedAspectRatio];
      const borderImage = generateBuiltInBorder(borderId, aspectConfig.width, aspectConfig.height);
      
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
      setOverlayName(`${border.name} (${ASPECT_RATIOS[selectedAspectRatio].label})`);
      
      // Auto-configure settings for borders
      setOverlaySettings(prev => ({
        ...prev,
        position: 'center',
        scale: 1.0, // Will be auto-scaled to fit image
        opacity: borderId.includes('holographic') || borderId.includes('aurora') || borderId.includes('gx') ? 0.7 : 0.9,
        blendMode: borderId.includes('metallic') || borderId.includes('chrome') ? 'multiply' : 'normal',
        offsetX: 0,
        offsetY: 0
      }));
      
      setError(null);
      console.log('✅ Built-in border selected:', borderId, 'for aspect ratio:', selectedAspectRatio);
    } catch (error) {
      console.error('Error selecting border:', error);
      setError(`Failed to select border: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle aspect ratio change and regenerate border if needed
  const handleAspectRatioChange = (newRatio: AspectRatio) => {
    setSelectedAspectRatio(newRatio);
    
    // Regenerate border if one is selected
    if (selectedBorder) {
      try {
        const aspectConfig = ASPECT_RATIOS[newRatio];
        const borderImage = generateBuiltInBorder(selectedBorder, aspectConfig.width, aspectConfig.height);
        
        if (borderImage) {
          setOverlayImage(borderImage);
          const border = BUILT_IN_BORDERS.find(b => b.id === selectedBorder);
          if (border) {
            setOverlayName(`${border.name} (${aspectConfig.label})`);
          }
          console.log('✅ Border regenerated for aspect ratio:', newRatio);
        }
      } catch (error) {
        console.error('Error regenerating border for new aspect ratio:', error);
        setError(`Failed to regenerate border for new aspect ratio`);
      }
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

      // Smart scaling based on overlay type and aspect ratio
      let finalScale = overlaySettings.scale;
      let overlayWidth = overlayImg.width * finalScale;
      let overlayHeight = overlayImg.height * finalScale;

      // Auto-scale logic
      if (selectedBorder) {
        // For borders: scale to exactly match canvas size
        overlayWidth = canvas.width;
        overlayHeight = canvas.height;
        console.log('📏 Auto-scaled border to canvas size:', `${overlayWidth}x${overlayHeight}`);
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
        console.log('📏 Auto-scaled logo/watermark:', { finalScale, size: `${overlayWidth}x${overlayHeight}` });
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

  // Save overlay configuration with aspect ratio support
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
        ...(selectedBorder && { 
          borderId: selectedBorder,
          aspectRatio: selectedAspectRatio // Store the aspect ratio for borders
        })
      };

      const success = saveOverlayConfig(overlayConfig);
      
      if (!success) {
        throw new Error('Failed to save overlay configuration');
      }
      
      const typeDescription = selectedBorder ? 'border/frame' : 'logo/watermark';
      alert(`✅ Overlay "${overlayName}" saved successfully as ${typeDescription}!\n\nThis overlay will now be automatically applied to all AI generated photos with smart auto-scaling for aspect ratio: ${ASPECT_RATIOS[selectedAspectRatio].label}.`);
      
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
    setSelectedAspectRatio('1:1');
    setTestImageAspectRatio('1:1');
    
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

  // Filter borders by category
  const filteredBorders = selectedCategory === 'all' 
    ? BUILT_IN_BORDERS 
    : BUILT_IN_BORDERS.filter(border => border.category === selectedCategory);

  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'modern': return <Square className="w-4 h-4" />;
      case 'elegant': return <Palette className="w-4 h-4" />;
      case 'decorative': return <Frame className="w-4 h-4" />;
      case 'tech': return <Zap className="w-4 h-4" />;
      case 'trading': return <Trophy className="w-4 h-4" />;
      default: return <Layers className="w-4 h-4" />;
    }
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
            Upload a custom overlay or choose from built-in borders including new trading card styles! 
            Now supports multiple aspect ratios and improved transparency.
          </p>
          
          {/* Size recommendations */}
          <div className="mt-4 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <h3 className="font-semibold text-blue-400 mb-2">NEW: Trading Card Overlays!</h3>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• <strong>Pokemon cards:</strong> Classic and GX holographic styles</li>
                  <li>• <strong>Sports cards:</strong> Baseball, Basketball, Football designs</li>
                  <li>• <strong>Yu-Gi-Oh cards:</strong> Classic duel monsters frame</li>
                  <li>• <strong>Improved Polaroid:</strong> Now with fully transparent center</li>
                  <li>• <strong>Perfect for portraits:</strong> All cards work great with 9:16 aspect ratio</li>
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
                  
                  {/* Aspect Ratio Selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Target Aspect Ratio</label>
                    <div className="flex gap-2">
                      {Object.entries(ASPECT_RATIOS).map(([ratio, config]) => (
                        <button
                          key={ratio}
                          onClick={() => handleAspectRatioChange(ratio as AspectRatio)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                            selectedAspectRatio === ratio
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {ratio === '1:1' && <Square className="w-4 h-4" />}
                          {ratio === '9:16' && <Smartphone className="w-4 h-4" />}
                          {ratio === '16:9' && <Monitor className="w-4 h-4" />}
                          {config.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Category Filter</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition ${
                          selectedCategory === 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        All
                      </button>
                      {['modern', 'elegant', 'decorative', 'tech', 'trading'].map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition capitalize ${
                            selectedCategory === category
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {getCategoryIcon(category)}
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {filteredBorders.map((border) => (
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
                          <div className={`text-xs px-2 py-1 rounded flex items-center justify-center gap-1 ${
                            border.category === 'modern' ? 'bg-blue-600/30 text-blue-300' :
                            border.category === 'elegant' ? 'bg-purple-600/30 text-purple-300' :
                            border.category === 'tech' ? 'bg-green-600/30 text-green-300' :
                            border.category === 'trading' ? 'bg-yellow-600/30 text-yellow-300' :
                            'bg-orange-600/30 text-orange-300'
                          }`}>
                            {getCategoryIcon(border.category)}
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
              
              {/* Display detected aspect ratio */}
              {testImage && (
                <div className="mb-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/30">
                  <div className="flex items-center gap-2 text-blue-300">
                    {testImageAspectRatio === '1:1' && <Square className="w-4 h-4" />}
                    {testImageAspectRatio === '9:16' && <Smartphone className="w-4 h-4" />}
                    {testImageAspectRatio === '16:9' && <Monitor className="w-4 h-4" />}
                    <span className="text-sm">
                      Detected: {ASPECT_RATIOS[testImageAspectRatio].label}
                    </span>
                  </div>
                </div>
              )}
              
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
                  className="w-auto flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
                >
                  <RefreshCw className="w-5 h-5" />
                  Reset
                </button>
              </div>
              <div className="mt-6 p-4 bg-green-900/30 rounded-lg border border-green-500/30">
                <h3 className="font-semibold text-green-400 mb-2">✨ New Features:</h3>
                <ul className="text-sm text-green-200 space-y-1">
                  <li>• <strong>Trading card overlays:</strong> Pokemon, Sports cards, Yu-Gi-Oh styles</li>
                  <li>• <strong>Improved Polaroid:</strong> Now with fully transparent center</li>
                  <li>• <strong>Category filtering:</strong> Easily find the style you want</li>
                  <li>• <strong>Perfect for portraits:</strong> Trading cards work great with 9:16 ratio</li>
                  <li>• <strong>Smart transparency:</strong> All overlays preserve photo visibility</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}