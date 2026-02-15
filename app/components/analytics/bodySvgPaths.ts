/**
 * SVG path data for body heat map muscle regions.
 * Simplified anatomical outlines for front and back views.
 */

export interface MuscleRegion {
  muscleGroup: string;
  view: 'front' | 'back';
  pathData: string;
  labelPosition: { x: number; y: number };
}

export const VIEWBOX = '0 0 200 400';

export const BODY_REGIONS: MuscleRegion[] = [
  // ─── Front View ────────────────────────────────────────────────────
  {
    muscleGroup: 'chest',
    view: 'front',
    pathData: 'M65,95 Q75,88 100,88 Q125,88 135,95 L135,125 Q125,130 100,130 Q75,130 65,125 Z',
    labelPosition: { x: 100, y: 110 },
  },
  {
    muscleGroup: 'abs',
    view: 'front',
    pathData: 'M75,132 L125,132 L122,195 Q100,200 78,195 Z',
    labelPosition: { x: 100, y: 165 },
  },
  {
    muscleGroup: 'shoulders',
    view: 'front',
    pathData: 'M50,82 Q60,75 68,82 L68,100 Q60,105 50,100 Z M132,82 Q140,75 150,82 L150,100 Q140,105 132,100 Z',
    labelPosition: { x: 50, y: 90 },
  },
  {
    muscleGroup: 'biceps',
    view: 'front',
    pathData: 'M42,105 L55,105 L55,150 Q48,155 42,150 Z M145,105 L158,105 L158,150 Q152,155 145,150 Z',
    labelPosition: { x: 48, y: 128 },
  },
  {
    muscleGroup: 'forearms',
    view: 'front',
    pathData: 'M40,152 L55,152 L52,195 L43,195 Z M145,152 L160,152 L157,195 L148,195 Z',
    labelPosition: { x: 47, y: 175 },
  },
  {
    muscleGroup: 'quads',
    view: 'front',
    pathData: 'M72,200 L95,200 L92,280 L75,280 Z M105,200 L128,200 L125,280 L108,280 Z',
    labelPosition: { x: 83, y: 240 },
  },
  // ─── Back View ─────────────────────────────────────────────────────
  {
    muscleGroup: 'traps',
    view: 'back',
    pathData: 'M78,72 Q100,65 122,72 L118,90 Q100,85 82,90 Z',
    labelPosition: { x: 100, y: 80 },
  },
  {
    muscleGroup: 'back',
    view: 'back',
    pathData: 'M68,92 L132,92 L130,160 Q100,168 70,160 Z',
    labelPosition: { x: 100, y: 128 },
  },
  {
    muscleGroup: 'triceps',
    view: 'back',
    pathData: 'M42,105 L55,105 L55,150 Q48,155 42,150 Z M145,105 L158,105 L158,150 Q152,155 145,150 Z',
    labelPosition: { x: 48, y: 128 },
  },
  {
    muscleGroup: 'glutes',
    view: 'back',
    pathData: 'M72,165 L128,165 L125,200 Q100,208 75,200 Z',
    labelPosition: { x: 100, y: 185 },
  },
  {
    muscleGroup: 'hamstrings',
    view: 'back',
    pathData: 'M72,205 L95,205 L92,285 L75,285 Z M105,205 L128,205 L125,285 L108,285 Z',
    labelPosition: { x: 83, y: 245 },
  },
  {
    muscleGroup: 'calves',
    view: 'back',
    pathData: 'M75,290 L92,290 L90,350 L78,350 Z M108,290 L125,290 L122,350 L110,350 Z',
    labelPosition: { x: 83, y: 320 },
  },
];
