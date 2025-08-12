// src/lib/overlayUtils.ts - Fixed version with working built-in borders

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
  type?: 'border' | 'custom';
  borderId?: string;
}

// Built-in border definitions - moved here to be accessible
const BUILT_IN_BORDERS: { [key: string]: (width: number, height: number) => string } = {
  'chrome-metallic': (width: number, height: number) => {
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
  },

  'rose-gold-gradient': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Rose gold gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#F7C6C7');
    gradient.addColorStop(0.2, '#E8A87C');
    gradient.addColorStop(0.4, '#D4AF37');
    gradient.addColorStop(0.6, '#E8A87C');
    gradient.addColorStop(0.8, '#F7C6C7');
    gradient.addColorStop(1, '#E8A87C');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Highlight effect
    const highlightGrad = ctx.createLinearGradient(0, 0, width/2, height/2);
    highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = highlightGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'neon-cyber': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.03;
    
    // Dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);
    
    // Glow effect
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 - i * 0.05})`;
      ctx.lineWidth = borderWidth * (5 - i);
      ctx.strokeRect(borderWidth * i, borderWidth * i, width - borderWidth * i * 2, height - borderWidth * i * 2);
    }
    
    // Main neon line
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth/2, borderWidth/2, width - borderWidth, height - borderWidth);
    
    // Inner accent
    ctx.strokeStyle = '#FF00FF';
    ctx.lineWidth = borderWidth/3;
    ctx.strokeRect(borderWidth*2, borderWidth*2, width - borderWidth*4, height - borderWidth*4);
    
    return canvas.toDataURL();
  },

  'film-strip': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const stripHeight = height * 0.12;
    const holeSize = stripHeight * 0.6;
    const holeSpacing = holeSize * 1.5;
    
    // Top and bottom strips
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, stripHeight);
    ctx.fillRect(0, height - stripHeight, width, stripHeight);
    
    // Film holes
    ctx.globalCompositeOperation = 'destination-out';
    const holes = Math.floor(width / holeSpacing);
    for (let i = 0; i < holes; i++) {
      const x = i * holeSpacing + holeSpacing/2 - holeSize/2;
      // Top holes
      ctx.fillRect(x, stripHeight * 0.2, holeSize, holeSize);
      // Bottom holes
      ctx.fillRect(x, height - stripHeight + stripHeight * 0.2, holeSize, holeSize);
    }
    
    return canvas.toDataURL();
  },

  'polaroid': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderSize = Math.min(width, height) * 0.06;
    const bottomBorder = borderSize * 3;
    
    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(borderSize/2, borderSize/2, width - borderSize, height - borderSize);
    
    // White border
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, width, height);
    
    // Clear photo area
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderSize, borderSize, width - borderSize*2, height - borderSize - bottomBorder);
    
    return canvas.toDataURL();
  },

  'ornate-baroque': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.1;
    
    // Base gradient
    const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    gradient.addColorStop(0, '#8B4513');
    gradient.addColorStop(0.7, '#CD853F');
    gradient.addColorStop(1, '#DEB887');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Decorative corners
    const cornerSize = borderWidth * 1.5;
    const corners = [
      { x: 0, y: 0 },
      { x: width - cornerSize, y: 0 },
      { x: 0, y: height - cornerSize },
      { x: width - cornerSize, y: height - cornerSize }
    ];
    
    ctx.fillStyle = '#DAA520';
    corners.forEach(corner => {
      ctx.beginPath();
      ctx.arc(corner.x + cornerSize/2, corner.y + cornerSize/2, cornerSize/3, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'minimal-line': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const lineWidth = Math.min(width, height) * 0.008;
    const offset = lineWidth * 3;
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(offset, offset, width - offset*2, height - offset*2);
    
    // Double line effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = lineWidth/2;
    ctx.strokeRect(offset*2, offset*2, width - offset*4, height - offset*4);
    
    return canvas.toDataURL();
  },

  'grunge-torn': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.05;
    
    // Dark vignette
    const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Torn edges effect
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * width;
      const y = Math.random() < 0.5 ? Math.random() * borderWidth : height - Math.random() * borderWidth;
      const size = Math.random() * borderWidth * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    return canvas.toDataURL();
  },

  'tech-grid': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.04;
    const gridSize = 20;
    
    // Dark background with tech gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0a0a2a');
    grad.addColorStop(0.5, '#1a1a3a');
    grad.addColorStop(1, '#0a0a2a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    
    // Grid pattern
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, borderWidth);
      ctx.moveTo(x, height - borderWidth);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(borderWidth, y);
      ctx.moveTo(width - borderWidth, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Corner accents
    ctx.fillStyle = '#00ffff';
    const cornerSize = borderWidth/3;
    ctx.fillRect(0, 0, cornerSize, borderWidth);
    ctx.fillRect(0, 0, borderWidth, cornerSize);
    ctx.fillRect(width - cornerSize, 0, cornerSize, borderWidth);
    ctx.fillRect(width - borderWidth, 0, borderWidth, cornerSize);
    ctx.fillRect(0, height - borderWidth, cornerSize, borderWidth);
    ctx.fillRect(0, height - cornerSize, borderWidth, cornerSize);
    ctx.fillRect(width - cornerSize, height - borderWidth, cornerSize, borderWidth);
    ctx.fillRect(width - borderWidth, height - cornerSize, borderWidth, cornerSize);
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  }
};

// Generate a built-in border by ID
export function generateBuiltInBorder(borderId: string, width: number, height: number): string | null {
  const borderFunction = BUILT_IN_BORDERS[borderId];
  if (!borderFunction) {
    console.error(`Built-in border not found: ${borderId}`);
    return null;
  }
  
  try {
    return borderFunction(width, height);
  } catch (error) {
    console.error(`Error generating border ${borderId}:`, error);
    return null;
  }
}

// Get active overlay configuration with proper built-in border support
export function getActiveOverlay(): OverlayConfig | null {
  try {
    const overlays = JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
    if (overlays.length === 0) return null;
    
    const latestOverlay = overlays[overlays.length - 1];
    
    // Handle built-in border references
    if (latestOverlay.type === 'border' && latestOverlay.borderId) {
      console.log('🎨 Loading built-in border:', latestOverlay.borderId);
      
      // Generate border on-demand at standard resolution
      const borderImage = generateBuiltInBorder(latestOverlay.borderId, 512, 512);
      if (borderImage) {
        return {
          ...latestOverlay,
          image: borderImage
        };
      } else {
        console.error('Failed to generate built-in border:', latestOverlay.borderId);
        return null;
      }
    }
    
    // Return custom overlay as-is
    return latestOverlay;
  } catch (error) {
    console.error('Error loading overlay config:', error);
    return null;
  }
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
            console.log('🎨 Applying overlay with smart scaling:', {
              canvasSize: `${canvas.width}x${canvas.height}`,
              overlaySize: `${overlayImg.width}x${overlayImg.height}`,
              overlayType: overlayConfig.type || 'unknown',
              overlayName: overlayConfig.name
            });

            // Smart auto-scaling for ALL overlay types
            let finalScale = overlayConfig.settings.scale;
            let overlayWidth = overlayImg.width * finalScale;
            let overlayHeight = overlayImg.height * finalScale;

            // Detect overlay type using multiple criteria
            const isBorder = 
              overlayConfig.type === 'border' ||
              overlayConfig.borderId ||
              // Size-based detection for custom uploads
              (overlayImg.width >= Math.min(canvas.width * 0.8, 600) && 
               overlayImg.height >= Math.min(canvas.height * 0.8, 600)) ||
              // Position-based detection
              (overlayConfig.settings.position === 'center' && overlayConfig.settings.scale >= 0.9);

            if (isBorder) {
              // For borders: scale to exactly match canvas size
              overlayWidth = canvas.width;
              overlayHeight = canvas.height;
              console.log('📏 Auto-scaled as border to canvas size');
            } else {
              // For logos/watermarks: intelligent scaling based on canvas size
              const canvasSize = Math.min(canvas.width, canvas.height);
              const overlaySize = Math.max(overlayImg.width, overlayImg.height);
              
              // Auto-scale if overlay is too large or too small
              if (overlaySize > canvasSize * 0.5) {
                // Large overlay - scale down
                const autoScale = (canvasSize * 0.3) / overlaySize;
                finalScale = Math.min(finalScale, autoScale);
              } else if (overlaySize < canvasSize * 0.1) {
                // Very small overlay - scale up
                const autoScale = (canvasSize * 0.2) / overlaySize;
                finalScale = Math.max(finalScale, autoScale);
              }
              
              overlayWidth = overlayImg.width * finalScale;
              overlayHeight = overlayImg.height * finalScale;
              console.log('📏 Auto-scaled as logo/watermark:', { finalScale, size: `${overlayWidth}x${overlayHeight}` });
            }

            // Position calculation
            let x = 0, y = 0;
            
            switch (overlayConfig.settings.position) {
              case 'top-left':
                x = overlayConfig.settings.offsetX;
                y = overlayConfig.settings.offsetY;
                break;
              case 'top-right':
                x = canvas.width - overlayWidth - overlayConfig.settings.offsetX;
                y = overlayConfig.settings.offsetY;
                break;
              case 'bottom-left':
                x = overlayConfig.settings.offsetX;
                y = canvas.height - overlayHeight - overlayConfig.settings.offsetY;
                break;
              case 'bottom-right':
                x = canvas.width - overlayWidth - overlayConfig.settings.offsetX;
                y = canvas.height - overlayHeight - overlayConfig.settings.offsetY;
                break;
              case 'center':
                x = (canvas.width - overlayWidth) / 2 + overlayConfig.settings.offsetX;
                y = (canvas.height - overlayHeight) / 2 + overlayConfig.settings.offsetY;
                break;
              case 'top-center':
                x = (canvas.width - overlayWidth) / 2 + overlayConfig.settings.offsetX;
                y = overlayConfig.settings.offsetY;
                break;
              case 'bottom-center':
                x = (canvas.width - overlayWidth) / 2 + overlayConfig.settings.offsetX;
                y = canvas.height - overlayHeight - overlayConfig.settings.offsetY;
                break;
            }

            // Apply overlay settings
            ctx.globalAlpha = overlayConfig.settings.opacity;
            ctx.globalCompositeOperation = overlayConfig.settings.blendMode as GlobalCompositeOperation;

            // Draw overlay
            ctx.drawImage(overlayImg, x, y, overlayWidth, overlayHeight);

            // Reset context
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';

            console.log('✅ Overlay applied successfully');
            resolve(canvas.toDataURL('image/jpeg', 0.95));

          } catch (error) {
            console.error('❌ Overlay application error:', error);
            reject(new Error(`Overlay application error: ${error instanceof Error ? error.message : 'Unknown error'}`));
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

// Save overlay configuration
export function saveOverlayConfig(config: OverlayConfig): boolean {
  try {
    const overlays = getAllOverlays();
    overlays.push(config);
    localStorage.setItem('photoboothOverlays', JSON.stringify(overlays));
    
    console.log('✅ Overlay configuration saved:', {
      name: config.name,
      type: config.type,
      borderId: config.borderId
    });
    
    return true;
  } catch (error) {
    console.error('Error saving overlay config:', error);
    return false;
  }
}

// Check if overlay should be applied with debug logging
export function shouldApplyOverlay(): boolean {
  const overlay = getActiveOverlay();
  const shouldApply = overlay !== null;
  
  console.log('🔍 Checking if overlay should be applied:', {
    hasOverlay: shouldApply,
    overlayName: overlay?.name || 'none',
    overlayType: overlay?.type || 'unknown'
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

// Clear the active overlay (disable overlay application)
export function clearActiveOverlay(): boolean {
  try {
    localStorage.removeItem('photoboothOverlays');
    console.log('✅ All overlays cleared from storage');
    return true;
  } catch (error) {
    console.error('Error clearing overlays:', error);
    return false;
  }
}