/**
 * A small map drawn from OpenStreetMap image tiles — plain JavaScript, so it
 * works in every app build (no native map module, no API key). Drag to pan,
 * +/− to zoom, ◎ to recenter on the store. Used on web, and in app builds
 * made before react-native-webview was added (which can't run the Leaflet
 * map); see StoreMap.tsx.
 *
 * Tile usage: tile.openstreetmap.org is fine for light, cached use like this
 * (expo-image caches tiles on disk) but its policy forbids heavy app traffic.
 * Before large-scale launch, point TILE_URL at a hosted tile provider.
 * https://operations.osmfoundation.org/policies/tiles/
 */
import { Feather, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { Coordinate } from "@/utils/location";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_HEADERS = { "User-Agent": "KiliPicks/1.0 (com.kilimax.kilipicks)" };
const TILE = 256;
const MIN_ZOOM = 11;
const MAX_ZOOM = 18;
const TAP_SLOP = 6;

type Point = { x: number; y: number };

// Web Mercator: coordinate ↔ world pixel at a zoom level.
function project({ latitude, longitude }: Coordinate, zoom: number): Point {
  const size = TILE * 2 ** zoom;
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function unproject({ x, y }: Point, zoom: number): Coordinate {
  const size = TILE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / size;
  return {
    latitude: (180 / Math.PI) * Math.atan(Math.sinh(n)),
    longitude: (x / size) * 360 - 180,
  };
}

type Props = {
  coordinate: Coordinate;
  // Draw a soft circle instead of a sharp pin: the location is only
  // approximate (looked up from the address).
  approximate?: boolean;
  // Tap-to-place: called with the tapped spot. Without it, taps do nothing.
  onPress?: (coordinate: Coordinate) => void;
  initialZoom?: number;
  style?: StyleProp<ViewStyle>;
};

export function TileMap({
  coordinate,
  approximate = false,
  onPress,
  initialZoom = 16,
  style,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(initialZoom);
  const [center, setCenter] = useState<Point>(() =>
    project(coordinate, initialZoom),
  );

  // The PanResponder is created once; it reads current values through this.
  const live = useRef({ center, zoom, size, onPress });
  useEffect(() => {
    live.current = { center, zoom, size, onPress };
  });
  const dragStart = useRef<Point>({ x: 0, y: 0 });

  // Recenter when the store's coordinate itself changes (e.g. a new pin).
  useEffect(() => {
    setCenter(project(coordinate, live.current.zoom));
  }, [coordinate]);

  // The refs are only read inside the gesture callbacks, never during render;
  // the compiler can't see that through PanResponder.create.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the gesture once it starts, so a parent ScrollView doesn't
      // take over halfway through a drag.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragStart.current = live.current.center;
      },
      onPanResponderMove: (_, g) => {
        setCenter({
          x: dragStart.current.x - g.dx,
          y: dragStart.current.y - g.dy,
        });
      },
      onPanResponderRelease: (evt, g) => {
        const { onPress: press, size: s, zoom: z } = live.current;
        if (!press || Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP)
          return;
        const { locationX, locationY } = evt.nativeEvent;
        const start = dragStart.current;
        press(
          unproject(
            {
              x: start.x + locationX - s.width / 2,
              y: start.y + locationY - s.height / 2,
            },
            z,
          ),
        );
      },
    }),
  );

  const changeZoom = (delta: number) => {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
    if (next === zoom) return;
    const scale = 2 ** (next - zoom);
    setCenter({ x: center.x * scale, y: center.y * scale });
    setZoom(next);
  };

  const recenter = () => setCenter(project(coordinate, zoom));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  // Tiles covering the visible area.
  const left = center.x - size.width / 2;
  const top = center.y - size.height / 2;
  const tilesPerSide = 2 ** zoom;
  const tiles: { key: string; uri: string; x: number; y: number }[] = [];
  if (size.width > 0) {
    for (
      let ty = Math.floor(top / TILE);
      ty <= Math.floor((top + size.height) / TILE);
      ty++
    ) {
      if (ty < 0 || ty >= tilesPerSide) continue;
      for (
        let tx = Math.floor(left / TILE);
        tx <= Math.floor((left + size.width) / TILE);
        tx++
      ) {
        const wrapped = ((tx % tilesPerSide) + tilesPerSide) % tilesPerSide;
        tiles.push({
          key: `${zoom}/${tx}/${ty}`,
          uri: TILE_URL.replace("{z}", String(zoom))
            .replace("{x}", String(wrapped))
            .replace("{y}", String(ty)),
          x: tx * TILE - left,
          y: ty * TILE - top,
        });
      }
    }
  }

  const pin = project(coordinate, zoom);
  const pinX = pin.x - left;
  const pinY = pin.y - top;
  // ~150 m around an address match: honest about the uncertainty.
  const metersPerPixel =
    (156543.03 * Math.cos((coordinate.latitude * Math.PI) / 180)) / 2 ** zoom;
  const radius = Math.max(18, 150 / metersPerPixel);

  return (
    <View style={[styles.root, style]} onLayout={onLayout}>
      <View style={StyleSheet.absoluteFill} {...responder.panHandlers}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {tiles.map((t) => (
            <Image
              key={t.key}
              source={{ uri: t.uri, headers: TILE_HEADERS }}
              style={[styles.tile, { left: t.x, top: t.y }]}
              cachePolicy="memory-disk"
              transition={120}
            />
          ))}
          {approximate ? (
            <View
              style={[
                styles.approxCircle,
                {
                  left: pinX - radius,
                  top: pinY - radius,
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: radius,
                },
              ]}
            />
          ) : null}
          <View style={[styles.pin, { left: pinX - 18, top: pinY - 34 }]}>
            <Ionicons name="location" size={36} color="#BA482A" />
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={styles.control}
          onPress={() => changeZoom(1)}
          accessibilityLabel="Zoom in"
        >
          <Feather name="plus" size={16} color="#1C1A17" />
        </Pressable>
        <Pressable
          style={styles.control}
          onPress={() => changeZoom(-1)}
          accessibilityLabel="Zoom out"
        >
          <Feather name="minus" size={16} color="#1C1A17" />
        </Pressable>
        <Pressable
          style={styles.control}
          onPress={recenter}
          accessibilityLabel="Recenter on the store"
        >
          <Feather name="crosshair" size={15} color="#1C1A17" />
        </Pressable>
      </View>

      <Pressable
        style={styles.attribution}
        onPress={() =>
          void Linking.openURL("https://www.openstreetmap.org/copyright").catch(
            () => {},
          )
        }
      >
        <Text style={styles.attributionText}>© OpenStreetMap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#ECE7DF",
  },
  tile: { position: "absolute", width: TILE, height: TILE },
  approxCircle: {
    position: "absolute",
    backgroundColor: "rgba(186,72,42,0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(186,72,42,0.55)",
  },
  pin: { position: "absolute", width: 36, height: 36 },
  // Below a top-right corner button (the page's full-screen toggle) and
  // clear of bottom-corner overlays (step 2's "Use my current location").
  controls: { position: "absolute", right: 10, top: 54, gap: 6 },
  control: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    boxShadow: "0px 2px 6px rgba(0,0,0,0.18)",
  },
  attribution: {
    position: "absolute",
    left: 0,
    bottom: 0,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderTopRightRadius: 6,
  },
  attributionText: { fontSize: 10, color: "#3E3A36" },
});
