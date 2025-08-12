// src/lib/overlayUtils.ts

export interface OverlayConfig {
  name: string;
  image: string; // base64 data URL
  settings: {
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'top-center' | 'bottom-center';
    scale: number;
    opacity: number;
    blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light';
    offsetX: number;
    offsetY: number;
  };
  createdAt: string;
}

// Get active overlay configuration with built-in border support
export function getActiveOverlay(): OverlayConfig | null {
  try {
    const overlays = JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
    if (overlays.length === 0) return null;
    
    const latestOverlay = overlays[overlays.length - 1];
    
    // Handle built-in border references
    if (latestOverlay.type === 'border' && latestOverlay.borderId) {
      // Regenerate built-in border on-demand
      const borderDef = getBuiltInBorderById(latestOverlay.borderId);
      if (borderDef) {
        return {
          ...latestOverlay,
          image: borderDef.generateCanvas(512, 512) // Generate at optimal size
        };
      }
    }
    
    // Handle compressed image references
    if (typeof latestOverlay.image === 'string' && latestOverlay.image.startsWith('{')) {
      try {
        const imageRef = JSON.parse(latestOverlay.image);
        if (imageRef.type === 'built-in' && imageRef.borderId) {
          const borderDef = getBuiltInBorderById(imageRef.borderId);
          if (borderDef) {
            return {
              ...latestOverlay,
              image: borderDef.generateCanvas(512, 512)
            };
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse image reference:', parseError);
      }
    }
    
    return latestOverlay;
  } catch (error) {
    console.error('Error loading overlay config:', error);
    return null;
  }
}

// Built-in border definitions (simplified for utils)
function getBuiltInBorderById(borderId: string): { generateCanvas: (width: number, height: number) => string } | null {
  const borders: { [key: string]: (width: number, height: number) => string } = {
    'chrome-metallic': (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.06;
      
      const chromeGrad = ctx.createLinearGradient(0, 0, 0, height);
      chromeGrad.addColorStop(0, '#E8E8E8');
      chromeGrad.addColorStop(0.3, '#F8F8F8');
      chromeGrad.addColorStop(0.6, '#C8C8C8');
      chromeGrad.addColorStop(1, '#E8E8E8');
      
      ctx.fillStyle = chromeGrad;
      ctx.fillRect(0, 0, width, height);
      
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    },
    'rose-gold-gradient': (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.05;
      
      const roseGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
      roseGrad.addColorStop(0, '#F7E7CE');
      roseGrad.addColorStop(0.4, '#E8B4B8');
      roseGrad.addColorStop(0.8, '#D4A574');
      roseGrad.addColorStop(1, '#B87333');
      
      ctx.fillStyle = roseGrad;
      ctx.fillRect(0, 0, width, height);
      
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    },
    'holographic-prism': (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.04;
      
      ctx.globalCompositeOperation = 'screen';
      const gradients = [
        { colors: ['#FF0080', '#00FFFF', '#8000FF'], angle: 0 },
        { colors: ['#00FF80', '#FF8000', '#0080FF'], angle: 90 }
      ];
      
      gradients.forEach((grad) => {
        const angle = (grad.angle * Math.PI) / 180;
        const x1 = width/2 - Math.cos(angle) * width/2;
        const y1 = height/2 - Math.sin(angle) * height/2;
        const x2 = width/2 + Math.cos(angle) * width/2;
        const y2 = height/2 + Math.sin(angle) * height/2;
        
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        grad.colors.forEach((color, i) => {
          gradient.addColorStop(i / (grad.colors.length - 1), color + '60');
        });
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });
      
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    },
    // Add other borders as needed...
  };
  
  const borderFunc = borders[borderId];
  return borderFunc ? { generateCanvas: borderFunc } : null;
}

// Apply overlay to an image with smart auto-scaling
export async function applyOverlayToImage(
  backgroundImageData: string, 
  overlayConfig: OverlayConfig
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Cannot get canvas context');
      }

      const backgroundImg = new Image();
      const overlayImg = new Image();

      // Load background image
      backgroundImg.onload = () => {
        // Set canvas size to background image
        canvas.width = backgroundImg.width;
        canvas.height = backgroundImg.height;

        // Draw background
        ctx.drawImage(backgroundImg, 0, 0);

        // Load and draw overlay
        overlayImg.onload = () => {
          try {
            // **ENHANCED: Smart auto-scaling based on image sizes**
            let finalScale = overlayConfig.settings.scale;
            let overlayWidth = overlayImg.width * finalScale;
            let overlayHeight = overlayImg.height * finalScale;

            // Detect if this is likely a border (large overlay) vs logo (small overlay)
            const isBorder = overlayImg.width >= canvas.width * 0.8 && overlayImg.height >= canvas.height * 0.8;
            
            if (isBorder) {
              // For borders: scale to exactly match canvas size
              finalScale = 1.0;
              overlayWidth = canvas.width;
              overlayHeight = canvas.height;
            } else {
              // For logos/watermarks: intelligent scaling
              const canvasSize = Math.min(canvas.width, canvas.height);
              const overlaySize = Math.max(overlayImg.width, overlayImg.height);
              
              // Calculate smart scale factor
              const maxOverlayRatio = 0.25; // Don't exceed 25% of canvas size
              const smartScale = Math.min(
                (canvasSize * maxOverlayRatio) / overlaySize,
                1.0 // Don't upscale beyond original
              );
              
              // Apply smart scale with user preference
              finalScale = smartScale * overlayConfig.settings.scale;
              overlayWidth = overlayImg.width * finalScale;
              overlayHeight = overlayImg.height * finalScale;
            }

            // Calculate position
            let overlayX = 0;
            let overlayY = 0;

            if (isBorder) {
              // Borders always center and fill
              overlayX = 0;
              overlayY = 0;
            } else {
              // Position logos/watermarks according to settings
              switch (overlayConfig.settings.position) {
                case 'top-left':
                  overlayX = overlayConfig.settings.offsetX;
                  overlayY = overlayConfig.settings.offsetY;
                  break;
                case 'top-right':
                  overlayX = canvas.width - overlayWidth - overlayConfig.settings.offsetX;
                  overlayY = overlayConfig.settings.offsetY;
                  break;
                case 'bottom-left':
                  overlayX = overlayConfig.settings.offsetX;
                  overlayY = canvas.height - overlayHeight - overlayConfig.settings.offsetY;
                  break;
                case 'bottom-right':
                  overlayX = canvas.width - overlayWidth - overlayConfig.settings.offsetX;
                  overlayY = canvas.height - overlayHeight - overlayConfig.settings.offsetY;
                  break;
                case 'center':
                  overlayX = (canvas.width - overlayWidth) / 2;
                  overlayY = (canvas.height - overlayHeight) / 2;
                  break;
                case 'top-center':
                  overlayX = (canvas.width - overlayWidth) / 2;
                  overlayY = overlayConfig.settings.offsetY;
                  break;
                case 'bottom-center':
                  overlayX = (canvas.width - overlayWidth) / 2;
                  overlayY = canvas.height - overlayHeight - overlayConfig.settings.offsetY;
                  break;
              }
            }

            // Apply overlay settings
            ctx.globalAlpha = overlayConfig.settings.opacity;
            ctx.globalCompositeOperation = overlayConfig.settings.blendMode as GlobalCompositeOperation;

            // Draw overlay with smart scaling
            ctx.drawImage(overlayImg, overlayX, overlayY, overlayWidth, overlayHeight);

            // Reset canvas state
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';

            // Convert to data URL
            const resultDataUrl = canvas.toDataURL('image/png', 0.95);
            resolve(resultDataUrl);

          } catch (error) {
            reject(new Error(`Error applying overlay: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        };

        overlayImg.onerror = () => {
          reject(new Error('Failed to load overlay image'));
        };

        overlayImg.src = overlayConfig.image;
      };

      backgroundImg.onerror = () => {
        reject(new Error('Failed to load background image'));
      };

      backgroundImg.src = backgroundImageData;

    } catch (error) {
      reject(new Error(`Canvas setup error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

// Check if overlay should be applied
export function shouldApplyOverlay(): boolean {
  const overlay = getActiveOverlay();
  return overlay !== null;
}

// Get all saved overlays
export function getAllOverlays(): OverlayConfig[] {
  try {
    return JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
  } catch (error) {
    console.error('Error loading overlays:', error);
    return [];
  }
}

// Remove an overlay
export function removeOverlay(overlayName: string): boolean {
  try {
    const overlays = getAllOverlays();
    const updatedOverlays = overlays.filter(overlay => overlay.name !== overlayName);
    localStorage.setItem('photoboothOverlays', JSON.stringify(updatedOverlays));
    return true;
  } catch (error) {
    console.error('Error removing overlay:', error);
    return false;
  }
}

// Clear all overlays
export function clearAllOverlays(): boolean {
  try {
    localStorage.removeItem('photoboothOverlays');
    return true;
  } catch (error) {
    console.error('Error clearing overlays:', error);
    return false;
  }
}

// Get overlay by name
export function getOverlayByName(name: string): OverlayConfig | null {
  try {
    const overlays = getAllOverlays();
    return overlays.find(overlay => overlay.name === name) || null;
  } catch (error) {
    console.error('Error getting overlay by name:', error);
    return null;
  }
}

// Set active overlay (make a specific overlay the active one)
export function setActiveOverlay(overlayName: string): boolean {
  try {
    const overlays = getAllOverlays();
    const targetOverlay = overlays.find(overlay => overlay.name === overlayName);
    
    if (!targetOverlay) {
      console.error('Overlay not found:', overlayName);
      return false;
    }

    // Remove the target overlay from its current position
    const otherOverlays = overlays.filter(overlay => overlay.name !== overlayName);
    
    // Add it to the end (making it the "active" one since getActiveOverlay() returns the last one)
    const reorderedOverlays = [...otherOverlays, targetOverlay];
    
    localStorage.setItem('photoboothOverlays', JSON.stringify(reorderedOverlays));
    return true;
  } catch (error) {
    console.error('Error setting active overlay:', error);
    return false;
  }
}

// Update overlay settings
export function updateOverlaySettings(overlayName: string, newSettings: Partial<OverlayConfig['settings']>): boolean {
  try {
    const overlays = getAllOverlays();
    const overlayIndex = overlays.findIndex(overlay => overlay.name === overlayName);
    
    if (overlayIndex === -1) {
      console.error('Overlay not found:', overlayName);
      return false;
    }

    // Update the overlay settings
    overlays[overlayIndex].settings = { ...overlays[overlayIndex].settings, ...newSettings };
    
    localStorage.setItem('photoboothOverlays', JSON.stringify(overlays));
    return true;
  } catch (error) {
    console.error('Error updating overlay settings:', error);
    return false;
  }
}