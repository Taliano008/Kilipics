import { LeafletMap } from "@/components/LeafletMap";
import { TileMap } from "@/components/TileMap";
import type { Coordinate } from "@/utils/location";
import { TurboModuleRegistry, type StyleProp, type ViewStyle } from "react-native";

type WebViewModule = typeof import("react-native-webview");

// Maps are drawn by Leaflet inside a WebView (LeafletMap). react-native-webview
// looks up its native module the moment it's imported and throws if it's
// missing — which it is in any app binary built before it was added — so load
// it only when the native side is there, and otherwise use TileMap, the
// plain-JavaScript map that works in every build.
function loadWebView(): WebViewModule | null {
  try {
    if (!TurboModuleRegistry.get("RNCWebViewModule")) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-webview") as WebViewModule;
  } catch {
    return null;
  }
}

const webView = loadWebView();

type PickerProps = {
  coordinate: Coordinate;
  onChange: (coordinate: Coordinate) => void;
  style?: StyleProp<ViewStyle>;
};

// Merchant-facing: tap the map or drag the pin onto the store.
export function StoreLocationPicker({ coordinate, onChange, style }: PickerProps) {
  if (!webView) return <TileMap coordinate={coordinate} onPress={onChange} style={style} />;
  return <LeafletMap WebView={webView.WebView} coordinate={coordinate} onPress={onChange} style={style} />;
}

type MapProps = {
  coordinate: Coordinate;
  title?: string;
  // Looked up from the address rather than placed by the merchant: shown
  // with a shaded circle around the pin.
  approximate?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Customer-facing: where the store is. Pinch to zoom, drag to look around.
export function StoreLocationMap({ coordinate, approximate = false, style }: MapProps) {
  if (!webView) return <TileMap coordinate={coordinate} approximate={approximate} style={style} />;
  return (
    <LeafletMap WebView={webView.WebView} coordinate={coordinate} approximate={approximate} style={style} />
  );
}
