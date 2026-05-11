// src/components/MarkerThumbnail.tsx
// A single 300×300 grid cell showing a captured marker image.

import React from 'react';
import {
  TouchableOpacity,
  Image,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import type { CapturedMarker } from '../types/marker';
import { base64ToPngDataUri } from '../utils/imageUtils';

interface MarkerThumbnailProps {
  marker: CapturedMarker;
  onPress: (marker: CapturedMarker) => void;
}

export const MarkerThumbnail = React.memo<MarkerThumbnailProps>(({ marker, onPress }) => {
  const uri = base64ToPngDataUri(marker.markerResult.extractedImageBase64);

  return (
    <TouchableOpacity
      style={styles.cell}
      onPress={() => onPress(marker)}
      activeOpacity={0.8}
      accessibilityLabel={`Captured marker ${marker.index}`}
      accessibilityRole="button"
    >
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="cover"
      />
      {/* Index badge */}
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>{marker.index}</Text>
      </View>
    </TouchableOpacity>
  );
});

MarkerThumbnail.displayName = 'MarkerThumbnail';

const CELL_SIZE = 300;

const styles = StyleSheet.create({
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    // No border-radius per spec
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
  },
});
