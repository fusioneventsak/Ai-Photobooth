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
        { start: [width*0.2, 0], end: [width*0.8, height], colors