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
  {
    id: 'copper-oxidized',
    name: 'Oxidized Copper',
    description: 'Weathered copper with patina effects',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.07;
      
      // Base copper color
      const copperGrad = ctx.createRadialGradient(width/3, height/3, 0, width/2, height/2, Math.max(width, height));
      copperGrad.addColorStop(0, '#B87333');
      copperGrad.addColorStop(0.3, '#CD853F');
      copperGrad.addColorStop(0.6, '#8B4513');
      copperGrad.addColorStop(0.8, '#A0522D');
      copperGrad.addColorStop(1, '#654321');
      
      ctx.fillStyle = copperGrad;
      ctx.fillRect(0, 0, width, height);
      
      // Patina/verdigris effect
      const patinaGrad = ctx.createRadialGradient(width*0.7, height*0.2, 0, width/2, height/2, Math.max(width, height)*0.8);
      patinaGrad.addColorStop(0, 'rgba(72, 201, 176, 0.6)');
      patinaGrad.addColorStop(0.4, 'rgba(64, 224, 208, 0.3)');
      patinaGrad.addColorStop(0.7, 'rgba(32, 178, 170, 0.4)');
      patinaGrad.addColorStop(1, 'rgba(0, 128, 128, 0.2)');
      
      ctx.fillStyle = patinaGrad;
      ctx.fillRect(0, 0, width, height);
      
      // Add some texture spots
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const radius = Math.random() * borderWidth * 0.3;
        const opacity = Math.random() * 0.3 + 0.1;
        
        ctx.fillStyle = `rgba(72, 201, 176, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Clear center
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    }
  },
  {
    id: 'titanium-brushed',
    name: 'Brushed Titanium',
    description: 'Industrial brushed metal finish',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.055;
      
      // Base titanium color
      const titaniumGrad = ctx.createLinearGradient(0, 0, 0, height);
      titaniumGrad.addColorStop(0, '#C0C0C0');
      titaniumGrad.addColorStop(0.25, '#D3D3D3');
      titaniumGrad.addColorStop(0.5, '#A9A9A9');
      titaniumGrad.addColorStop(0.75, '#DCDCDC');
      titaniumGrad.addColorStop(1, '#B0B0B0');
      
      ctx.fillStyle = titaniumGrad;
      ctx.fillRect(0, 0, width, height);
      
      // Brushed texture lines
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < height; i += 2) {
        const opacity = Math.sin(i * 0.1) * 0.5 + 0.5;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
        
        ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(0, i + 1);
        ctx.lineTo(width, i + 1);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      
      // Clear center
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    }
  },
  {
    id: 'aurora-gradient',
    name: 'Aurora Borealis',
    description: 'Northern lights inspired flowing gradient',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.045;
      
      // Create flowing aurora effect
      const centerX = width / 2;
      const centerY = height / 2;
      
      // Multiple flowing gradients
      const flows = [
        { start: [0, height*0.3], end: [width, height*0.7], colors: ['#001122', '#003366', '#006699', '#0099CC'] },
        { start: [width*0.2, 0], end: [width*0.8, height], colors: ['#1a0033', '#330066', '#6600CC', '#9933FF'] },
        { start: [width, height*0.2], end: [0, height*0.8], colors: ['#001a00', '#003300', '#006600', '#00CC33'] }
      ];
      
      flows.forEach((flow, index) => {
        const gradient = ctx.createLinearGradient(flow.start[0], flow.start[1], flow.end[0], flow.end[1]);
        flow.colors.forEach((color, i) => {
          gradient.addColorStop(i / (flow.colors.length - 1), color + (index === 0 ? '80' : '60'));
        });
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      });
      
      // Add shimmer highlights
      const shimmer = ctx.createRadialGradient(centerX, centerY*0.3, 0, centerX, centerY, Math.max(width, height)*0.6);
      shimmer.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      shimmer.addColorStop(0.5, 'rgba(180, 255, 255, 0.2)');
      shimmer.addColorStop(1, 'rgba(255, 180, 255, 0.1)');
      
      ctx.fillStyle = shimmer;
      ctx.fillRect(0, 0, width, height);
      
      // Clear center
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    }
  },
  {
    id: 'carbon-fiber',
    name: 'Carbon Fiber',
    description: 'High-tech woven carbon fiber pattern',
    category: 'tech',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.06;
      const weaveSize = borderWidth * 0.3;
      
      // Base dark color
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);
      
      // Create carbon fiber weave pattern
      for (let x = 0; x < width; x += weaveSize * 2) {
        for (let y = 0; y < height; y += weaveSize * 2) {
          // Horizontal weave
          ctx.fillStyle = '#333333';
          ctx.fillRect(x, y, weaveSize * 2, weaveSize);
          
          // Vertical weave
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(x + weaveSize, y, weaveSize, weaveSize * 2);
          
          // Highlight threads
          ctx.fillStyle = '#404040';
          ctx.fillRect(x + weaveSize * 0.1, y + weaveSize * 0.1, weaveSize * 1.8, weaveSize * 0.1);
          ctx.fillRect(x + weaveSize + weaveSize * 0.1, y + weaveSize * 0.1, weaveSize * 0.1, weaveSize * 1.8);
        }
      }
      
      // Add glossy overlay
      const glossy = ctx.createLinearGradient(0, 0, width, height);
      glossy.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      glossy.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      glossy.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
      
      ctx.fillStyle = glossy;
      ctx.fillRect(0, 0, width, height);
      
      // Clear center
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(borderWidth, borderWidth, width - borderWidth*2, height - borderWidth*2);
      
      return canvas.toDataURL();
    }
  },
  {
    id: 'minimal-line',
    name: 'Minimal Line',
    description: 'Clean, thin border line',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
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
    }
  },
  {
    id: 'neon-glow',
    name: 'Neon Glow',
    description: 'Cyberpunk-style glowing border',
    category: 'tech',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const borderWidth = Math.min(width, height) * 0.03;
      
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
    }
  },
  {
    id: 'film-strip',
    name: 'Film Strip',
    description: 'Classic cinema film border',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
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
    }
  },
  {
    id: 'polaroid',
    name: 'Polaroid',
    description: 'Instant photo border with shadow',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
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
    }
  },
  {
    id: 'ornate-baroque',
    name: 'Ornate Baroque',
    description: 'Decorative vintage-style border',
    category: 'decorative',
    generateCanvas: (width: number, height: number) => {
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
    }
  },
  {
    id: 'minimal-line',
    name: 'Minimal Line',
    description: 'Clean, thin border line',
    category: 'modern',
    generateCanvas: (width: number, height: number) => {
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
    }
  },
  {
    id: 'grunge-torn',
    name: 'Grunge Torn',
    description: 'Rough, distressed edge effect',
    category: 'decorative',
    generateCanvas: (width: number, height: number) => {
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
    }
  },
  {
    id: 'tech-grid',
    name: 'Tech Grid',
    description: 'Futuristic grid pattern border',
    category: 'tech',
    generateCanvas: (width: number, height: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const gridSize = Math.min(width, height) * 0.02;
      const borderWidth = gridSize * 4;
      
      // Grid pattern
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
      ctx.lineWidth = 1;
      
      // Vertical lines
      for (let x = 0; x < width; x += gridSize) {
        if (x < borderWidth || x > width - borderWidth) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
      }
      
      // Horizontal lines
      for (let y = 0; y < height; y += gridSize) {
        if (y < borderWidth || y > height - borderWidth) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }
      
      // Corner accents
      ctx.strokeStyle = '#00FF88';
      ctx.lineWidth = 3;
      const accentSize = borderWidth;
      
      // Top-left
      ctx.strokeRect(0, 0, accentSize, accentSize);
      // Top-right
      ctx.strokeRect(width - accentSize, 0, accentSize, accentSize);
      // Bottom-left
      ctx.strokeRect(0, height - accentSize, accentSize, accentSize);
      // Bottom-right
      ctx.strokeRect(width - accentSize, height - accentSize, accentSize, accentSize);
      
      return canvas.toDataURL();
    }
  }
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

  // Handle overlay image upload
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
        setOverlayImage(e.target.result);
        setSelectedBorder(null); // Clear border selection when uploading custom image
        setError(null);
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
    const border = BUILT_IN_BORDERS.find(b => b.id === borderId);
    if (border) {
      // Generate border at a high resolution for quality
      const borderImage = border.generateCanvas(1024, 1024);
      setOverlayImage(borderImage);
      setSelectedBorder(borderId);
      setOverlayName(border.name);
      
      // Auto-configure settings for borders vs logos
      setOverlaySettings(prev => ({
        ...prev,
        position: 'center',
        scale: 1.0, // Will be auto-scaled to fit image
        opacity: border.id.includes('holographic') || border.id.includes('aurora') ? 0.7 : 0.9,
        blendMode: border.id.includes('metallic') || border.id.includes('chrome') ? 'multiply' : 'normal'
      }));
      setError(null);
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

      // **ENHANCED: Smart scaling based on overlay type and canvas size**
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
        
        // Calculate a smart scale factor
        const smartScale = Math.min(
          canvasSize * 0.3 / overlaySize, // Don't exceed 30% of canvas
          1.0 // Don't upscale beyond original size
        );
        
        // Apply the smart scale multiplied by user's scale preference
        finalScale = smartScale * overlaySettings.scale;
        overlayWidth = overlayImg.width * finalScale;
        overlayHeight = overlayImg.height * finalScale;
      }

      let overlayX = 0;
      let overlayY = 0;

      // Calculate position based on setting
      if (selectedBorder) {
        // Borders always center and fill
        overlayX = 0;
        overlayY = 0;
      } else {
        // Smart positioning for logos/watermarks
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

      // Draw overlay with smart scaling
      ctx.drawImage(overlayImg, overlayX, overlayY, overlayWidth, overlayHeight);

      // Reset canvas state
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Convert to data URL
      const resultDataUrl = canvas.toDataURL('image/png', 0.95);
      setResultImage(resultDataUrl);

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
  }, [overlaySettings, overlayImage, testImage]);

  // Save overlay configuration
  const saveOverlayConfig = async () => {
    if (!overlayImage || !overlayName.trim()) {
      setError('Please provide an overlay image and name');
      return;
    }

    setProcessing(true);
    setError(null);
    
    try {
      // Save overlay configuration to localStorage
      const overlayConfig = {
        name: overlayName,
        image: overlayImage,
        settings: overlaySettings,
        createdAt: new Date().toISOString(),
        type: selectedBorder ? 'border' : 'custom'
      };

      // Get existing overlays and add new one
      const existingOverlays = JSON.parse(localStorage.getItem('photoboothOverlays') || '[]');
      
      // Check if overlay with same name exists and ask for confirmation
      const existingIndex = existingOverlays.findIndex((overlay: any) => overlay.name === overlayName);
      if (existingIndex !== -1) {
        const shouldReplace = confirm(`An overlay named "${overlayName}" already exists. Do you want to replace it?`);
        if (shouldReplace) {
          existingOverlays[existingIndex] = overlayConfig;
        } else {
          setProcessing(false);
          return;
        }
      } else {
        existingOverlays.push(overlayConfig);
      }

      // Save to localStorage
      localStorage.setItem('photoboothOverlays', JSON.stringify(existingOverlays));

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
      alert(`✅ Overlay "${overlayName}" saved successfully!\n\nThis overlay will now be automatically applied to all AI generated photos.`);
      
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
                {/* Position */}
                <div>
                  <label className="block text-sm font-medium mb-2">Position</label>
                  <select
                    value={overlaySettings.position}
                    onChange={(e) => setOverlaySettings(prev => ({ ...prev, position: e.target.value as OverlayPosition }))}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2 text-white"
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
                  <label className="block text-sm font-medium mb-2">
                    Scale: {Math.round(overlaySettings.scale * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
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

                {/* Offset X */}
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
                    className="w-full"
                  />
                </div>

                {/* Offset Y */}
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
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}