export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  secondary_muscles: string[];
  equipment: string;
  category: 'compound' | 'isolation';
  image_url: string | null;
  animation_url: string | null;
  description: string | null;
  instructions: string[] | null;
  tips: string[] | null;
  is_custom?: boolean;
}
