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
  type?: 'border' | 'custom'; // Added for better detection
  borderId?: string; // Added for built-in border reference
}

// Get active overlay configuration with built-in border support
export function getActiveOverlay(): OverlayConfig | null {
  try {
    const overlays = JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
    if (overlays.length === 0) return null;
    
    // FIXED: Always get the first (and should be only) overlay since we now replace all
    const activeOverlay = overlays[0];
    
    // Handle built-in border references
    if (activeOverlay.type === 'border' && activeOverlay.borderId) {
      // Regenerate built-in border on-demand at the target canvas size
      const borderDef = getBuiltInBorderById(activeOverlay.borderId);
      if (borderDef) {
        return {
          ...activeOverlay,
          image: borderDef.generateCanvas(512, 512) // Generate at standard size
        };
      }
    }
    
    // Handle compressed image references
    if (typeof activeOverlay.image === 'string' && activeOverlay.image.startsWith('{')) {
      try {
        const imageRef = JSON.parse(activeOverlay.image);
        if (imageRef.type === 'built-in' && imageRef.borderId) {
          const borderDef = getBuiltInBorderById(imageRef.borderId);
          if (borderDef) {
            return {
              ...activeOverlay,
              image: borderDef.generateCanvas(512, 512)
            };
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse image reference:', parseError);
      }
    }
    
    return activeOverlay;
  } catch (error) {
    console.error('Error loading overlay config:', error);
    return null;
  }
}

// FIXED: Enhanced built-in border definitions with all borders
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
    // Add more borders as needed...
  };
  
  const borderFunc = borders[borderId];
  return borderFunc ? { generateCanvas: borderFunc } : null;
}

// FIXED: Apply overlay to image with consistent scaling logic that matches preview
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
            console.log('🎨 Applying overlay with consistent scaling logic:', {
              canvasSize: `${canvas.width}x${canvas.height}`,
              overlaySize: `${overlayImg.width}x${overlayImg.height}`,
              overlayType: overlayConfig.type || 'unknown',
              overlayName: overlayConfig.name,
              borderId: overlayConfig.borderId
            });

            // FIXED: Use the same detection logic as the preview
            const isBorderType = overlayConfig.type === 'border' || 
              overlayConfig.borderId || 
              (overlayConfig.settings.position === 'center' && overlayConfig.settings.scale >= 0.9);
            
            console.log('🔍 Overlay type detection:', {
              isBorderType,
              type: overlayConfig.type,
              borderId: overlayConfig.borderId,
              position: overlayConfig.settings.position,
              userScale: overlayConfig.settings.scale
            });

            let finalScale = overlayConfig.settings.scale;
            let overlayWidth = overlayImg.width * finalScale;
            let overlayHeight = overlayImg.height * finalScale;

            if (isBorderType) {
              // **BORDERS/FRAMES: Scale to exactly match canvas dimensions**
              console.log('🖼️ Applying as border/frame - scaling to fit canvas exactly');
              overlayWidth = canvas.width;
              overlayHeight = canvas.height;
              finalScale = Math.min(canvas.width / overlayImg.width, canvas.height / overlayImg.height);
              
              console.log('📏 Border scaling:', {
                canvasSize: `${canvas.width}x${canvas.height}`,
                overlayOriginalSize: `${overlayImg.width}x${overlayImg.height}`,
                finalSize: `${overlayWidth}x${overlayHeight}`,
                scaleUsed: finalScale.toFixed(3)
              });
            } else {
              // **LOGOS/WATERMARKS: Intelligent proportional scaling (same as preview)**
              console.log('🏷️ Applying as logo/watermark - calculating smart proportional scale');
              
              const canvasSize = Math.min(canvas.width, canvas.height);
              const overlaySize = Math.max(overlayImg.width, overlayImg.height);
              
              // Use the same logic as generatePreview
              const maxRatio = 0.3; // Maximum 30% of canvas size
              const smartScale = Math.min(
                (canvasSize * maxRatio) / overlaySize,
                1.0 // Don't upscale beyond original
              );
              
              finalScale = smartScale * overlayConfig.settings.scale;
              overlayWidth = overlayImg.width * finalScale;
              overlayHeight = overlayImg.height * finalScale;
              
              console.log('📏 Logo scaling calculation:', {
                canvasSize,
                overlaySize,
                maxRatio,
                smartScale: smartScale.toFixed(3),
                userScale: overlayConfig.settings.scale,
                finalScale: finalScale.toFixed(3),
                finalSize: `${Math.round(overlayWidth)}x${Math.round(overlayHeight)}`
              });
            }

            // Calculate position (same logic as preview)
            let overlayX = 0;
            let overlayY = 0;

            if (isBorderType) {
              // **BORDERS: Always center**
              overlayX = (canvas.width - overlayWidth) / 2;
              overlayY = (canvas.height - overlayHeight) / 2;
              console.log('🎯 Border positioning: center');
            } else {
              // **LOGOS: Position according to settings**
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
              
              console.log('🎯 Logo positioning:', {
                position: overlayConfig.settings.position,
                finalPosition: `${Math.round(overlayX)}, ${Math.round(overlayY)}`,
                offsets: `${overlayConfig.settings.offsetX}, ${overlayConfig.settings.offsetY}`
              });
            }

            // Apply overlay settings
            ctx.globalAlpha = overlayConfig.settings.opacity;
            ctx.globalCompositeOperation = overlayConfig.settings.blendMode as GlobalCompositeOperation;

            console.log('✨ Drawing overlay:', {
              position: `${Math.round(overlayX)}, ${Math.round(overlayY)}`,
              size: `${Math.round(overlayWidth)}x${Math.round(overlayHeight)}`,
              opacity: overlayConfig.settings.opacity,
              blendMode: overlayConfig.settings.blendMode,
              detectedAs: isBorderType ? 'border' : 'logo'
            });

            // Draw overlay with calculated scaling
            ctx.drawImage(overlayImg, overlayX, overlayY, overlayWidth, overlayHeight);

            // Reset canvas state
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';

            // Convert to data URL
            const resultDataUrl = canvas.toDataURL('image/png', 0.95);
            console.log('✅ Overlay applied successfully');
            resolve(resultDataUrl);

          } catch (error) {
            console.error('❌ Error in overlay drawing:', error);
            reject(new Error(`Error applying overlay: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        };

        overlayImg.onerror = () => {
          console.error('❌ Failed to load overlay image');
          reject(new Error('Failed to load overlay image'));
        };

        overlayImg.src = overlayConfig.image;
      };

      backgroundImg.onerror = () => {
        console.error('❌ Failed to load background image');
        reject(new Error('Failed to load background image'));
      };

      backgroundImg.src = backgroundImageData;

    } catch (error) {
      console.error('❌ Canvas setup error:', error);
      reject(new Error(`Canvas setup error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

// Check if overlay should be applied with debug logging
export function shouldApplyOverlay(): boolean {
  const overlay = getActiveOverlay();
  const shouldApply = overlay !== null;
  
  console.log('🔍 Checking if overlay should be applied:', {
    hasOverlay: shouldApply,
    overlayName: overlay?.name || 'none',
    overlayType: overlay?.type || 'unknown',
    borderId: overlay?.borderId || 'none'
  });
  
  return shouldApply;
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

// FIXED: Clear the active overlay (disable overlay application)
export function clearActiveOverlay(): boolean {
  try {
    localStorage.removeItem('photoboothOverlays');
    console.log('✅ All overlays cleared from storage');
    return true;
  } catch (error) {
    console.error('❌ Error clearing overlays:', error);
    return false;
  }
}

// Disable overlay temporarily without deleting (for debugging)
export function disableOverlay(): boolean {
  try {
    localStorage.setItem('overlayDisabled', 'true');
    console.log('✅ Overlay temporarily disabled');
    return true;
  } catch (error) {
    console.error('❌ Error disabling overlay:', error);
    return false;
  }
}

// Enable overlay (remove temporary disable)
export function enableOverlay(): boolean {
  try {
    localStorage.removeItem('overlayDisabled');
    console.log('✅ Overlay re-enabled');
    return true;
  } catch (error) {
    console.error('❌ Error enabling overlay:', error);
    return false;
  }
}

// Check if overlay is temporarily disabled
function isOverlayDisabled(): boolean {
  return localStorage.getItem('overlayDisabled') === 'true';
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

// FIXED: Set active overlay (now clears all and sets single overlay)
export function setActiveOverlay(overlayName: string): boolean {
  try {
    const overlays = getAllOverlays();
    const targetOverlay = overlays.find(overlay => overlay.name === overlayName);
    
    if (!targetOverlay) {
      console.error('Overlay not found:', overlayName);
      return false;
    }

    // Clear all overlays and set this one as the only active overlay
    localStorage.setItem('photoboothOverlays', JSON.stringify([targetOverlay]));
    console.log('✅ Set active overlay:', overlayName);
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