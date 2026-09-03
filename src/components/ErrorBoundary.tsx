import { report } from "@/observability/report";
import { colors, radii, spacing } from "@/theme/tokens";
import { Component, type ErrorInfo, type PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type State = { hasError: boolean };

// Error boundaries must be class components — there is no hook equivalent.
export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    report(error, { componentStack: info.componentStack, scope: "root_error_boundary" });
  }

  retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.copy}>KiliPicks hit an unexpected error. Please try again.</Text>
        <Pressable style={styles.button} onPress={this.retry}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.cream },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700", textAlign: "center" },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  button: { backgroundColor: colors.brand, borderRadius: radii.pill, paddingHorizontal: 22, paddingVertical: 13 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: "700" },
});
