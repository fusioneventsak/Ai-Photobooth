export type { Config } from './config';

export type Photo = {
  id: string;
  filename: string;
  url: string;
  prompt: string;
  type: 'image' | 'video';
  user_id: string;
  metadata: any;
  created_at: string;
};