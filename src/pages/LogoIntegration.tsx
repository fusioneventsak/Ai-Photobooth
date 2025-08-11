import React, { useState, useRef, ChangeEvent } from 'react';
import { Upload, Wand2, AlertCircle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useConfigStore } from '../store/configStore';
import { integrateLogoWithReplicate } from '../lib/logoIntegrationService';
import { uploadPhoto } from '../lib/supabase';

export default function LogoIntegration() {
  const { config } = useConfigStore();
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoDescription, setLogoDescription] = useState('');
  const [destinationPrompt, setDestinationPrompt] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    
    const file = event.target.files[0];
    
    // Check if the file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file is too large (max 5MB)');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setLogoImage(e.target.result as string);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file');
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const integrateLogoHandler = async () => {
    if (!logoImage) {
      setError('Please upload a logo image');
      return;
    }
    
    if (!logoDescription.trim()) {
      setError('Please provide a description of your logo');
      return;
    }
    
    if (!destinationPrompt.trim()) {
      setError('Please provide a destination context');
      return;
    }
    
    setProcessing(true);
    setError(null);
    
    try {
      const result = await integrateLogoWithReplicate({
        logoImage,
        logoDescription,
        destinationPrompt
      });
      
      setResultImage(result);
      
      // Clear previous errors
      setError(null);
    } catch (err) {
      console.error('Error integrating logo:', err);
      setError(err instanceof Error ? err.message : 'Failed to integrate logo');
      setResultImage(null);
    } finally {
      setProcessing(false);
    }
  };

  const saveToGallery = async () => {
    if (!resultImage) {
      setError('No result to save');
      return;
    }
    
    setUploading(true);
    
    try {
      // Convert the blob URL to a File object
      const response = await fetch(resultImage);
      const blob = await response.blob();
      const file = new File([blob], 'logo-integration.jpg', { type: 'image/jpeg' });
      
      // Create a prompt that combines the logo description and destination
      const prompt = `Logo integration: ${logoDescription} transformed into ${destinationPrompt}`;
      
      // Upload to Supabase
      const result = await uploadPhoto(file, prompt);
      
      if (!result) {
        throw new Error('Failed to save to gallery');
      }
      
      alert('Successfully saved to gallery!');
    } catch (err) {
      console.error('Error saving to gallery:', err);
      setError(err instanceof Error ? err.message : 'Failed to save to gallery');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setLogoImage(null);
    setLogoDescription('');
    setDestinationPrompt('');
    setResultImage(null);
    setError(null);
    
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Revoke the blob URL if it exists
    if (resultImage && resultImage.startsWith('blob:')) {
      URL.revokeObjectURL(resultImage);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center" style={{ color: config?.primary_color }}>
          Logo Integration
        </h1>
        
        <div className="mb-6 text-center">
          <p className="text-gray-300">
            Transform your logo into different contexts using Replicate's Flux-in-Context AI model.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Upload Your Logo</h2>
              
              <div 
                onClick={triggerFileInput}
                className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition"
              >
                {logoImage ? (
                  <div className="flex flex-col items-center">
                    <img 
                      src={logoImage} 
                      alt="Uploaded Logo" 
                      className="max-h-48 max-w-full mb-2 rounded"
                    />
                    <p className="text-sm text-gray-400">Click to change</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="w-12 h-12 mb-2 text-gray-500" />
                    <p>Click to upload your logo</p>
                    <p className="text-sm text-gray-500 mt-1">PNG, JPG, WebP (max 5MB)</p>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold mb-2">Integration Settings</h2>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Logo Description
                </label>
                <input
                  type="text"
                  value={logoDescription}
                  onChange={(e) => setLogoDescription(e.target.value)}
                  placeholder="e.g., a white logo on a black background"
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Describe your logo to help the AI understand it
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Destination Context
                </label>
                <input
                  type="text"
                  value={destinationPrompt}
                  onChange={(e) => setDestinationPrompt(e.target.value)}
                  placeholder="e.g., a rainbow tie dye hat"
                  className="w-full bg-gray-700 rounded-lg px-4 py-2 text-white"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Describe where you want your logo to appear
                </p>
              </div>
              
              <button
                onClick={integrateLogoHandler}
                disabled={!logoImage || processing || !logoDescription.trim() || !destinationPrompt.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition disabled:opacity-50"
                style={{ backgroundColor: config?.primary_color }}
              >
                <Wand2 className="w-5 h-5" />
                {processing ? 'Processing...' : 'Generate Integration'}
              </button>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6 flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Result</h2>
            
            <div className="flex-grow flex items-center justify-center bg-black rounded-lg p-4 mb-4 min-h-[300px]">
              {resultImage ? (
                <img 
                  src={resultImage} 
                  alt="Integrated Logo" 
                  className="max-w-full max-h-[300px] rounded shadow-lg" 
                />
              ) : processing ? (
                <div className="text-center">
                  <RefreshCw className="w-12 h-12 mx-auto mb-3 animate-spin text-blue-500" />
                  <p>Integrating your logo...</p>
                  <p className="text-xs text-gray-500 mt-1">This may take up to a minute</p>
                </div>
              ) : error ? (
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
                  <p className="text-red-400 mb-2">{error}</p>
                  <p className="text-sm text-gray-500">Please try again</p>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3" />
                  <p>Your integrated logo will appear here</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={resetForm}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
              >
                Reset
              </button>
              
              <button
                onClick={saveToGallery}
                disabled={!resultImage || uploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: config?.primary_color }}
              >
                {uploading ? 'Saving...' : 'Save to Gallery'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}