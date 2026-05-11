// src/components/MarkerGrid.tsx
// 4-column grid of captured marker thumbnails.

import React, { useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import type { CapturedMarker } from '../types/marker';
import { MarkerThumbnail } from './MarkerThumbnail';

interface MarkerGridProps {
  markers: CapturedMarker[];
  onThumbnailPress: (marker: CapturedMarker) => void;
}

const NUM_COLUMNS = 4;
const GAP = 2; // px between cells

export const MarkerGrid = React.memo<MarkerGridProps>(({ markers, onThumbnailPress }) => {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CapturedMarker>) => (
      <MarkerThumbnail marker={item} onPress={onThumbnailPress} />
    ),
    [onThumbnailPress],
  );

  const keyExtractor = useCallback((item: CapturedMarker) => item.id, []);

  return (
    <FlatList
      data={markers}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.container}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      showsVerticalScrollIndicator={false}
    />
  );
});

MarkerGrid.displayName = 'MarkerGrid';

// Needed for JSX in the component — re-import View here
import { View } from 'react-native';

const styles = StyleSheet.create({
  container: {
    gap: GAP,
  },
  row: {
    gap: GAP,
  },
  separator: {
    height: GAP,
  },
});
