/**
 * The store map, drawn by Leaflet (https://leafletjs.com) inside a WebView
 * over OpenStreetMap tiles: pinch-zoom, drag, and an optional draggable pin,
 * with no API key on Android or iOS.
 *
 * Leaflet is loaded from unpkg pinned to 1.9.4 with subresource-integrity
 * hashes, so the page refuses anything but that exact release. The map needs
 * the network for tiles anyway.
 *
 * Tile usage: tile.openstreetmap.org suits light use like this, but its
 * policy forbids heavy app traffic — before a large launch, point TILE_URL at
 * a hosted tile provider. https://operations.osmfoundation.org/policies/tiles/
 */
import type { Coordinate } from "@/utils/location";
import * as Linking from "expo-linking";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { WebView as WebViewType, WebViewMessageEvent } from "react-native-webview";

type WebViewModule = typeof import("react-native-webview");

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const APPROXIMATE_RADIUS_M = 150;

type Props = {
  coordinate: Coordinate;
  // Looked up from the address, not placed by the merchant: a shaded circle
  // around the pin shows the uncertainty.
  approximate?: boolean;
  // Merchant pin placement: tap the map or drag the pin. Without it the pin
  // is fixed.
  onPress?: (coordinate: Coordinate) => void;
  style?: StyleProp<ViewStyle>;
  // Supplied by StoreMap, which owns the guarded import.
  WebView: WebViewModule["WebView"];
};

// The whole Leaflet page. Values are injected as JSON, never as raw strings.
export function buildHtml({ coordinate, approximate, editable }: {
  coordinate: Coordinate;
  approximate: boolean;
  editable: boolean;
}) {
  const init = JSON.stringify({
    lat: coordinate.latitude,
    lng: coordinate.longitude,
    approximate,
    editable,
    radius: APPROXIMATE_RADIUS_M,
    tileUrl: TILE_URL,
  });
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>
  html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #ECE7DF; }
  .kp-pin { width: 34px; height: 34px; }
  .kp-pin svg { width: 34px; height: 34px; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
</style>
</head><body>
<div id="map"></div>
<script>
  var cfg = ${init};
  function post(msg) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  try {
    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([cfg.lat, cfg.lng], 16);
    L.tileLayer(cfg.tileUrl, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    var icon = L.divIcon({
      className: 'kp-pin', iconSize: [34, 34], iconAnchor: [17, 33],
      html: '<svg viewBox="0 0 24 24"><path fill="#BA482A" stroke="#fff" stroke-width="1.2" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#fff"/></svg>'
    });
    var marker = L.marker([cfg.lat, cfg.lng], { icon: icon, draggable: cfg.editable }).addTo(map);
    var circle = cfg.approximate
      ? L.circle([cfg.lat, cfg.lng], { radius: cfg.radius, color: '#BA482A', weight: 1.5, fillOpacity: 0.16 }).addTo(map)
      : null;

    // Called from React Native when the pin moves outside the map
    // ("Use my current location", a saved pin loading in).
    window.kpSetPin = function (lat, lng) {
      marker.setLatLng([lat, lng]);
      if (circle) { map.removeLayer(circle); circle = null; }
      map.setView([lat, lng], Math.max(map.getZoom(), 16));
    };

    if (cfg.editable) {
      map.on('click', function (e) {
        marker.setLatLng(e.latlng);
        post({ type: 'press', lat: e.latlng.lat, lng: e.latlng.lng });
      });
      marker.on('dragend', function () {
        var p = marker.getLatLng();
        post({ type: 'press', lat: p.lat, lng: p.lng });
      });
    }
    post({ type: 'ready' });
  } catch (err) {
    post({ type: 'error', message: String(err && err.message || err) });
  }
</script>
</body></html>`;
}

export function LeafletMap({ coordinate, approximate = false, onPress, style, WebView }: Props) {
  const webRef = useRef<WebViewType>(null);
  const editable = Boolean(onPress);
  // Built once per mount: later pin moves go through kpSetPin rather than
  // reloading the page (which would reset the merchant's zoom and position).
  const [html] = useState(() => buildHtml({ coordinate, approximate, editable }));
  const lastSent = useRef(coordinate);

  useEffect(() => {
    const prev = lastSent.current;
    if (prev.latitude === coordinate.latitude && prev.longitude === coordinate.longitude) return;
    lastSent.current = coordinate;
    webRef.current?.injectJavaScript(
      `window.kpSetPin && window.kpSetPin(${Number(coordinate.latitude)}, ${Number(coordinate.longitude)}); true;`,
    );
  }, [coordinate]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data) as { type: string; lat?: number; lng?: number };
      if (msg.type === "press" && onPress && typeof msg.lat === "number" && typeof msg.lng === "number") {
        const next = { latitude: msg.lat, longitude: msg.lng };
        // The page already moved its marker; don't echo it back.
        lastSent.current = next;
        onPress(next);
      }
    } catch {
      // Ignore anything that isn't one of our messages.
    }
  };

  return (
    <View style={[styles.root, style]}>
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={["*"]}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        // Let Leaflet own the gestures inside a scrolling page.
        nestedScrollEnabled
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        // Identifies the app to the OpenStreetMap tile servers, per their policy.
        applicationNameForUserAgent="KiliPicks/1.0"
        // Links tapped inside the map (the attribution) open in the phone's
        // browser instead of replacing the map.
        onShouldStartLoadWithRequest={(req) => {
          if (req.isTopFrame === false || !/^https?:/i.test(req.url)) return true;
          void Linking.openURL(req.url).catch(() => {});
          return false;
        }}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#ECE7DF" },
  web: { flex: 1, backgroundColor: "transparent" },
});
