import { TileMap } from "@/components/TileMap";
import type { Coordinate } from "@/utils/location";
import type { StyleProp, ViewStyle } from "react-native";

// The web build draws the store map with the plain-JavaScript tile map.

type PickerProps = {
  coordinate: Coordinate;
  onChange: (coordinate: Coordinate) => void;
  style?: StyleProp<ViewStyle>;
};

export function StoreLocationPicker({ coordinate, onChange, style }: PickerProps) {
  return <TileMap coordinate={coordinate} onPress={onChange} style={style} />;
}

type MapProps = {
  coordinate: Coordinate;
  title?: string;
  approximate?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function StoreLocationMap({ coordinate, approximate, style }: MapProps) {
  return <TileMap coordinate={coordinate} approximate={approximate} style={style} />;
}
