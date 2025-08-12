import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Settings, Image as ImageIcon, Camera, Layers } from 'lucide-react';
import Photobooth from './pages/Photobooth';
import Gallery from './pages/Gallery';
import Admin from './pages/Admin';
import OverlayIntegration from './pages/OverlayIntegration'; // FIXED: Import the new fixed component
import { useConfigStore } from './store/configStore';

function Navigation() {
  const { config } = useConfigStore();
  
  return (
    <nav className="bg-gray-800 text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold" style={{ color: config?.primary_color }}>
            {config?.brand_name || 'Virtual Photobooth'}
          </Link>
          
          <div className="flex space-x-4">
            <Link
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-700 transition"
            >
              <Camera className="w-5 h-5" />
              <span>Photobooth</span>
            </Link>
            
            <Link
              to="/gallery"
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-700 transition"
            >
              <ImageIcon className="w-5 h-5" />
              <span>Gallery</span>
            </Link>
            
            <Link
              to="/overlay-integration"
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-700 transition"
            >
              <Layers className="w-5 h-5" />
              <span>Overlay Integration</span> {/* FIXED: Updated name to be more descriptive */}
            </Link>
            
            <Link
              to="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-700 transition"
            >
              <Settings className="w-5 h-5" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  const { fetchConfig } = useConfigStore();

  React.useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900">
        <Navigation />
        <Routes>
          <Route path="/" element={<Photobooth />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/overlay-integration" element={<OverlayIntegration />} /> {/* FIXED: Updated route */}
          {/* Keep backwards compatibility */}
          <Route path="/logo-integration" element={<OverlayIntegration />} /> {/* Redirect old route */}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;