// src/lib/overlayUtils.ts - Complete version with all trading card overlays

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

  // TRADING CARD OVERLAYS - REDESIGNED WITH PROPER TEXT AND PROPORTIONS
  'pokemon-classic': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const border = 15; // Even border on all sides
    const cardWidth = width - (border * 2);
    const cardHeight = height - (border * 2);
    const photoHeight = cardHeight * 0.45; // Larger photo area
    const photoWidth = cardWidth - 20; // 10px margin on each side
    
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
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(border, border, cardWidth, cardHeight, 12);
    ctx.stroke();
    
    // Inner white border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(border + 3, border + 3, cardWidth - 6, cardHeight - 6, 10);
    ctx.stroke();
    
    // Pokemon name area (top)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(border + 10, border + 10, cardWidth - 20, 35);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 10, border + 10, cardWidth - 20, 35);
    
    // Add "POKEMON NAME" text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('POKEMON NAME', border + 15, border + 30);
    
    // HP section (top right)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(width - border - 70, border + 10, 60, 35);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(width - border - 70, border + 10, 60, 35);
    
    // Add HP text
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('HP 120', width - border - 15, border + 30);
    
    // Energy symbols (top left and right)
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(border + 25, border + 60, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#0000FF';
    ctx.beginPath();
    ctx.arc(width - border - 25, border + 60, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Pokemon type/stage area
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(border + 10, border + 55, cardWidth - 20, 25);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 10, border + 55, cardWidth - 20, 25);
    
    // Add stage text
    ctx.fillStyle = '#000000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Stage 1 Pokemon', border + 15, border + 70);
    
    // Attack section (below photo)
    const attackY = border + 90 + photoHeight;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(border + 10, attackY, cardWidth - 20, 80);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 10, attackY, cardWidth - 20, 80);
    
    // Add attack details
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Thunder Shock', border + 35, attackY + 20);
    
    ctx.font = '9px Arial';
    ctx.fillText('Flip a coin. If heads, the opponent', border + 15, attackY + 40);
    ctx.fillText('is paralyzed.', border + 15, attackY + 52);
    
    // Damage
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('30', cardWidth + border - 15, attackY + 25);
    
    // Energy cost for attack
    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(border + 25, attackY + 20, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Stats section (bottom)
    const statsY = height - border - 50;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(border + 10, statsY, cardWidth - 20, 40);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 10, statsY, cardWidth - 20, 40);
    
    // Add stats text
    ctx.fillStyle = '#000000';
    ctx.font = '8px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Length: 1\'04"  Weight: 13.2 lbs', border + 15, statsY + 15);
    ctx.fillText('Weakness: Fighting  Resistance: None', border + 15, statsY + 27);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(border + 10, border + 85, photoWidth, photoHeight);
    
    return canvas.toDataURL();
  },

  'pokemon-gx': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const border = 15;
    const cardWidth = width - (border * 2);
    const cardHeight = height - (border * 2);
    const photoHeight = cardHeight * 0.42;
    const photoWidth = cardWidth - 20;
    
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
    shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    shimmerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Modern card border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(border, border, cardWidth, cardHeight, 15);
    ctx.stroke();
    
    // Silver inner border
    ctx.strokeStyle = '#C0C0C0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(border + 3, border + 3, cardWidth - 6, cardHeight - 6, 12);
    ctx.stroke();
    
    // Pokemon name with GX styling
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(border + 10, border + 10, cardWidth - 20, 40);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('PIKACHU', border + 15, border + 35);
    
    ctx.fillStyle = '#FF69B4';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('GX', cardWidth - 25, border + 35);
    
    // HP section
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(width - border - 80, border + 55, 70, 30);
    
    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('HP 200', width - border - 15, border + 75);
    
    // GX Attack section
    const gxAttackY = border + 95 + photoHeight;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(border + 10, gxAttackY, cardWidth - 20, 60);
    
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Thunder Storm GX', border + 40, gxAttackY + 20);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '9px Arial';
    ctx.fillText('Deal 150 damage to each opponent', border + 15, gxAttackY + 35);
    ctx.fillText('Pokemon. (You can\'t use more than 1 GX)', border + 15, gxAttackY + 47);
    
    // Energy cost
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['#FFFF00', '#FFFF00', '#FFFF00'][i];
      ctx.beginPath();
      ctx.arc(border + 25 + (i * 20), gxAttackY + 20, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Damage
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('150', cardWidth + border - 15, gxAttackY + 25);
    
    // Bottom stats
    const statsY = height - border - 45;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(border + 10, statsY, cardWidth - 20, 35);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '8px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Weakness: Fighting x2  Resistance: Metal -20', border + 15, statsY + 15);
    ctx.fillText('Retreat Cost: 1', border + 15, statsY + 27);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(border + 10, border + 90, photoWidth, photoHeight);
    
    return canvas.toDataURL();
  },

  'sports-baseball': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const border = 15;
    const cardWidth = width - (border * 2);
    const cardHeight = height - (border * 2);
    const photoHeight = cardHeight * 0.55;
    const photoWidth = cardWidth - 20;
    
    // Classic baseball card cream background
    ctx.fillStyle = '#FFFEF7';
    ctx.fillRect(0, 0, width, height);
    
    // Team colors stripe (top)
    const teamGrad = ctx.createLinearGradient(0, 0, width, 0);
    teamGrad.addColorStop(0, '#003366');
    teamGrad.addColorStop(0.5, '#FFFFFF');
    teamGrad.addColorStop(1, '#FF0000');
    ctx.fillStyle = teamGrad;
    ctx.fillRect(border, border, cardWidth, 25);
    
    // Card border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(border, border, cardWidth, cardHeight);
    
    // Team logo area (top left)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(border + 35, border + 50, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add team text
    ctx.fillStyle = '#003366';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TEAM', border + 35, border + 55);
    
    // Player position (top right)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(width - border - 60, border + 30, 50, 25);
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 1;
    ctx.strokeRect(width - border - 60, border + 30, 50, 25);
    
    ctx.fillStyle = '#003366';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SS', width - border - 35, border + 47);
    
    // Player name area (below photo)
    const nameY = border + 65 + photoHeight;
    ctx.fillStyle = '#003366';
    ctx.fillRect(border + 5, nameY, cardWidth - 10, 30);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PLAYER NAME', width/2, nameY + 20);
    
    // Stats section
    const statsY = nameY + 35;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(border + 5, statsY, cardWidth - 10, 70);
    ctx.strokeStyle = '#003366';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 5, statsY, cardWidth - 10, 70);
    
    // Add stats
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('2024 SEASON STATS', border + 15, statsY + 15);
    
    ctx.font = '9px Arial';
    ctx.fillText('AVG: .325  HR: 42  RBI: 108', border + 15, statsY + 30);
    ctx.fillText('OBP: .412  SLG: .587  OPS: .999', border + 15, statsY + 42);
    ctx.fillText('G: 162  AB: 594  H: 193  R: 112', border + 15, statsY + 54);
    
    // Team/Year info
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MAJOR LEAGUE BASEBALL 2024', width/2, statsY + 67);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(border + 10, border + 60, photoWidth, photoHeight);
    
    return canvas.toDataURL();
  },

  'sports-basketball': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const border = 15;
    const cardWidth = width - (border * 2);
    const cardHeight = height - (border * 2);
    const photoHeight = cardHeight * 0.52;
    const photoWidth = cardWidth - 20;
    
    // Basketball court wood background
    const woodGrad = ctx.createLinearGradient(0, 0, 0, height);
    woodGrad.addColorStop(0, '#DEB887');
    woodGrad.addColorStop(0.5, '#CD853F');
    woodGrad.addColorStop(1, '#A0522D');
    
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Card border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(border, border, cardWidth, cardHeight);
    
    // Team colors header
    ctx.fillStyle = '#FF6600';
    ctx.fillRect(border + 5, border + 5, cardWidth - 10, 15);
    ctx.fillStyle = '#000080';
    ctx.fillRect(border + 5, border + 20, cardWidth - 10, 15);
    
    // Player number (top right)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(width - border - 50, border + 40, 40, 40);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(width - border - 50, border + 40, 40, 40);
    
    ctx.fillStyle = '#FF6600';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('23', width - border - 30, border + 65);
    
    // Court lines decoration
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    
    // Three-point arc
    ctx.beginPath();
    ctx.arc(width/2, height + 80, 100, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    
    // Player name area
    const nameY = border + 85 + photoHeight;
    ctx.fillStyle = '#000080';
    ctx.fillRect(border + 5, nameY, cardWidth - 10, 25);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PLAYER NAME', width/2, nameY + 17);
    
    // Stats section
    const statsY = nameY + 30;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(border + 5, statsY, cardWidth - 10, 65);
    ctx.strokeStyle = '#000080';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 5, statsY, cardWidth - 10, 65);
    
    // Add basketball stats
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('2023-24 SEASON', border + 15, statsY + 12);
    
    ctx.font = '8px Arial';
    ctx.fillText('PPG: 28.7  RPG: 8.3  APG: 6.8', border + 15, statsY + 25);
    ctx.fillText('FG%: .487  3P%: .389  FT%: .853', border + 15, statsY + 35);
    ctx.fillText('Games: 74  Minutes: 34.8', border + 15, statsY + 45);
    
    // Position
    ctx.fillStyle = '#FF6600';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('SMALL FORWARD', border + 15, statsY + 58);
    
    // League info
    ctx.fillStyle = '#000080';
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('NATIONAL BASKETBALL ASSOCIATION', width/2, height - border - 8);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(border + 10, border + 85, photoWidth, photoHeight);
    
    return canvas.toDataURL();
  },

  'sports-football': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const border = 15;
    const cardWidth = width - (border * 2);
    const cardHeight = height - (border * 2);
    const photoHeight = cardHeight * 0.50;
    const photoWidth = cardWidth - 20;
    
    // Football field green background
    const fieldGrad = ctx.createLinearGradient(0, 0, 0, height);
    fieldGrad.addColorStop(0, '#228B22');
    fieldGrad.addColorStop(0.5, '#32CD32');
    fieldGrad.addColorStop(1, '#228B22');
    
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Yard lines pattern
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    
    for (let y = border + 20; y < height - border - 20; y += 25) {
      ctx.beginPath();
      ctx.moveTo(border + 10, y);
      ctx.lineTo(width - border - 10, y);
      ctx.stroke();
    }
    
    // Card border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(border, border, cardWidth, cardHeight);
    
    // Team helmet area (top left)
    ctx.fillStyle = '#000080';
    ctx.fillRect(border + 10, border + 10, 60, 35);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(border + 10, border + 10, 60, 35);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('TEAM', border + 40, border + 30);
    
    // Player number/position (top right)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(width - border - 60, border + 10, 50, 35);
    ctx.strokeStyle = '#000080';
    ctx.lineWidth = 2;
    ctx.strokeRect(width - border - 60, border + 10, 50, 35);
    
    ctx.fillStyle = '#000080';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('12', width - border - 35, border + 25);
    
    ctx.font = 'bold 8px Arial';
    ctx.fillText('QB', width - border - 35, border + 38);
    
    // Player name area
    const nameY = border + 55 + photoHeight;
    ctx.fillStyle = '#000080';
    ctx.fillRect(border + 5, nameY, cardWidth - 10, 28);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PLAYER NAME', width/2, nameY + 18);
    
    // Stats section
    const statsY = nameY + 33;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(border + 5, statsY, cardWidth - 10, 80);
    ctx.strokeStyle = '#000080';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 5, statsY, cardWidth - 10, 80);
    
    // Add football stats
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('2024 SEASON STATS', border + 15, statsY + 12);
    
    ctx.font = '8px Arial';
    ctx.fillText('PASSING:', border + 15, statsY + 25);
    ctx.fillText('Completions: 389  Attempts: 590', border + 15, statsY + 35);
    ctx.fillText('Yards: 4,624  TDs: 35  INTs: 8', border + 15, statsY + 45);
    ctx.fillText('Rating: 108.2  Completion %: 65.9', border + 15, statsY + 55);
    
    ctx.fillText('RUSHING: 125 yds, 6 TDs', border + 15, statsY + 68);
    
    // League info
    ctx.fillStyle = '#000080';
    ctx.font = 'bold 7px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('NATIONAL FOOTBALL LEAGUE', width/2, height - border - 8);
    
    // Clear center for photo
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(border + 10, border + 50, photoWidth, photoHeight);
    
    return canvas.toDataURL();
  },

  'yugioh-classic': (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const border = 15;
    const cardWidth = width - (border * 2);
    const cardHeight = height - (border * 2);
    const photoHeight = cardHeight * 0.42;
    const photoWidth = cardWidth - 20;
    
    // Yu-Gi-Oh tan/beige background
    const yugiohGrad = ctx.createLinearGradient(0, 0, 0, height);
    yugiohGrad.addColorStop(0, '#F5DEB3');
    yugiohGrad.addColorStop(0.5, '#DDD8B8');
    yugiohGrad.addColorStop(1, '#D2B48C');
    
    ctx.fillStyle = yugiohGrad;
    ctx.fillRect(0, 0, width, height);
    
    // Card border with Egyptian styling
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    ctx.strokeRect(border, border, cardWidth, cardHeight);
    
    // Inner decorative border
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2;
    ctx.strokeRect(border + 3, border + 3, cardWidth - 6, cardHeight - 6);
    
    // Monster name area
    ctx.fillStyle = 'rgba(218, 165, 32, 0.9)';
    ctx.fillRect(border + 8, border + 8, cardWidth - 16, 25);
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 8, border + 8, cardWidth - 16, 25);
    
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('MONSTER NAME', border + 15, border + 25);
    
    // Attribute symbol (top right)
    ctx.fillStyle = '#FF6347';
    ctx.beginPath();
    ctx.arc(width - border - 25, border + 45, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Add attribute text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('FIRE', width - border - 25, border + 50);
    
    // Monster type/level area
    ctx.fillStyle = 'rgba(139, 69, 19, 0.9)';
    ctx.fillRect(border + 8, border + 38, cardWidth - 60, 25);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '9px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('[Dragon/Effect]', border + 15, border + 53);
    
    // Level stars
    const starY = border + 70;
    for (let i = 0; i < 7; i++) {
      if (i < 5) { // 5-star monster
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        // Create star shape
        const x = border + 15 + (i * 20);
        const y = starY;
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 2, y - 2);
        ctx.lineTo(x + 6, y - 2);
        ctx.lineTo(x + 3, y + 1);
        ctx.lineTo(x + 4, y + 5);
        ctx.lineTo(x, y + 3);
        ctx.lineTo(x - 4, y + 5);
        ctx.lineTo(x - 3, y + 1);
        ctx.lineTo(x - 6, y - 2);
        ctx.lineTo(x - 2, y - 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#B8860B';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    
    // Monster effect description
    const effectY = border + 85 + photoHeight;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(border + 8, effectY, cardWidth - 16, 60);
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;
    ctx.strokeRect(border + 8, effectY, cardWidth - 16, 60);
    
    ctx.fillStyle = '#000000';
    ctx.font = '8px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('When this card is Normal Summoned:', border + 12, effectY + 12);
    ctx.fillText('You can add 1 "Blue-Eyes" monster', border + 12, effectY + 23);
    ctx.fillText('from your Deck to your hand.', border + 12, effectY + 34);
    ctx.fillText('This card can attack directly.', border + 12, effectY + 45);
    
    // ATK/DEF section
    const statsY = height - border - 35;
    ctx.fillStyle = 'rgba(139, 69, 19, 0.9)';
    ctx.fillRect(border + 8, statsY, cardWidth - 16, 25);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('ATK/2500', border + 15, statsY + 15);
    
    ctx.textAlign = 'right';
    ctx.fillText('DEF/2000', width - border - 15, statsY + 15);
    
    // Set number
    ctx.fillStyle = '#000000';
    ctx.font = '6px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('LOB-001', width/2, height - border - 5);
    
    // Clear center for monster artwork
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(border + 10, border + 80, photoWidth, photoHeight);
    
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

// Additional utility functions for overlay management
export function shouldApplyOverlay(): boolean {
  const overlay = getActiveOverlay();
  return overlay !== null;
}

export function clearAllOverlays(): void {
  localStorage.removeItem('photoboothOverlays');
  console.log('🗑️ All overlays cleared');
}

export function getAllOverlays(): OverlayConfig[] {
  try {
    return JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
  } catch (error) {
    console.error('Error loading overlays:', error);
    return [];
  }
}

export function deleteOverlay(index: number): boolean {
  try {
    const overlays = getAllOverlays();
    if (index >= 0 && index < overlays.length) {
      overlays.splice(index, 1);
      localStorage.setItem('photoboothOverlays', JSON.stringify(overlays));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting overlay:', error);
    return false;
  }
}