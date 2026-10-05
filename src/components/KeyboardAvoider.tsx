/**
 * Keeps whatever is being typed into visible above the on-screen keyboard.
 *
 * The Android app runs edge-to-edge (android/gradle.properties), and in
 * that mode Android no longer shrinks the window when the keyboard opens —
 * the manifest's adjustResize does nothing. The app has to make room
 * itself, on both platforms, so this always uses "padding".
 *
 * It only pads by how far the keyboard actually overlaps this view, so a
 * nested one (or a window that did resize after all) adds nothing extra.
 *
 * Used once at the root (app/_layout.tsx), which covers every screen, and
 * inside each <Modal> that has a text box: a Modal is its own window, so the
 * root one can't reach it.
 */
import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, StyleSheet, type StyleProp, type ViewStyle } from "react-native";

export function KeyboardAvoider({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, style]}>
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
