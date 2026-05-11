// src/screens/ResultsScreen.tsx
// Gallery screen showing all captured 300×300 marker thumbnails in a 4-column grid.

import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { CapturedMarker } from '../types/marker';
import { MarkerGrid } from '../components/MarkerGrid';
import { MAX_CAPTURES } from '../constants/detection';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export default function ResultsScreen({ navigation, route }: Props) {
  const { markers } = route.params;

  const handleThumbnailPress = useCallback((marker: CapturedMarker) => {
    navigation.navigate('MarkerDetail', { marker });
  }, [navigation]);

  const handleScanAgain = useCallback(() => {
    navigation.replace('Camera');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marker Scan Results</Text>
        <Text style={styles.headerSubtitle}>
          {markers.length} / {MAX_CAPTURES} Captured
        </Text>
      </View>

      {/* Grid */}
      <View style={styles.gridContainer}>
        {markers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No markers captured</Text>
            <Text style={styles.emptyBody}>
              Go back and point your camera at a Marker 1 target.
            </Text>
          </View>
        ) : (
          <MarkerGrid markers={markers} onThumbnailPress={handleThumbnailPress} />
        )}
      </View>

      {/* Scan Again */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.scanAgainButton}
          onPress={handleScanAgain}
          activeOpacity={0.7}
          accessibilityLabel="Scan Again"
          accessibilityRole="button"
        >
          <Text style={styles.scanAgainText}>Scan Again</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  gridContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  emptyBody: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
  },
  scanAgainButton: {
    borderWidth: 1.5,
    borderColor: '#FFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scanAgainText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
