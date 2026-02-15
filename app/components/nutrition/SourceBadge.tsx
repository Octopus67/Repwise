import { TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getSourceBadgeColor,
  getSourceBadgeIcon,
  getSourceTooltip,
  type FoodSource,
} from '../../utils/sourceBadgeLogic';

export type { FoodSource } from '../../utils/sourceBadgeLogic';
export { getSourceBadgeColor, getSourceBadgeIcon, getSourceTooltip } from '../../utils/sourceBadgeLogic';

interface SourceBadgeProps {
  source: FoodSource;
  size?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SourceBadge({ source, size = 16 }: SourceBadgeProps) {
  const color = getSourceBadgeColor(source);
  const icon = getSourceBadgeIcon(source);

  return (
    <TouchableOpacity
      onPress={() => Alert.alert('Source Info', getSourceTooltip(source))}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={size} color={color} />
    </TouchableOpacity>
  );
}
