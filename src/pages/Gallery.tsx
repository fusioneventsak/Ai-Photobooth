import React from 'react';
import { motion } from 'framer-motion';
import { useConfigStore } from '../store/configStore';
import { getPublicPhotos } from '../lib/supabase';
import type { Photo } from '../types/supabase';

export default function Gallery() {
  const { config } = useConfigStore();
  const [photos, setPhotos] = React.useState<Photo[]>([]);

  React.useEffect(() => {
    const loadPhotos = async () => {
      const photos = await getPublicPhotos();
      setPhotos(photos);
    };
    loadPhotos();
  }, []);

  const getAnimationProps = () => {
    switch (config?.gallery_animation) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.5 }
        };
      case 'slide':
        return {
          initial: { x: 100, opacity: 0 },
          animate: { x: 0, opacity: 1 },
          exit: { x: -100, opacity: 0 },
          transition: { duration: 0.5 }
        };
      case 'zoom':
        return {
          initial: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 1.2, opacity: 0 },
          transition: { duration: 0.5 }
        };
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.5 }
        };
    }
  };

  const getLayoutClass = () => {
    switch (config?.gallery_layout) {
      case 'masonry':
        return 'columns-2 md:columns-3 lg:columns-4 gap-4';
      case 'carousel':
        return 'flex overflow-x-auto snap-x snap-mandatory';
      default: // grid
        return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="container mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center" style={{ color: config?.primary_color }}>
          Gallery
        </h1>
        
        <div className={getLayoutClass()}>
          {photos.map((photo) => (
            <motion.div
              key={photo.id}
              {...getAnimationProps()}
              className={`
                ${config?.gallery_layout === 'carousel' ? 'flex-none w-80 snap-center' : ''}
                ${config?.gallery_layout === 'masonry' ? 'mb-4' : ''}
              `}
            >
              <img
                src={photo.processed_url || photo.original_url}
                alt="Gallery"
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}