/**
 * Header repeated identically across all 5 seller-dashboard mockups:
 * brand mark, business name + "Seller Mode" pill, per-tab subtitle,
 * "Consumer view" pill (opens the same preview-before-switching modal
 * every mockup shows), and an avatar.
 */
import { MaterialIcons } from "@expo/vector-icons";
import { useMerchantBusiness } from "@/merchant/business-context";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function DashboardHeader({ title }: { title: string }) {
  const router = useRouter();
  const { business } = useMerchantBusiness();
  const [previewOpen, setPreviewOpen] = useState(false);

  const businessName = business?.name || "My Business";
  const initials = businessName.slice(0, 2).toUpperCase();

  return (
    <SafeAreaView edges={["top"]} style={s.safe}>
      <View style={s.row}>
        <View style={s.left}>
          <View style={s.mark}>
            <Text style={s.markText}>K</Text>
          </View>
          <View style={s.nameCol}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>
                {businessName}
              </Text>
              <View style={s.sellerPill}>
                <Text style={s.sellerPillText}>Seller Mode</Text>
              </View>
            </View>
            <Text style={s.subtitle}>{title}</Text>
          </View>
        </View>
        <View style={s.right}>
          <Pressable style={s.consumerPill} onPress={() => setPreviewOpen(true)}>
            <Text style={s.consumerPillText}>Consumer view</Text>
            <MaterialIcons name="north-east" size={14} color={mc.onSecondaryContainer} />
          </Pressable>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      <Modal
        visible={previewOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View style={s.modalHeaderLeft}>
                <MaterialIcons name="visibility" size={22} color={mc.primary} />
                <Text style={s.modalTitle}>Client View Preview</Text>
              </View>
              <Pressable style={s.modalClose} onPress={() => setPreviewOpen(false)}>
                <MaterialIcons name="close" size={16} color={mc.onSurface} />
              </Pressable>
            </View>
            <Text style={s.modalBody}>
              Review how your storefront, service menu, and available booking slots appear to
              clients across Nairobi right now.
            </Text>
            <Pressable
              style={s.modalPrimary}
              onPress={() => {
                setPreviewOpen(false);
                router.push("/provider/me");
              }}
            >
              <Text style={s.modalPrimaryText}>Open Public Storefront</Text>
              <MaterialIcons name="open-in-new" size={16} color={mc.onPrimary} />
            </Pressable>
            <Pressable style={s.modalSecondary} onPress={() => setPreviewOpen(false)}>
              <Text style={s.modalSecondaryText}>Stay in Merchant Console</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { backgroundColor: mc.surface },
  row: {
    height: 64,
    paddingHorizontal: ms.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ms.sm,
    borderBottomWidth: 1,
    borderBottomColor: mc.outlineVariant,
  },
  left: { flexDirection: "row", alignItems: "center", gap: ms.sm, flex: 1, minWidth: 0 },
  mark: {
    width: 32,
    height: 32,
    borderRadius: mr.sm,
    backgroundColor: mc.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  markText: { color: mc.onPrimary, fontFamily: mf.extrabold, fontSize: 15 },
  nameCol: { minWidth: 0, flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontFamily: mf.bold, fontSize: 15, color: mc.onSurface, flexShrink: 1 },
  sellerPill: {
    backgroundColor: mc.primaryFixed,
    borderRadius: mr.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sellerPillText: { fontFamily: mf.bold, fontSize: 10, color: mc.onPrimaryFixed },
  subtitle: { fontFamily: mf.medium, fontSize: 11, color: mc.onSurfaceVariant, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: ms.xs, flexShrink: 0 },
  consumerPill: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: mr.full,
    backgroundColor: mc.secondaryContainer,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  consumerPillText: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSecondaryContainer },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mc.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: mf.bold, fontSize: 11, color: mc.onSecondaryContainer },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(30,27,24,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: mc.surfaceContainerLowest,
    borderTopLeftRadius: mr["2xl"],
    borderTopRightRadius: mr["2xl"],
    padding: ms.lg,
    gap: ms.md,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { fontFamily: mf.bold, fontSize: 17, color: mc.onSurface },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mc.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: { fontFamily: mf.regular, fontSize: 14, color: mc.onSurfaceVariant, lineHeight: 20 },
  modalPrimary: {
    minHeight: 48,
    borderRadius: mr.xl,
    backgroundColor: mc.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  modalPrimaryText: { fontFamily: mf.bold, fontSize: 15, color: mc.onPrimary },
  modalSecondary: {
    minHeight: 44,
    borderRadius: mr.xl,
    backgroundColor: mc.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSecondaryText: { fontFamily: mf.semibold, fontSize: 14, color: mc.onSurface },
});
