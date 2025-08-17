// src/lib/overlayUtils.ts - Updated with aspect ratio support

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
  aspectRatio?: '1:1' | '9:16' | '16:9'; // Added aspect ratio support
}

// Auto-detect aspect ratio from image dimensions
export function detectAspectRatio(width: number, height: number): '1:1' | '9:16' | '16:9' {
  const ratio = width / height;
  
  if (Math.abs(ratio - 1) < 0.1) {
    return '1:1'; // Square
  } else if (ratio < 1) {
    return '9:16'; // Portrait
  } else {
    return '16:9'; // Landscape
  }
}

// Get dimensions for aspect ratio
export function getAspectRatioDimensions(aspectRatio: '1:1' | '9:16' | '16:9', baseSize: number = 512) {
  switch (aspectRatio) {
    case '1:1':
      return { width: baseSize, height: baseSize };
    case '9:16':
      return { width: baseSize, height: Math.round(baseSize * (16/9)) };
    case '16:9':
      return { width: Math.round(baseSize * (16/9)), height: baseSize };
    default:
      return { width: baseSize, height: baseSize };
  }
}

// Built-in border definitions with aspect ratio support
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
    
    const borderWidth = Math.min(width, height) * 0.05;
    
    // Rose gold gradient
    const roseGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    roseGrad.addColorStop(0, '#FFD4C4');
    roseGrad.addColorStop(0.3, '#F7B2A3');
    roseGrad.addColorStop(0.6, '#E8A597');
    roseGrad.addColorStop(0.8, '#D4958A');
    roseGrad.addColorStop(1, '#C8867D');
    
    ctx.fillStyle = roseGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Highlight effects
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, 0, width, borderWidth*0.5);
    ctx.fillRect(0, 0, borderWidth*0.5, height);
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'holographic-prism': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Create holographic effect with multiple overlapping gradients
    const createHoloGradient = (angle: number, colors: string[]) => {
      const grad = ctx.createLinearGradient(
        width/2 - Math.cos(angle) * width/2,
        height/2 - Math.sin(angle) * height/2,
        width/2 + Math.cos(angle) * width/2,
        height/2 + Math.sin(angle) * height/2
      );
      colors.forEach((color, i) => {
        grad.addColorStop(i / (colors.length - 1), color);
      });
      return grad;
    };
    
    // Base holographic layer
    ctx.fillStyle = createHoloGradient(0, ['#FF00FF', '#00FFFF', '#FFFF00', '#FF00FF']);
    ctx.fillRect(0, 0, width, height);
    
    // Second layer with different angle
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = createHoloGradient(Math.PI/3, ['#FF0080', '#0080FF', '#80FF00', '#FF0080']);
    ctx.fillRect(0, 0, width, height);
    
    // Reset blend mode
    ctx.globalCompositeOperation = 'source-over';
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'copper-oxidized': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.06;
    
    // Base copper color
    const copperGrad = ctx.createLinearGradient(0, 0, width, height);
    copperGrad.addColorStop(0, '#B87333');
    copperGrad.addColorStop(0.5, '#CD7F32');
    copperGrad.addColorStop(1, '#A0522D');
    
    ctx.fillStyle = copperGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Patina effects (green oxidation)
    ctx.fillStyle = 'rgba(64, 130, 109, 0.6)';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * borderWidth;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'titanium-brushed': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.05;
    
    // Base titanium color
    const titaniumGrad = ctx.createLinearGradient(0, 0, 0, height);
    titaniumGrad.addColorStop(0, '#C0C0C8');
    titaniumGrad.addColorStop(0.5, '#A8A8B0');
    titaniumGrad.addColorStop(1, '#909098');
    
    ctx.fillStyle = titaniumGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Brushed texture - horizontal lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    for (let y = 1; y < height; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'aurora-gradient': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.07;
    
    // Aurora gradient - flowing colors
    const auroraGrad = ctx.createLinearGradient(0, 0, width, height);
    auroraGrad.addColorStop(0, '#00FF9F');
    auroraGrad.addColorStop(0.2, '#00B4FF');
    auroraGrad.addColorStop(0.4, '#7928CA');
    auroraGrad.addColorStop(0.6, '#FF0080');
    auroraGrad.addColorStop(0.8, '#FF8C00');
    auroraGrad.addColorStop(1, '#00FF9F');
    
    ctx.fillStyle = auroraGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Add flowing wave effect
    ctx.globalCompositeOperation = 'multiply';
    const waveGrad = ctx.createLinearGradient(0, 0, 0, height);
    waveGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    waveGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
    waveGrad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
    
    ctx.fillStyle = waveGrad;
    ctx.fillRect(0, 0, width, height);
    
    ctx.globalCompositeOperation = 'source-over';
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'carbon-fiber': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.05;
    
    // Dark base
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Carbon fiber weave pattern
    const patternSize = 8;
    ctx.fillStyle = '#333333';
    
    for (let x = 0; x < width; x += patternSize * 2) {
      for (let y = 0; y < height; y += patternSize * 2) {
        ctx.fillRect(x, y, patternSize, patternSize);
        ctx.fillRect(x + patternSize, y + patternSize, patternSize, patternSize);
      }
    }
    
    // Highlight lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += patternSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'neon-circuit': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.06;
    
    // Dark background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    // Circuit pattern
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff00';
    
    // Draw circuit lines
    const lines = 15;
    for (let i = 0; i < lines; i++) {
      ctx.beginPath();
      if (Math.random() > 0.5) {
        // Horizontal lines
        const y = (height / lines) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(borderWidth, y);
        ctx.moveTo(width - borderWidth, y);
        ctx.lineTo(width, y);
      } else {
        // Vertical lines
        const x = (width / lines) * i;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, borderWidth);
        ctx.moveTo(x, height - borderWidth);
        ctx.lineTo(x, height);
      }
      ctx.stroke();
    }
    
    // Circuit nodes
    ctx.fillStyle = '#00ff00';
    for (let i = 0; i < 20; i++) {
      const x = Math.random() < 0.5 ? Math.random() * borderWidth : width - Math.random() * borderWidth;
      const y = Math.random() < 0.5 ? Math.random() * borderWidth : height - Math.random() * borderWidth;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.shadowBlur = 0;
    
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
    
    const borderWidth = Math.min(width, height) * 0.04;
    
    // Dark base with subtle gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0a0a2a');
    bgGrad.addColorStop(1, '#2a0a2a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Neon glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff00ff';
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 3;
    
    // Border glow
    ctx.strokeRect(borderWidth/2, borderWidth/2, width - borderWidth, height - borderWidth);
    
    // Inner glow
    ctx.shadowColor = '#00ffff';
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(borderWidth*0.8, borderWidth*0.8, width - borderWidth*1.6, height - borderWidth*1.6);
    
    ctx.shadowBlur = 0;
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'film-strip': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Black film background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Film perforations
    ctx.fillStyle = '#000000';
    const perfSize = borderWidth * 0.3;
    const spacing = perfSize * 1.5;
    
    // Top and bottom perforations
    for (let x = spacing; x < width - spacing; x += spacing) {
      // Top perforations
      ctx.fillRect(x - perfSize/2, borderWidth*0.2, perfSize, perfSize);
      // Bottom perforations
      ctx.fillRect(x - perfSize/2, height - borderWidth*0.2 - perfSize, perfSize, perfSize);
    }
    
    // Side perforations
    for (let y = spacing; y < height - spacing; y += spacing) {
      // Left perforations
      ctx.fillRect(borderWidth*0.2, y - perfSize/2, perfSize, perfSize);
      // Right perforations
      ctx.fillRect(width - borderWidth*0.2 - perfSize, y - perfSize/2, perfSize, perfSize);
    }
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'polaroid': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.1;
    const bottomBorder = borderWidth * 2; // Larger bottom border like Polaroid
    
    // White Polaroid background
    ctx.fillStyle = '#f8f8f0';
    ctx.fillRect(0, 0, width, height);
    
    // Subtle aging/yellowing
    const ageGrad = ctx.createLinearGradient(0, 0, width, height);
    ageGrad.addColorStop(0, 'rgba(255, 248, 220, 0.3)');
    ageGrad.addColorStop(1, 'rgba(255, 248, 220, 0.6)');
    ctx.fillStyle = ageGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Drop shadow effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(5, 5, width - 10, height - 10);
    
    // Clear center (photo area)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth - bottomBorder);
    
    return canvas.toDataURL();
  },

  'ornate-baroque': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.12;
    
    // Gold gradient background
    const goldGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    goldGrad.addColorStop(0, '#FFD700');
    goldGrad.addColorStop(0.5, '#DAA520');
    goldGrad.addColorStop(1, '#B8860B');
    
    ctx.fillStyle = goldGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Ornate pattern - simplified baroque design
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    
    // Corner flourishes
    const cornerSize = borderWidth * 0.6;
    const corners = [
      {x: cornerSize, y: cornerSize},
      {x: width - cornerSize, y: cornerSize},
      {x: cornerSize, y: height - cornerSize},
      {x: width - cornerSize, y: height - cornerSize}
    ];
    
    corners.forEach(corner => {
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, cornerSize/3, 0, Math.PI * 2);
      ctx.stroke();
      
      // Decorative lines
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i;
        ctx.beginPath();
        ctx.moveTo(corner.x, corner.y);
        ctx.lineTo(
          corner.x + Math.cos(angle) * cornerSize/2,
          corner.y + Math.sin(angle) * cornerSize/2
        );
        ctx.stroke();
      }
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
    
    const borderWidth = Math.min(width, height) * 0.02;
    
    // Transparent background
    ctx.clearRect(0, 0, width, height);
    
    // Simple thin border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth/2, borderWidth/2, width - borderWidth, height - borderWidth);
    
    // Clear center
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
    return canvas.toDataURL();
  },

  'grunge-torn': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Aged paper background
    const paperGrad = ctx.createLinearGradient(0, 0, width, height);
    paperGrad.addColorStop(0, '#f5f5dc');
    paperGrad.addColorStop(0.5, '#f0f0e6');
    paperGrad.addColorStop(1, '#e6e6d4');
    
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Age spots and stains
    ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = Math.random() * borderWidth * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Torn edge effect - create irregular border
    ctx.globalCompositeOperation = 'destination-out';
    
    // Create jagged edges
    for (let i = 0; i < 100; i++) {
      const side = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
      let x, y, size;
      
      switch (side) {
        case 0: // top
          x = Math.random() * width;
          y = Math.random() * borderWidth;
          break;
        case 1: // right
          x = width - Math.random() * borderWidth;
          y = Math.random() * height;
          break;
        case 2: // bottom
          x = Math.random() * width;
          y = height - Math.random() * borderWidth;
          break;
        case 3: // left
          x = Math.random() * borderWidth;
          y = Math.random() * height;
          break;
        default:
          x = 0; y = 0;
      }
      
      size = Math.random() * borderWidth * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Clear main center area
    ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
    
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

// Generate a built-in border by ID with aspect ratio support
export function generateBuiltInBorder(borderId: string, width: number, height: number): string | null {
  const borderFunction = BUILT_IN_BORDERS[borderId];
  if (!borderFunction) {
    console.error(`Built-in border not found: ${borderId}`);
    return null;
  }
  
  try {
    console.log(`🎨 Generating border "${borderId}" at ${width}x${height}`);
    return borderFunction(width, height);
  } catch (error) {
    console.error(`Error generating border ${borderId}:`, error);
    return null;
  }
}

// Get active overlay configuration with proper built-in border support and aspect ratio detection
export function getActiveOverlay(): OverlayConfig | null {
  try {
    const overlays = JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
    if (overlays.length === 0) return null;
    
    const latestOverlay = overlays[overlays.length - 1];
    
    // Handle built-in border references with aspect ratio support
    if (latestOverlay.type === 'border' && latestOverlay.borderId) {
      console.log('🎨 Loading built-in border:', latestOverlay.borderId);
      
      // Use stored aspect ratio or default to square
      const aspectRatio = latestOverlay.aspectRatio || '1:1';
      const dimensions = getAspectRatioDimensions(aspectRatio, 512);
      
      // Generate border with appropriate dimensions
      const borderImage = generateBuiltInBorder(latestOverlay.borderId, dimensions.width, dimensions.height);
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

// Apply overlay to an image with smart auto-scaling and aspect ratio detection
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

        // Auto-detect aspect ratio of the background image
        const detectedAspectRatio = detectAspectRatio(backgroundImg.width, backgroundImg.height);
        
        console.log('🎨 Applying overlay with aspect ratio detection:', {
          canvasSize: `${canvas.width}x${canvas.height}`,
          detectedAspectRatio,
          overlayType: overlayConfig.type || 'unknown',
          overlayName: overlayConfig.name
        });

        // Draw background
        ctx.drawImage(backgroundImg, 0, 0);

        // Load and draw overlay
        overlayImg.onload = () => {
          try {
            // Handle built-in borders with dynamic regeneration for detected aspect ratio
            if (overlayConfig.type === 'border' && overlayConfig.borderId) {
              // If this is a border and the detected aspect ratio doesn't match, regenerate it
              const storedAspectRatio = overlayConfig.aspectRatio || '1:1';
              
              if (detectedAspectRatio !== storedAspectRatio) {
                console.log(`🔄 Regenerating border for aspect ratio: ${storedAspectRatio} → ${detectedAspectRatio}`);
                
                // Generate border with correct aspect ratio
                const newBorderImage = generateBuiltInBorder(overlayConfig.borderId, canvas.width, canvas.height);
                
                if (newBorderImage) {
                  // Load the new border image
                  const newOverlayImg = new Image();
                  newOverlayImg.onload = () => {
                    drawOverlay(ctx, canvas, newOverlayImg, overlayConfig);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                  };
                  newOverlayImg.onerror = () => {
                    reject(new Error('Failed to load regenerated border image'));
                  };
                  newOverlayImg.src = newBorderImage;
                  return;
                }
              }
            }
            
            // Draw overlay with existing image
            drawOverlay(ctx, canvas, overlayImg, overlayConfig);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
            
          } catch (error) {
            console.error('Error applying overlay:', error);
            reject(error);
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
      reject(error);
    }
  });
}

// Helper function to draw overlay with smart scaling
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  overlayImg: HTMLImageElement,
  overlayConfig: OverlayConfig
) {
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
      borderId: config.borderId,
      aspectRatio: config.aspectRatio
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
    overlayType: overlay?.type || 'unknown',
    aspectRatio: overlay?.aspectRatio || 'not specified'
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