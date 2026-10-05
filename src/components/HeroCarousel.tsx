/**
 * The business page's hero: cycles through the storefront photos on its own,
 * can be swiped, and opens the tapped photo full screen. Auto-advance pauses
 * while the customer is swiping, resumes a moment after, and is off entirely
 * when the phone's "reduce motion" setting is on.
 */
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

const ADVANCE_MS = 4000;
// After a swipe, wait this long before auto-advancing again.
const RESUME_AFTER_SWIPE_MS = 6000;
const MAX_DOTS = 8;

type Props = {
  photos: string[];
  onPressPhoto: (index: number) => void;
  // Reports the photo on screen, e.g. for a "3 / 10" counter.
  onIndexChange?: (index: number) => void;
};

export function HeroCarousel({ photos, onPressPhoto, onIndexChange }: Props) {
  const listRef = useRef<FlatList<string>>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [pausedUntil, setPausedUntil] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (!cancelled) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const showIndex = (next: number) => {
    setIndex(next);
    onIndexChange?.(next);
  };

  // One timer per photo shown: advancing, swiping or resizing restarts it.
  useEffect(() => {
    if (photos.length < 2 || width === 0 || reduceMotion) return;
    const delay = Math.max(ADVANCE_MS, pausedUntil - Date.now());
    const timer = setTimeout(() => {
      const next = (index + 1) % photos.length;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
      onIndexChange?.(next);
    }, delay);
    return () => clearTimeout(timer);
  }, [index, photos.length, width, reduceMotion, pausedUntil, onIndexChange]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const onSwipeEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) showIndex(next);
  };

  // Long galleries get a compact sliding window of dots.
  const dotStart = Math.min(
    Math.max(0, index - Math.floor(MAX_DOTS / 2)),
    Math.max(0, photos.length - MAX_DOTS),
  );
  const dots = photos.slice(dotStart, dotStart + MAX_DOTS);

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScrollBeginDrag={() => setPausedUntil(Date.now() + RESUME_AFTER_SWIPE_MS)}
          onMomentumScrollEnd={onSwipeEnd}
          renderItem={({ item, index: i }) => (
            <Pressable
              style={{ width, height: "100%" }}
              onPress={() => onPressPhoto(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Photo ${i + 1} of ${photos.length}. Open full screen.`}
            >
              <Image
                source={{ uri: item }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                // Load the next photo early so the slide never shows a blank.
                priority={i <= index + 1 ? "high" : "low"}
              />
            </Pressable>
          )}
        />
      ) : null}

      {photos.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {dots.map((uri, i) => (
            <View
              key={`${dotStart + i}-${uri}`}
              style={[styles.dot, dotStart + i === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: "absolute",
    bottom: 18,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { width: 16, backgroundColor: "#FFFFFF" },
});
