export type { Config } from './config';

export type Photo = {
  id: string;
  created_at: string;
  original_url: string;
  processed_url: string | null;
  content_type: 'image' | 'video';
  duration: number | null;
  thumbnail_url: string | null;
  prompt: string;
  public: boolean;
};