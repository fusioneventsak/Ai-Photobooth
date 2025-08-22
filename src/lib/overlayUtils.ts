// src/lib/overlayUtils.ts - Updated with improved Polaroid and trading card overlays

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
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Chrome gradient background
    const chromeGrad = ctx.createLinearGradient(0, 0, width, height);
    chromeGrad.addColorStop(0, '#E8E8E8');
    chromeGrad.addColorStop(0.3, '#C0C0C0');
    chromeGrad.addColorStop(0.7, '#A8A8A8');
    chromeGrad.addColorStop(1, '#808080');
    
    ctx.fillStyle = chromeGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Metallic shine effect
    const shineGrad = ctx.createLinearGradient(0, 0, width/2, height/2);
    shineGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    shineGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shineGrad;
    ctx.fillRect(0, 0, width/2, height/2);
    
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
    const roseGoldGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    roseGoldGrad.addColorStop(0, '#E8B4B8');
    roseGoldGrad.addColorStop(0.5, '#D4988B');
    roseGoldGrad.addColorStop(1, '#B76E79');
    
    ctx.fillStyle = roseGoldGrad;
    ctx.fillRect(0, 0, width, height);
    
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
    
    // Holographic rainbow gradient
    const holoGrad = ctx.createConicGradient(0, width/2, height/2);
    holoGrad.addColorStop(0, '#ff0000');
    holoGrad.addColorStop(0.16, '#ff8000');
    holoGrad.addColorStop(0.33, '#ffff00');
    holoGrad.addColorStop(0.5, '#00ff00');
    holoGrad.addColorStop(0.66, '#0080ff');
    holoGrad.addColorStop(0.83, '#8000ff');
    holoGrad.addColorStop(1, '#ff0000');
    
    ctx.fillStyle = holoGrad;
    ctx.fillRect(0, 0, width, height);
    
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
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Oxidized copper gradient
    const copperGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    copperGrad.addColorStop(0, '#8FBC8F');
    copperGrad.addColorStop(0.5, '#2E8B57');
    copperGrad.addColorStop(1, '#006400');
    
    ctx.fillStyle = copperGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Patina texture
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgba(0, 100, 0, ${Math.random() * 0.3})`;
      ctx.fillRect(Math.random() * width, Math.random() * height, 5, 5);
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
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Titanium base
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(0, 0, width, height);
    
    // Brushed effect with horizontal lines
    ctx.globalAlpha = 0.3;
    for (let y = 0; y < height; y += 2) {
      ctx.strokeStyle = y % 4 === 0 ? '#A0A0A0' : '#D0D0D0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    
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
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Aurora gradient
    const auroraGrad = ctx.createLinearGradient(0, 0, width, height);
    auroraGrad.addColorStop(0, '#00ff88');
    auroraGrad.addColorStop(0.3, '#0088ff');
    auroraGrad.addColorStop(0.6, '#8800ff');
    auroraGrad.addColorStop(1, '#ff0088');
    
    ctx.fillStyle = auroraGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Flowing effect
    const flowGrad = ctx.createRadialGradient(width*0.3, height*0.3, 0, width*0.7, height*0.7, Math.max(width, height));
    flowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    flowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = flowGrad;
    ctx.fillRect(0, 0, width, height);
    
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
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Carbon fiber base
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Weave pattern
    const weaveSize = 8;
    for (let x = 0; x < width; x += weaveSize) {
      for (let y = 0; y < height; y += weaveSize) {
        if ((x + y) % (weaveSize * 2) === 0) {
          ctx.fillStyle = '#2a2a2a';
        } else {
          ctx.fillStyle = '#0a0a0a';
        }
        ctx.fillRect(x, y, weaveSize, weaveSize);
      }
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
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Dark background
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, width, height);
    
    // Circuit lines
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    
    // Horizontal circuits
    for (let y = borderWidth/2; y < height - borderWidth/2; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(borderWidth, y);
      ctx.moveTo(width - borderWidth, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Vertical circuits
    for (let x = borderWidth/2; x < width - borderWidth/2; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, borderWidth);
      ctx.moveTo(x, height - borderWidth);
      ctx.lineTo(x, height);
      ctx.stroke();
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
    
    const borderWidth = Math.min(width, height) * 0.08;
    
    // Dark cyber background
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, width, height);
    
    // Neon glow border
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 20;
    ctx.strokeRect(borderWidth/2, borderWidth/2, width - borderWidth, height - borderWidth);
    
    // Inner glow
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 15;
    ctx.strokeRect(borderWidth*0.7, borderWidth*0.7, width - borderWidth*1.4, height - borderWidth*1.4);
    
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
    const bottomBorder = borderWidth * 2.5; // Larger bottom border like Polaroid
    
    // White Polaroid background with subtle shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(8, 8, width - 8, height - 8); // Drop shadow
    
    // Main white frame
    ctx.fillStyle = '#f8f8f0';
    ctx.fillRect(0, 0, width, height);
    
    // Subtle aging/yellowing gradient
    const ageGrad = ctx.createLinearGradient(0, 0, width, height);
    ageGrad.addColorStop(0, 'rgba(255, 248, 220, 0.2)');
    ageGrad.addColorStop(1, 'rgba(255, 248, 220, 0.4)');
    ctx.fillStyle = ageGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Subtle edge darkening
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    
    // Clear center (photo area) - FULLY TRANSPARENT
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
    
    const borderWidth = Math.min(width, height) * 0.1;
    
    // Grunge background
    const grungeGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
    grungeGrad.addColorStop(0, '#8B4513');
    grungeGrad.addColorStop(0.7, '#654321');
    grungeGrad.addColorStop(1, '#3C2414');
    
    ctx.fillStyle = grungeGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Torn effect with random jagged edges
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    
    // Create jagged inner border
    const step = 10;
    const variance = borderWidth * 0.3;
    
    // Top edge
    ctx.moveTo(borderWidth + Math.random() * variance, borderWidth + Math.random() * variance);
    for (let x = borderWidth; x < width - borderWidth; x += step) {
      ctx.lineTo(x + Math.random() * variance, borderWidth + Math.random() * variance);
    }
    
    // Right edge
    for (let y = borderWidth; y < height - borderWidth; y += step) {
      ctx.lineTo(width - borderWidth - Math.random() * variance, y + Math.random() * variance);
    }
    
    // Bottom edge
    for (let x = width - borderWidth; x > borderWidth; x -= step) {
      ctx.lineTo(x - Math.random() * variance, height - borderWidth - Math.random() * variance);
    }
    
    // Left edge
    for (let y = height - borderWidth; y > borderWidth; y -= step) {
      ctx.lineTo(borderWidth + Math.random() * variance, y - Math.random() * variance);
    }
    
    ctx.closePath();
    ctx.fill();
    
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
  },

  // NEW TRADING CARD OVERLAYS
  'pokemon-classic': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.12;
    const photoHeight = height * 0.6; // Photo takes up 60% of card height
    
    // Classic Pokemon card yellow gradient background
    const pokemonGrad = ctx.createLinearGradient(0, 0, 0, height);
    pokemonGrad.addColorStop(0, '#FFD700');
    pokemonGrad.addColorStop(0.3, '#FFA500');
    pokemonGrad.addColorStop(0.7, '#FF8C00');
    pokemonGrad.addColorStop(1, '#FF6347');
    
    ctx.fillStyle = pokemonGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Card border with rounded corners
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, width - 16, height - 16, 15);
    ctx.stroke();
    
    // Inner border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(12, 12, width - 24, height - 24, 12);
    ctx.stroke();
    
    // Energy symbols in corners
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(30, 30, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#0000FF';
    ctx.beginPath();
    ctx.arc(width - 30, 30, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // HP bar area (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(width - 80, 50, 60, 25);
    
    // Stats area (bottom)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(borderWidth, height - borderWidth * 2, width - borderWidth * 2, borderWidth * 1.5);
    
    // Clear center for photo (upper portion of card)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth + 10, borderWidth + 50, width - (borderWidth + 10) * 2, photoHeight - 60);
    
    return canvas.toDataURL();
  },

  'pokemon-gx': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.12;
    const photoHeight = height * 0.6;
    
    // GX holographic background
    const gxGrad = ctx.createConicGradient(Math.PI/4, width/2, height/2);
    gxGrad.addColorStop(0, '#FFD700');
    gxGrad.addColorStop(0.25, '#FF69B4');
    gxGrad.addColorStop(0.5, '#00CED1');
    gxGrad.addColorStop(0.75, '#9370DB');
    gxGrad.addColorStop(1, '#FFD700');
    
    ctx.fillStyle = gxGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Holographic shimmer overlay
    const shimmerGrad = ctx.createLinearGradient(0, 0, width, height);
    shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    shimmerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Modern card border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(6, 6, width - 12, height - 12, 20);
    ctx.stroke();
    
    // GX text background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(width - 60, height - 80, 50, 30);
    
    // Energy cost circles
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['#FF0000', '#0000FF', '#FFFF00'][i];
      ctx.beginPath();
      ctx.arc(30 + i * 35, height - 50, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth + 8, borderWidth + 40, width - (borderWidth + 8) * 2, photoHeight - 50);
    
    return canvas.toDataURL();
  },

  'sports-baseball': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.1;
    const photoHeight = height * 0.7;
    
    // Baseball card classic white/cream background
    ctx.fillStyle = '#FFFEF7';
    ctx.fillRect(0, 0, width, height);
    
    // Team colors stripe (top)
    const teamGrad = ctx.createLinearGradient(0, 0, width, 0);
    teamGrad.addColorStop(0, '#003366');
    teamGrad.addColorStop(1, '#FF0000');
    ctx.fillStyle = teamGrad;
    ctx.fillRect(0, 0, width, 30);
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    
    // Player name area (bottom)
    ctx.fillStyle = '#003366';
    ctx.fillRect(0, height - 60, width, 60);
    
    // Stats area
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(borderWidth, height - 120, width - borderWidth * 2, 55);
    
    // Team logo area (top left)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(40, 60, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, 35, width - borderWidth * 2, photoHeight - 40);
    
    return canvas.toDataURL();
  },

  'sports-basketball': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.1;
    const photoHeight = height * 0.7;
    
    // Basketball court wood background
    const woodGrad = ctx.createLinearGradient(0, 0, 0, height);
    woodGrad.addColorStop(0, '#DEB887');
    woodGrad.addColorStop(0.5, '#CD853F');
    woodGrad.addColorStop(1, '#A0522D');
    
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Court lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    
    // Three-point line arc (decorative)
    ctx.beginPath();
    ctx.arc(width/2, height + 50, 80, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    
    // Team colors banner
    ctx.fillStyle = '#FF6600';
    ctx.fillRect(0, height - 80, width, 40);
    
    ctx.fillStyle = '#000080';
    ctx.fillRect(0, height - 40, width, 40);
    
    // Player number area (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(width - 70, 20, 60, 60);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth + 10, width - borderWidth * 2, photoHeight - 20);
    
    return canvas.toDataURL();
  },

  'sports-football': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.1;
    const photoHeight = height * 0.7;
    
    // Football field green background
    const fieldGrad = ctx.createLinearGradient(0, 0, 0, height);
    fieldGrad.addColorStop(0, '#228B22');
    fieldGrad.addColorStop(0.5, '#32CD32');
    fieldGrad.addColorStop(1, '#228B22');
    
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Yard lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    
    for (let y = 20; y < height - 20; y += 25) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }
    
    // Team helmet area (top left)
    ctx.fillStyle = 'rgba(0, 0, 139, 0.9)';
    ctx.fillRect(15, 15, 80, 50);
    
    // Player stats (bottom)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, height - 70, width, 70);
    
    // Position/Number (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(width - 60, 15, 50, 50);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth + 15, width - borderWidth * 2, photoHeight - 25);
    
    return canvas.toDataURL();
  },

  'yugioh-classic': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.12;
    const photoHeight = height * 0.5;
    
    // Yu-Gi-Oh tan/beige background
    const yugiohGrad = ctx.createLinearGradient(0, 0, 0, height);
    yugiohGrad.addColorStop(0, '#F5DEB3');
    yugiohGrad.addColorStop(0.5, '#DDD8B8');
    yugiohGrad.addColorStop(1, '#D2B48C');
    
    ctx.fillStyle = yugiohGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Card border with Egyptian styling
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    
    // Inner decorative border
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    // Attribute symbol area (top right)
    ctx.fillStyle = '#FF6347';
    ctx.beginPath();
    ctx.arc(width - 35, 35, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Level stars area (below photo)
    const starY = photoHeight + borderWidth + 20;
    for (let i = 0; i < 8; i++) {
      if (i < 5) { // Only show 5 stars for this example
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        // Simple star shape (pentagon)
        ctx.arc(30 + i * 35, starY, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Attack/Defense area (bottom)
    ctx.fillStyle = 'rgba(139, 69, 19, 0.9)';
    ctx.fillRect(borderWidth, height - 60, width - borderWidth * 2, 50);
    
    // Name area (below photo, above stars)
    ctx.fillStyle = 'rgba(218, 165, 32, 0.9)';
    ctx.fillRect(borderWidth, photoHeight + borderWidth, width - borderWidth * 2, 35);
    
    // Clear center for monster artwork
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth + 5, borderWidth + 5, width - (borderWidth + 5) * 2, photoHeight - 10);
    
    return canvas.toDataURL();
  },

  // NEW TRADING CARD OVERLAYS
  'pokemon-classic': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.12;
    const photoHeight = height * 0.6; // Photo takes up 60% of card height
    
    // Classic Pokemon card yellow gradient background
    const pokemonGrad = ctx.createLinearGradient(0, 0, 0, height);
    pokemonGrad.addColorStop(0, '#FFD700');
    pokemonGrad.addColorStop(0.3, '#FFA500');
    pokemonGrad.addColorStop(0.7, '#FF8C00');
    pokemonGrad.addColorStop(1, '#FF6347');
    
    ctx.fillStyle = pokemonGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Card border with rounded corners
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, width - 16, height - 16, 15);
    ctx.stroke();
    
    // Inner border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(12, 12, width - 24, height - 24, 12);
    ctx.stroke();
    
    // Energy symbols in corners
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(30, 30, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#0000FF';
    ctx.beginPath();
    ctx.arc(width - 30, 30, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // HP bar area (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(width - 80, 50, 60, 25);
    
    // Stats area (bottom)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(borderWidth, height - borderWidth * 2, width - borderWidth * 2, borderWidth * 1.5);
    
    // Clear center for photo (upper portion of card)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth + 10, borderWidth + 50, width - (borderWidth + 10) * 2, photoHeight - 60);
    
    return canvas.toDataURL();
  },

  'pokemon-gx': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.12;
    const photoHeight = height * 0.6;
    
    // GX holographic background
    const gxGrad = ctx.createConicGradient(Math.PI/4, width/2, height/2);
    gxGrad.addColorStop(0, '#FFD700');
    gxGrad.addColorStop(0.25, '#FF69B4');
    gxGrad.addColorStop(0.5, '#00CED1');
    gxGrad.addColorStop(0.75, '#9370DB');
    gxGrad.addColorStop(1, '#FFD700');
    
    ctx.fillStyle = gxGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Holographic shimmer overlay
    const shimmerGrad = ctx.createLinearGradient(0, 0, width, height);
    shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    shimmerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Modern card border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(6, 6, width - 12, height - 12, 20);
    ctx.stroke();
    
    // GX text background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(width - 60, height - 80, 50, 30);
    
    // Energy cost circles
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['#FF0000', '#0000FF', '#FFFF00'][i];
      ctx.beginPath();
      ctx.arc(30 + i * 35, height - 50, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth + 8, borderWidth + 40, width - (borderWidth + 8) * 2, photoHeight - 50);
    
    return canvas.toDataURL();
  },

  'sports-baseball': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.1;
    const photoHeight = height * 0.7;
    
    // Baseball card classic white/cream background
    ctx.fillStyle = '#FFFEF7';
    ctx.fillRect(0, 0, width, height);
    
    // Team colors stripe (top)
    const teamGrad = ctx.createLinearGradient(0, 0, width, 0);
    teamGrad.addColorStop(0, '#003366');
    teamGrad.addColorStop(1, '#FF0000');
    ctx.fillStyle = teamGrad;
    ctx.fillRect(0, 0, width, 30);
    
    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    
    // Player name area (bottom)
    ctx.fillStyle = '#003366';
    ctx.fillRect(0, height - 60, width, 60);
    
    // Stats area
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(borderWidth, height - 120, width - borderWidth * 2, 55);
    
    // Team logo area (top left)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(40, 60, 25, 0, Math.PI * 2);
    ctx.fill();
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, 35, width - borderWidth * 2, photoHeight - 40);
    
    return canvas.toDataURL();
  },

  'sports-basketball': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.1;
    const photoHeight = height * 0.7;
    
    // Basketball court wood background
    const woodGrad = ctx.createLinearGradient(0, 0, 0, height);
    woodGrad.addColorStop(0, '#DEB887');
    woodGrad.addColorStop(0.5, '#CD853F');
    woodGrad.addColorStop(1, '#A0522D');
    
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Court lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    
    // Three-point line arc (decorative)
    ctx.beginPath();
    ctx.arc(width/2, height + 50, 80, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    
    // Team colors banner
    ctx.fillStyle = '#FF6600';
    ctx.fillRect(0, height - 80, width, 40);
    
    ctx.fillStyle = '#000080';
    ctx.fillRect(0, height - 40, width, 40);
    
    // Player number area (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(width - 70, 20, 60, 60);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth + 10, width - borderWidth * 2, photoHeight - 20);
    
    return canvas.toDataURL();
  },

  'sports-football': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.1;
    const photoHeight = height * 0.7;
    
    // Football field green background
    const fieldGrad = ctx.createLinearGradient(0, 0, 0, height);
    fieldGrad.addColorStop(0, '#228B22');
    fieldGrad.addColorStop(0.5, '#32CD32');
    fieldGrad.addColorStop(1, '#228B22');
    
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Yard lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    
    for (let y = 20; y < height - 20; y += 25) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();
    }
    
    // Team helmet area (top left)
    ctx.fillStyle = 'rgba(0, 0, 139, 0.9)';
    ctx.fillRect(15, 15, 80, 50);
    
    // Player stats (bottom)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, height - 70, width, 70);
    
    // Position/Number (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(width - 60, 15, 50, 50);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth, borderWidth + 15, width - borderWidth * 2, photoHeight - 25);
    
    return canvas.toDataURL();
  },

  'yugioh-classic': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const borderWidth = Math.min(width, height) * 0.12;
    const photoHeight = height * 0.5;
    
    // Yu-Gi-Oh tan/beige background
    const yugiohGrad = ctx.createLinearGradient(0, 0, 0, height);
    yugiohGrad.addColorStop(0, '#F5DEB3');
    yugiohGrad.addColorStop(0.5, '#DDD8B8');
    yugiohGrad.addColorStop(1, '#D2B48C');
    
    ctx.fillStyle = yugiohGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Card border with Egyptian styling
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, width - 12, height - 12);
    
    // Inner decorative border
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);
    
    // Attribute symbol area (top right)
    ctx.fillStyle = '#FF6347';
    ctx.beginPath();
    ctx.arc(width - 35, 35, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Level stars area (below photo)
    const starY = photoHeight + borderWidth + 20;
    for (let i = 0; i < 8; i++) {
      if (i < 5) { // Only show 5 stars for this example
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        // Simple star shape (pentagon)
        ctx.arc(30 + i * 35, starY, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Attack/Defense area (bottom)
    ctx.fillStyle = 'rgba(139, 69, 19, 0.9)';
    ctx.fillRect(borderWidth, height - 60, width - borderWidth * 2, 50);
    
    // Name area (below photo, above stars)
    ctx.fillStyle = 'rgba(218, 165, 32, 0.9)';
    ctx.fillRect(borderWidth, photoHeight + borderWidth, width - borderWidth * 2, 35);
    
    // Clear center for monster artwork
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(borderWidth + 5, borderWidth + 5, width - (borderWidth + 5) * 2, photoHeight - 10);
    
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

// Save overlay configuration to localStorage
export function saveOverlayConfig(config: OverlayConfig): boolean {
  try {
    const overlays = JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
    overlays.push(config);
    localStorage.setItem('photoboothOverlays', JSON.stringify(overlays));
    return true;
  } catch (error) {
    console.error('Error saving overlay config:', error);
    return false;
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

// Helper function to draw overlay with proper scaling and positioning
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  overlayImg: HTMLImageElement,
  overlayConfig: OverlayConfig
) {
  const { settings } = overlayConfig;
  
  // Smart scaling based on overlay type
  let finalScale = settings.scale;
  let overlayWidth = overlayImg.width * finalScale;
  let overlayHeight = overlayImg.height * finalScale;

  // Auto-scale logic for borders vs logos
  if (overlayConfig.type === 'border') {
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
  
  switch (settings.position) {
    case 'top-left':
      x = settings.offsetX;
      y = settings.offsetY;
      break;
    case 'top-right':
      x = canvas.width - overlayWidth - settings.offsetX;
      y = settings.offsetY;
      break;
    case 'bottom-left':
      x = settings.offsetX;
      y = canvas.height - overlayHeight - settings.offsetY;
      break;
    case 'bottom-right':
      x = canvas.width - overlayWidth - settings.offsetX;
      y = canvas.height - overlayHeight - settings.offsetY;
      break;
    case 'center':
      x = (canvas.width - overlayWidth) / 2 + settings.offsetX;
      y = (canvas.height - overlayHeight) / 2 + settings.offsetY;
      break;
    case 'top-center':
      x = (canvas.width - overlayWidth) / 2 + settings.offsetX;
      y = settings.offsetY;
      break;
    case 'bottom-center':
      x = (canvas.width - overlayWidth) / 2 + settings.offsetX;
      y = canvas.height - overlayHeight - settings.offsetY;
      break;
  }

  // Apply overlay settings
  ctx.globalAlpha = settings.opacity;
  ctx.globalCompositeOperation = settings.blendMode as GlobalCompositeOperation;

  // Draw overlay
  ctx.drawImage(overlayImg, x, y, overlayWidth, overlayHeight);

  // Reset context
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
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
            
            // Use existing overlay image
            drawOverlay(ctx, canvas, overlayImg, overlayConfig);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
            
          } catch (error) {
            console.error('Error drawing overlay:', error);
            reject(new Error(`Failed to draw overlay: ${error instanceof Error ? error.message : 'Unknown error'}`));
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
      console.error('Error setting up overlay application:', error);
      reject(new Error(`Failed to setup overlay: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}