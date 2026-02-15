export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  category: 'compound' | 'isolation';
  image_url: string | null;
}
