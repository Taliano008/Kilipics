/**
 * Full-screen photo viewer: opens at the photo that was tapped, swipe left
 * and right through the rest, close with ✕ or the back button. A photo with
 * a caption (e.g. the service it shows and its price) displays it along the
 * bottom.
 *
 * Mount it only while open, with a `key` that changes per opening (see
 * app/provider/[id].tsx) — the starting photo is read once, on mount.
 */
import type { GalleryCaption } from "@/types/catalog";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  photos: string[];
  // Same order as `photos`; undefined for a photo with no caption.
  captions?: (GalleryCaption | undefined)[];
  startIndex: number;
  onClose: () => void;
};

export function PhotoViewer({ photos, captions, startIndex, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const first = Math.min(Math.max(startIndex, 0), Math.max(photos.length - 1, 0));
  const [current, setCurrent] = useState(first);

  const caption = captions?.[current];

  const onSwipeEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrent(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <FlatList
          data={photos}
          keyExtractor={(uri, i) => `${i}-${uri}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={first}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onSwipeEnd}
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <Image source={{ uri: item }} style={StyleSheet.absoluteFill} contentFit="contain" />
            </View>
          )}
        />

        <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Text style={styles.counter}>
            {photos.length > 1 ? `${current + 1} / ${photos.length}` : ""}
          </Text>
          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </View>

        {caption?.title || caption?.price ? (
          <View
            style={[styles.captionBar, { paddingBottom: insets.bottom + 20 }]}
            pointerEvents="none"
          >
            {caption.title ? <Text style={styles.captionTitle}>{caption.title}</Text> : null}
            {caption.price ? <Text style={styles.captionPrice}>{caption.price}</Text> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  captionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    gap: 4,
  },
  captionTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  captionPrice: { color: "#F3C9B8", fontSize: 15, fontWeight: "600" },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
