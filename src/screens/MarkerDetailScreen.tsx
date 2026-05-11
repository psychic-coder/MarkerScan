// src/screens/MarkerDetailScreen.tsx
// Full-screen viewer for a single captured marker.

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { base64ToPngDataUri, formatCaptureTime } from '../utils/imageUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'MarkerDetail'>;

const DETAIL_IMAGE_SIZE = 300;

export default function MarkerDetailScreen({ navigation, route }: Props) {
  const { marker } = route.params;
  const uri = base64ToPngDataUri(marker.markerResult.extractedImageBase64);
  const timeStr = formatCaptureTime(marker.capturedAt);
  const rotation = marker.markerResult.orientationDegrees;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Marker #{marker.index}</Text>
        <View style={styles.backButton} /* spacer */ />
      </View>

      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri }}
          style={styles.markerImage}
          resizeMode="contain"
          accessibilityLabel={`Captured marker ${marker.index}`}
        />
      </View>

      {/* Metadata */}
      <View style={styles.metaContainer}>
        <MetaRow label="Captured at" value={timeStr} />
        <MetaRow label="Orientation corrected" value={`${rotation}° rotation applied`} />
        <MetaRow label="Confidence" value={`${(marker.markerResult.confidence * 100).toFixed(0)}%`} />
        <MetaRow label="Output size" value="300 × 300 px" />
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={metaStyles.row}>
      <Text style={metaStyles.label}>{label}</Text>
      <Text style={metaStyles.value}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 80,
  },
  backButtonText: {
    color: '#00FF88',
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  markerImage: {
    width: DETAIL_IMAGE_SIZE,
    height: DETAIL_IMAGE_SIZE,
    backgroundColor: '#111',
  },
  metaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 12,
  },
});

const metaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
    paddingBottom: 8,
  },
  label: {
    color: '#888',
    fontSize: 14,
  },
  value: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
