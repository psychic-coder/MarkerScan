// src/screens/CameraScreen.tsx
// Main scanning screen: full-screen camera + Skia overlay + capture HUD.

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { MarkerResult, Point } from '../types/marker';
import { MarkerOverlay } from '../components/MarkerOverlay';
import { useMarkerDetection } from '../hooks/useMarkerDetection';
import { useMarkerCollection } from '../hooks/useMarkerCollection';
import { DETECTION, MAX_CAPTURES } from '../constants/detection';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Component ────────────────────────────────────────────────────────────────

export default function CameraScreen({ navigation, route }: Props) {
  // Access pre-existing collection if coming back (Scan Again)
  const collection = useMarkerCollection();

  // Camera state
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    {
      videoResolution: {
        width: DETECTION.CAMERA_TARGET_WIDTH,
        height: DETECTION.CAMERA_TARGET_HEIGHT,
      },
    },
  ]);

  // Detection overlay state
  const [detectedCorners, setDetectedCorners] = useState<Point[] | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const detectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Permission handling ────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().then(granted => {
        if (!granted) {
          Alert.alert(
            'Camera Permission Required',
            'MarkerScan needs access to the camera to detect markers. Please enable it in Settings.',
            [{ text: 'OK' }],
          );
        }
      });
    }
  }, [hasPermission, requestPermission]);

  // ── Navigate to results when full ─────────────────────────────────────────

  useEffect(() => {
    if (collection.isFull) {
      navigation.replace('Results', { markers: collection.markers });
    }
  }, [collection.isFull, collection.markers, navigation]);

  // ── Detection callbacks ────────────────────────────────────────────────────

  const handleMarkersDetected = useCallback((markers: MarkerResult[]) => {
    if (markers.length === 0) return;

    const best = markers[0]; // Use the highest-confidence result
    setDetectedCorners(best.corners);
    setIsDetecting(true);

    // Clear the "no marker" timeout if it was pending
    if (detectionTimeout.current) {
      clearTimeout(detectionTimeout.current);
      detectionTimeout.current = null;
    }

    // Attempt to capture
    const added = collection.addMarker(best);
    if (added) {
      // Haptic + flash feedback
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      setShowFlash(true);
    }
  }, [collection]);

  const handleNoMarkers = useCallback(() => {
    // Fade out the overlay after a short delay (prevents flicker)
    if (!detectionTimeout.current) {
      detectionTimeout.current = setTimeout(() => {
        setDetectedCorners(null);
        setIsDetecting(false);
        detectionTimeout.current = null;
      }, 500);
    }
  }, []);

  const frameProcessor = useMarkerDetection({
    onMarkersDetected: handleMarkersDetected,
    onNoMarkers: handleNoMarkers,
  });

  // ── Cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (detectionTimeout.current) clearTimeout(detectionTimeout.current);
    };
  }, []);

  // ── Render: no permission ──────────────────────────────────────────────────

  if (!hasPermission) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionBody}>
          MarkerScan requires camera access to detect markers.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => requestPermission()}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: no camera device ───────────────────────────────────────────────

  if (!device) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>No camera found on this device.</Text>
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Camera feed */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        format={format}
        isActive
        frameProcessor={frameProcessor}
        photo={false}
        video={false}
        audio={false}
        pixelFormat="yuv"
        enableZoomGesture
      />

      {/* Skia detection overlay */}
      <MarkerOverlay
        width={SCREEN_W}
        height={SCREEN_H}
        detectedCorners={detectedCorners}
        showFlash={showFlash}
        onFlashComplete={() => setShowFlash(false)}
      />

      {/* Top HUD: Done button */}
      <View style={styles.topHud}>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.replace('Results', { markers: collection.markers })}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom HUD: status + count */}
      <View style={styles.bottomHud}>
        <View style={styles.statusPill}>
          <View
            style={[
              styles.statusDot,
              isDetecting ? styles.statusDotActive : styles.statusDotIdle,
            ]}
          />
          <Text style={styles.statusText}>
            {isDetecting ? 'Marker Detected!' : 'Scanning...'}
          </Text>
          <Text style={styles.countText}>
            {collection.count} / {MAX_CAPTURES}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionBody: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  permissionButton: {
    borderColor: '#00FF88',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  permissionButtonText: {
    color: '#00FF88',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
  },
  topHud: {
    position: 'absolute',
    top: 48,
    right: 20,
  },
  doneButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  bottomHud: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#00FF88',
  },
  statusDotIdle: {
    backgroundColor: '#888',
  },
  statusText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
  },
  countText: {
    color: '#00FF88',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
});
