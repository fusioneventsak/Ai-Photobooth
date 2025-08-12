import React, { useState, useRef, ChangeEvent } from 'react';
import { Upload, Wand2, AlertCircle, RefreshCw, Image as ImageIcon, Layers, Settings, Eye, Info, Palette, Frame } from 'lucide-react';
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

interface BuiltInBorder {
  id: string;
  name: string;
  description: string;
  category: 'elegant' | 'modern' | 'decorative' | 'tech';
  generateCanvas: (width: number, height: number) => string;
}

const BUILT_IN_BORDERS: BuiltInBorder[] = [
  {
    id: 'chrome-metallic',
    name: 'Chrome Metallic',
    description: 'Shiny chrome with realistic reflections',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.06;
      
      // Chrome gradient - outer
      const chromeGrad = ctx.createLinearGradient(0, 0, 0, height);
      chromeGrad.addColorStop(0, '#E8E8E8');
      chromeGrad.addColorStop(0.1, '#F8F8F8');
      chromeGrad.addColorStop(0.2, '#C8C8C8');
      chromeGrad.addColorStop(0.3, '#F0F0F0');
      chromeGrad.addColorStop(0.4, '#A8A8A8');
      chromeGrad.addColorStop(0.6, '#D8D8D8');
      chromeGrad.addColorStop(0.7, '#B8B8B8');
      chromeGrad.addColorStop(0.8, '#F0F0F0');
      chromeGrad.addColorStop(0.9, '#C8C8C8');
      chromeGrad.addColorStop(1, '#E8E8E8');
      
      ctx.fillStyle = chromeGrad;
      ctx.fillRect(0, 0, width, height);
      
      // Inner beveled edge
      const innerGrad = ctx.createLinearGradient(0, 0, 0, height);
      innerGrad.addColorStop(0, '#FFFFFF');
      innerGrad.addColorStop(0.5, '#CCCCCC');
      innerGrad.addColorStop(1, '#999999');
      
      ctx.fillStyle = innerGrad;
      ctx.fillRect(borderWidth*0.3, borderWidth*0.3, width - borderWidth*0.6, height - borderWidth*0.6);
      
      // Clear center
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    }
  },
  {
    id: 'rose-gold-gradient',
    name: 'Rose Gold Gradient',
    description: 'Luxurious rose gold with warm highlights',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.05;
      
      // Rose gold gradient
      const roseGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
      roseGrad.addColorStop(0, '#F7E7CE');
      roseGrad.addColorStop(0.2, '#E8B4B8');
      roseGrad.addColorStop(0.4, '#D4A574');
      roseGrad.addColorStop(0.6, '#C49991');
      roseGrad.addColorStop(0.8, '#B87333');
      roseGrad.addColorStop(1, '#8B4513');
      
      ctx.fillStyle = roseGrad;
      ctx.fillRect(0, 0, width, height);
      
      // Highlight shimmer
      const shimmerGrad = ctx.createLinearGradient(0, 0, width, height);
      shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      shimmerGrad.addColorStop(0.3, 'rgba(255, 192, 203, 0.2)');
      shimmerGrad.addColorStop(0.7, 'rgba(255, 215, 0, 0.15)');
      shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
      
      ctx.fillStyle = shimmerGrad;
      ctx.fillRect(0, 0, width, height);
      
      // Clear center
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    }
  },
  {
    id: 'holographic-prism',
    name: 'Holographic Prism',
    description: 'Iridescent rainbow holographic effect',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.04;
      
      // Create multiple overlapping gradients for holographic effect
      const gradients = [
        { colors: ['#FF0080', '#00FFFF', '#8000FF'], angle: 0 },
        { colors: ['#00FF80', '#FF8000', '#0080FF'], angle: 45 },
        { colors: ['#FF8080', '#80FF00', '#8080FF'], angle: 90 },
        { colors: ['#FFFF00', '#FF00FF', '#00FFFF'], angle: 135 }
      ];
      
      ctx.globalCompositeOperation = 'screen';
      
      gradients.forEach((grad, index) => {
        const angle = (grad.angle * Math.PI) / 180;
        const x1 = width/2 - Math.cos(angle) * width/2;
        const y1 = height/2 - Math.sin(angle) * height/2;
        const x2 = width/2 + Math.cos(angle) * width/2;
        const y2 = height/2 + Math.sin(angle) * height/2;
        
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.colors.forEach((color, i) => {
          gradient.addColorStop(i / (grad.colors.length - 1), color + '40');
        });
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });
      
      ctx.globalCompositeOperation = 'source-over';
      
      // Clear center
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    }
  },
  // Add more borders here as needed...
];

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
  const [selectedBorder, setSelectedBorder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'borders'>('upload');
  
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

  // Handle overlay image upload with smart auto-settings
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
          const imageSize = Math.max(imageWidth, imageHeight);
          
          console.log('📐 Analyzing uploaded image:', {
            dimensions: `${imageWidth}x${imageHeight}`,
            maxSize: imageSize,
            fileName: file.name
          });
          
          // FIXED: Clear any selected border when custom overlay is uploaded
          setSelectedBorder(null);
          setOverlayImage(imageData);
          setOverlayName(file.name.replace(/\.[^/.]+$/, "")); // Use filename as default name
          
          // Smart detection: Is this likely a border/frame or a logo/watermark?
          const isLikelyBorder = imageWidth >= 800 && imageHeight >= 800;
          const isSquareish = Math.abs(imageWidth - imageHeight) / Math.max(imageWidth, imageHeight) < 0.2;
          
          console.log('🧠 Smart overlay detection:', {
            isLikelyBorder,
            isSquareish,
            fileSize: file.size
          });
          
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

  // FIXED: Handle border selection with proper state clearing
  const handleBorderSelect = (borderId: string) => {
    const border = BUILT_IN_BORDERS.find(b => b.id === borderId);
    if (border) {
      // FIXED: Clear any custom uploaded overlay when selecting built-in border
      if (overlayFileRef.current) {
        overlayFileRef.current.value = '';
      }
      
      // Generate border at canvas resolution that matches typical AI output (512x512)
      const borderImage = border.generateCanvas(512, 512);
      setOverlayImage(borderImage);
      setSelectedBorder(borderId);
      setOverlayName(border.name);
      
      // FIXED: Auto-configure settings specifically for borders
      setOverlaySettings({
        position: 'center',
        scale: 1.0, // Borders always scale to fit exactly
        opacity: border.id.includes('holographic') || border.id.includes('aurora') ? 0.7 : 0.9,
        blendMode: border.id.includes('metallic') || border.id.includes('chrome') ? 'multiply' : 'normal',
        offsetX: 0, // Borders don't need offsets
        offsetY: 0
      });
      setError(null);
      
      console.log('✅ Selected built-in border:', {
        borderId,
        name: border.name,
        category: border.category
      });
    }
  };

  // FIXED: Generate preview with consistent scaling logic
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

      // FIXED: Consistent scaling logic
      const isBorderType = selectedBorder !== null || 
        (overlaySettings.position === 'center' && overlaySettings.scale >= 0.9);

      let finalScale = overlaySettings.scale;
      let overlayWidth = overlayImg.width * finalScale;
      let overlayHeight = overlayImg.height * finalScale;

      if (isBorderType) {
        // BORDERS: Scale to match canvas size exactly
        console.log('🖼️ Preview: Scaling border to fit canvas exactly');
        overlayWidth = canvas.width;
        overlayHeight = canvas.height;
        finalScale = Math.min(canvas.width / overlayImg.width, canvas.height / overlayImg.height);
      } else {
        // LOGOS: Intelligent proportional scaling
        console.log('🏷️ Preview: Calculating smart logo scaling');
        const canvasSize = Math.min(canvas.width, canvas.height);
        const overlaySize = Math.max(overlayImg.width, overlayImg.height);
        
        // Calculate smart scale factor (max 30% of canvas size)
        const maxRatio = 0.3;
        const smartScale = Math.min(
          (canvasSize * maxRatio) / overlaySize,
          1.0 // Don't upscale beyond original
        );
        
        finalScale = smartScale * overlaySettings.scale;
        overlayWidth = overlayImg.width * finalScale;
        overlayHeight = overlayImg.height * finalScale;
      }

      // Calculate position
      let overlayX = 0;
      let overlayY = 0;

      if (isBorderType) {
        // Borders: Always center
        overlayX = (canvas.width - overlayWidth) / 2;
        overlayY = (canvas.height - overlayHeight) / 2;
      } else {
        // Logos: Position according to settings
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
      }

      // Apply overlay settings
      ctx.globalAlpha = overlaySettings.opacity;
      ctx.globalCompositeOperation = overlaySettings.blendMode as GlobalCompositeOperation;

      // Draw overlay with calculated scaling
      ctx.drawImage(overlayImg, overlayX, overlayY, overlayWidth, overlayHeight);

      // Reset canvas state
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Convert to data URL
      const resultDataUrl = canvas.toDataURL('image/png', 0.95);
      setResultImage(resultDataUrl);

      console.log('✅ Preview generated successfully:', {
        canvasSize: `${canvas.width}x${canvas.height}`,
        overlaySize: `${Math.round(overlayWidth)}x${Math.round(overlayHeight)}`,
        position: `${Math.round(overlayX)}, ${Math.round(overlayY)}`,
        isBorderType,
        finalScale: finalScale.toFixed(3)
      });

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
  }, [overlaySettings, overlayImage, testImage, selectedBorder]);

  // FIXED: Enhanced save with proper overlay type detection and clearing
  const saveOverlayConfig = async () => {
    if (!overlayImage || !overlayName.trim()) {
      setError('Please provide an overlay image and name');
      return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      // FIXED: Clear all existing overlays first to prevent conflicts
      console.log('🗑️ Clearing all existing overlays before saving new one');
      localStorage.removeItem('photoboothOverlays');
      
      // Determine overlay type more intelligently
      let overlayType: 'border' | 'custom' = 'custom';
      
      if (selectedBorder) {
        overlayType = 'border';
        console.log('🖼️ Saving as built-in border type');
      } else {
        // Analyze the custom image to determine if it's border-like
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            const imageWidth = img.width;
            const imageHeight = img.height;
            
            // Detect if custom upload is actually a border/frame
            const isLargeDimensions = imageWidth >= 800 && imageHeight >= 800;
            const isSquareish = Math.abs(imageWidth - imageHeight) / Math.max(imageWidth, imageHeight) < 0.2;
            const isLikelyFrame = isLargeDimensions && isSquareish;
            
            if (isLikelyFrame || overlaySettings.position === 'center' && overlaySettings.scale >= 0.9) {
              overlayType = 'border';
              console.log('🔍 Custom upload detected as border-type');
            } else {
              console.log('🔍 Custom upload detected as logo-type');
            }
            
            resolve();
          };
          img.onerror = () => reject(new Error('Failed to analyze image'));
          img.src = overlayImage;
        });
      }

      // Compress image for storage
      let compressedImage: string;
      
      if (selectedBorder) {
        // For built-in borders, just store the reference
        compressedImage = JSON.stringify({ 
          type: 'built-in', 
          borderId: selectedBorder 
        });
      } else {
        // For custom uploads, compress if needed
        compressedImage = overlayImage;
        if (overlayImage.length > 500000) {
          // Compress large images
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          compressedImage = await new Promise<string>((resolve) => {
            img.onload = () => {
              const maxSize = 600;
              let { width, height } = img;
              
              if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width *= ratio;
                height *= ratio;
              }
              
              canvas.width = width;
              canvas.height = height;
              ctx!.drawImage(img, 0, 0, width, height);
              
              // Use JPEG compression for smaller storage
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = overlayImage;
          });
        }
      }

      // Save overlay configuration as the ONLY overlay (replace all)
      const overlayConfig = {
        name: overlayName,
        image: compressedImage,
        settings: overlaySettings,
        createdAt: new Date().toISOString(),
        type: overlayType,
        borderId: selectedBorder || undefined
      };

      // Save as single overlay array
      localStorage.setItem('photoboothOverlays', JSON.stringify([overlayConfig]));

      // Also save test result to gallery if available
      if (resultImage) {
        try {
          const uploadResult = await uploadPhoto(
            resultImage,
            `Overlay Preview: ${overlayName} - ${overlaySettings.position} at ${Math.round(overlaySettings.scale * 100)}% scale`,
            'image'
          );

          if (uploadResult) {
            // Dispatch gallery update
            window.dispatchEvent(new CustomEvent('galleryUpdate', {
              detail: { newPhoto: uploadResult, source: 'overlay_preview' }
            }));
          }
        } catch (uploadError) {
          console.warn('Failed to upload preview to gallery:', uploadError);
          // Don't fail the whole process if gallery upload fails
        }
      }

      // Success message
      const typeDescription = overlayType === 'border' ? 'border/frame' : 'logo/watermark';
      alert(`✅ Overlay "${overlayName}" saved successfully as ${typeDescription}!\n\nThis overlay will now be automatically applied to all AI generated photos with smart auto-scaling.\n\nNote: This replaces any previous overlay configuration.`);
      
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

  // FIXED: Reset form properly clears all states
  const resetForm = () => {
    setOverlayImage(null);
    setOverlayName('');
    setTestImage(null);
    setResultImage(null);
    setError(null);
    setShowPreview(false);
    setSelectedBorder(null); // FIXED: Clear selected border
    
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
    
    console.log('🔄 Form reset completed');
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
                  
                  {/* Show status when custom overlay is active */}
                  {overlayImage && !selectedBorder && (
                    <div className="mt-3 p-3 bg-green-900/30 border border-green-500/30 rounded-lg">
                      <p className="text-green-400 text-sm">✅ Custom overlay uploaded and ready</p>
                    </div>
                  )}
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
                            : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <div className="aspect-square mb-2 bg-gray-600 rounded flex items-center justify-center overflow-hidden">
                          <img 
                            src={border.generateCanvas(100, 100)}
                            alt={border.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="text-xs">
                          <div className="font-medium text-white">{border.name}</div>
                          <div className="text-gray-400 mt-1">{border.description}</div>
                          <div className="text-blue-400 capitalize mt-1">{border.category}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Show status when border is selected */}
                  {selectedBorder && (
                    <div className="mt-3 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-400 text-sm">✅ Built-in border selected: {BUILT_IN_BORDERS.find(b => b.id === selectedBorder)?.name}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Overlay Name Input */}
              <div className="mt-6">
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
                {/* Position - disabled for borders */}
                <div>
                  <label className="block text-sm font-medium mb-2">Position</label>
                  <select
                    value={overlaySettings.position}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, position: e.target.value as OverlayPosition }))}
                    disabled={selectedBorder !== null}
                    className={`w-full rounded-lg px-3 py-2 text-white ${
                      selectedBorder ? 'bg-gray-600 cursor-not-allowed' : 'bg-gray-700'
                    }`}
                  >
                    <option value="top-left">Top Left</option>
                    <option value="top-center">Top Center</option>
                    <option value="top-right">Top Right</option>
                    <option value="center">Center</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                  </select>
                  {selectedBorder && (
                    <p className="text-xs text-gray-400 mt-1">Position is fixed for borders</p>
                  )}
                </div>

                {/* Scale - limited for borders */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Scale: {Math.round(overlaySettings.scale * 100)}%
                    {selectedBorder && <span className="text-gray-400 text-xs ml-2">(Auto-fit for borders)</span>}
                  </label>
                  <input
                    type="range"
                    min={selectedBorder ? "0.8" : "0.1"}
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

                {/* Offsets - disabled for borders */}
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
                    disabled={selectedBorder !== null}
                    className="w-full"
                  />
                  {selectedBorder && (
                    <p className="text-xs text-gray-400 mt-1">Offsets disabled for borders</p>
                  )}
                </div>

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
                    disabled={selectedBorder !== null}
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
                  disabled={!canSave}
                  className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition ${
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