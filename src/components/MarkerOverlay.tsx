
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import {
  Canvas,
  Path,
  Skia,
  BlurMask,
  Group,
  Paint,
} from '@shopify/react-native-skia';
import type { Point } from '../types/marker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarkerOverlayProps {
  /** Width of the overlay (matches camera view width) */
  width: number;
  /** Height of the overlay (matches camera view height) */
  height: number;
  /** Detected marker corner points in frame coordinates; null when none */
  detectedCorners: Point[] | null;
  /** When true, plays the capture flash animation */
  showFlash: boolean;
  /** Called when the flash animation completes */
  onFlashComplete: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OVERLAY_GREEN = '#00FF88';
const FLASH_WHITE = 'rgba(255,255,255,0.55)';
const STROKE_WIDTH = 3;
const CORNER_LENGTH = 20;
const ANIMATION_DURATION_MS = 300;

// ─── Helper: build quad path from corners ─────────────────────────────────────

function buildQuadPath(corners: Point[]): ReturnType<typeof Skia.Path.Make> {
  const [tl, tr, br, bl] = corners;
  const path = Skia.Path.Make();
  path.moveTo(tl.x, tl.y);
  path.lineTo(tr.x, tr.y);
  path.lineTo(br.x, br.y);
  path.lineTo(bl.x, bl.y);
  path.close();
  return path;
}

function buildCornerPath(corners: Point[]): ReturnType<typeof Skia.Path.Make> {
  const [tl, tr, br, bl] = corners;
  const path = Skia.Path.Make();
  const L = CORNER_LENGTH;
  const pts = [
    { p: tl, dx: 1,  dy: 1  },
    { p: tr, dx: -1, dy: 1  },
    { p: br, dx: -1, dy: -1 },
    { p: bl, dx: 1,  dy: -1 },
  ];
  for (const { p, dx, dy } of pts) {
    path.moveTo(p.x + dx * L, p.y);
    path.lineTo(p.x, p.y);
    path.lineTo(p.x, p.y + dy * L);
  }
  return path;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const MarkerOverlay = React.memo<MarkerOverlayProps>(({
  width,
  height,
  detectedCorners,
  showFlash,
  onFlashComplete,
}) => {
  // React Native Animated values — no Reanimated or Skia animation hooks needed
  const quadOpacity = useRef(new Animated.Value(0)).current;
  const flashAlpha  = useRef(new Animated.Value(0)).current;

  // Keep callback ref stable to avoid stale closures
  const onFlashCompleteRef = useRef(onFlashComplete);
  useEffect(() => { onFlashCompleteRef.current = onFlashComplete; }, [onFlashComplete]);

  // Fade quad in/out when corners change
  useEffect(() => {
    const target = (detectedCorners && detectedCorners.length === 4) ? 1 : 0;
    Animated.timing(quadOpacity, {
      toValue: target,
      duration: ANIMATION_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [detectedCorners, quadOpacity]);

  // Flash animation: 0 → 1 → 0
  useEffect(() => {
    if (!showFlash) { return; }
    Animated.sequence([
      Animated.timing(flashAlpha, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(flashAlpha, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onFlashCompleteRef.current());
  }, [showFlash, flashAlpha]);

  // Build paths (eagerly, not lazily — Skia v1.12 requires plain values in Canvas)
  const hasCorners = detectedCorners && detectedCorners.length === 4;
  const quadPath   = hasCorners ? buildQuadPath(detectedCorners!) : Skia.Path.Make();
  const cornerPath = hasCorners ? buildCornerPath(detectedCorners!) : Skia.Path.Make();
  const flashRect  = Skia.Path.Make();
  flashRect.addRect(Skia.XYWHRect(0, 0, width, height));

  return (
    <>
      {/* Detection overlay */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0, width, height,
          opacity: quadOpacity,
        }}
        pointerEvents="none"
      >
        <Canvas style={{ flex: 1 }}>
          <Path
            path={quadPath}
            color="transparent"
            style="stroke"
            strokeWidth={STROKE_WIDTH}
          >
            <Paint color={OVERLAY_GREEN} strokeWidth={STROKE_WIDTH} style="stroke" />
            <BlurMask blur={2} style="outer" respectCTM />
          </Path>
          <Path
            path={cornerPath}
            color={OVERLAY_GREEN}
            style="stroke"
            strokeWidth={STROKE_WIDTH + 1}
            strokeCap="round"
          />
        </Canvas>
      </Animated.View>

      {/* Capture flash */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0, width, height,
          opacity: flashAlpha,
        }}
        pointerEvents="none"
      >
        <Canvas style={{ flex: 1 }}>
          <Path path={flashRect} color={FLASH_WHITE} style="fill" />
        </Canvas>
      </Animated.View>
    </>
  );
});

MarkerOverlay.displayName = 'MarkerOverlay';



