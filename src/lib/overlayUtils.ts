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

// Get active overlay configuration
export function getActiveOverlay(): OverlayConfig | null {
  try {
    const overlays = JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
    // Return the most recent overlay (last one in array)
    return overlays.length > 0 ? overlays[overlays.length - 1] : null;
  } catch (error) {
    console.error('Error loading overlay config:', error);
    return null;
  }
}

// Apply overlay to an image
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
        // Set canvas size
        canvas.width = backgroundImg.width;
        canvas.height = backgroundImg.height;

        // Draw background
        ctx.drawImage(backgroundImg, 0, 0);

        // Load and draw overlay
        overlayImg.onload = () => {
          try {
            // Calculate overlay dimensions
            const overlayWidth = overlayImg.width * overlayConfig.settings.scale;
            const overlayHeight = overlayImg.height * overlayConfig.settings.scale;

            // Calculate position
            let overlayX = 0;
            let overlayY = 0;

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

            // Apply overlay settings
            ctx.globalAlpha = overlayConfig.settings.opacity;
            ctx.globalCompositeOperation = overlayConfig.settings.blendMode as GlobalCompositeOperation;

            // Draw overlay
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