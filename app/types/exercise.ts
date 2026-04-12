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
  coaching_cues?: string[] | null;
  strength_curve?: 'ascending' | 'descending' | 'bell_shaped' | 'flat' | null;
  loading_position?: 'stretched' | 'mid_range' | 'shortened' | null;
  stretch_hypertrophy_potential?: 'high' | 'moderate' | 'low' | 'none' | 'uncertain' | null;
  stimulus_to_fatigue?: 'excellent' | 'good' | 'moderate' | 'poor' | null;
  fatigue_rating?: 'low' | 'moderate' | 'high' | null;
}
