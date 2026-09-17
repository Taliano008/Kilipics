/**
 * Seller dashboard — Looks tab.
 * Matches: Inspo/code merchant looks visual portfolio growth.html
 *
 * No backend exists for Looks at all yet (no routes, table unused) — this
 * whole tab is illustrative mock content, local component state only (see
 * the plan: nothing here is ever actually persisted since Boost and Create
 * are both stubbed). Boost's CTA reads "Coming soon" rather than the
 * mockup's simulated M-Pesa charge, per merchant_prd.md §5.3.2 and the
 * project's standing "no fake success states" rule.
 */
import { DashboardHeader } from "@/components/merchant/DashboardHeader";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Look = {
  id: string;
  name: string;
  category: string;
  price: number;
  status: "published" | "draft";
  views: number;
  bookings: number;
  imageUrl: string;
};

const MOCK_LOOKS: Look[] = [
  {
    id: "1",
    name: "Knotless Braids",
    category: "Braids",
    price: 3500,
    status: "published",
    views: 428,
    bookings: 14,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBX5wdbF-9BlnyWxAVn_oMLglLZ4EPNpwoMitRe1ZbNZGg6waiGlSkf_ZecG5xxGDLetGIEoJPAZlr1Bfj_eyO4QM6jb0e73VGt_BzAZEWh3hWB_P9P8K7uTPW5XOyOE-ENeLM80GUJm2OfpunIoXv4kwMeRoODgvs7SoEifDHss3aa5cVoj9780OJ4WuuNtAOm9oW_vZFY-C0DrqiKF-DP8Dawu5-E-4Q1IH2BFrQ1kiNH4tlZJHlP",
  },
  {
    id: "2",
    name: "Gel French Tips",
    category: "Nails",
    price: 1800,
    status: "published",
    views: 290,
    bookings: 9,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCAA0Ozjyg_F3j50SV5VSGj1cQMMXm0-WWAPTsrxl3wrAHSNC2Sw3pTuq9FsGtw7rwfQ1NyMpvMP7u5ch-1eUzmBO6B6Nq6AhaqNtpEp5u5HHbwbOMknfMfNCmeweAnLPREY84pBiHAX1mA7rxUzgqFnZ50cTAMrpTnzlYsT8ssWak4Y6L5PSZa3BrEwjznFqXnvSUU7gPGDH-bWBefkmr81hUGvVXp98G9SEMGhLDmZ1IK6YYfeTRP",
  },
  {
    id: "3",
    name: "HydraFacial Glow",
    category: "Skin",
    price: 4200,
    status: "published",
    views: 185,
    bookings: 6,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCuyvfx-UYtULWTYp1eklrGynaTq-xUiblNxkJgOHjmZH7-1jyCIW_byXS2BqQMtYk4iXw1RcRUkNAOvg32uPOgfJ0VQRNrasWapzpQUseiDX7Hn_Po4D1WW0Ibd7eVmP6PiMr4DNjYKz2CcqTVQ5m9MSR-LimqcVY38uV1JcRH2GANPlSv8F34pWDT_Dt0yV5LNFpne6FdTBxuJU8ociflS5soHlPf4IFElyrawQZclm4cI7bOPy0A",
  },
  {
    id: "4",
    name: "Silk Press & Trim",
    category: "Hair Styling",
    price: 2800,
    status: "draft",
    views: 0,
    bookings: 0,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBbx59-SQPjrMdOxbRRlP01Id90J79PQ9cls7KZWfByRW3tOI2QX5-Qw1AMXC1hZULBVqkQv3gdbjbIiWGjZ-4ha-oAPFHLPRolOe6UEjoB9_aqHpwtYsfxB9XSUKzfcW3RRDacGxNXy_DHh-KZlwwK7E-ShqvlfMGSYPQG5xVyB8xhDxR3k4royMp4bfFtNR6MXr33uaDvh0TA5_klRhygI9x3WvjKDuRUmBRkB_l2fdPizTz-A2jz",
  },
];

export default function LooksScreen() {
  const [looks] = useState(MOCK_LOOKS);
  const [filter, setFilter] = useState<string>("All");
  const [boostFor, setBoostFor] = useState<Look | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const categories = ["All", ...Array.from(new Set(looks.map((l) => l.category)))];
  const filtered = filter === "All" ? looks : looks.filter((l) => l.category === filter);
  const publishedCount = looks.filter((l) => l.status === "published").length;

  return (
    <View style={{ flex: 1, backgroundColor: mc.surface }}>
      <DashboardHeader title="Looks" />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.headRow}>
            <Text style={s.headTitle}>Your Looks</Text>
            <View style={s.livePill}>
              <View style={s.liveDot} />
              <Text style={s.livePillText}>Storefront Live</Text>
            </View>
          </View>
          <Text style={s.headSub}>
            Show customers what you do best. Visual posts that link directly to bookable
            services.
          </Text>

          <View style={s.statsBar}>
            <View style={s.statCol}>
              <Text style={s.statValue}>{publishedCount}</Text>
              <Text style={s.statLabel}>PUBLISHED</Text>
            </View>
            <View style={s.statCol}>
              <Text style={[s.statValue, { color: mc.onSurface }]}>
                {looks.reduce((sum, l) => sum + l.views, 0).toLocaleString()}
              </Text>
              <Text style={s.statLabel}>PROFILE VIEWS</Text>
            </View>
            <View style={s.statCol}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={[s.statValue, { color: mc.tertiary }]}>
                  {looks.reduce((sum, l) => sum + l.bookings, 0)}
                </Text>
                <MaterialIcons name="trending-up" size={16} color={mc.tertiary} />
              </View>
              <Text style={s.statLabel}>BOOKINGS</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
            {categories.map((cat) => {
              const active = filter === cat;
              const count = cat === "All" ? looks.length : looks.filter((l) => l.category === cat).length;
              return (
                <Pressable
                  key={cat}
                  style={[s.filterPill, active && s.filterPillActive]}
                  onPress={() => setFilter(cat)}
                >
                  <Text style={[s.filterPillText, active && s.filterPillTextActive]}>
                    {cat} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={s.grid}>
            {filtered.map((look) => (
              <View key={look.id} style={s.card}>
                <View style={s.imageWrap}>
                  <Image source={{ uri: look.imageUrl }} style={s.image} />
                  <View style={s.categoryBadge}>
                    <Text style={s.categoryBadgeText}>{look.category}</Text>
                  </View>
                  <View style={[s.statusBadge, look.status === "draft" && s.statusBadgeDraft]}>
                    <Text style={s.statusBadgeText}>
                      {look.status === "published" ? "Published" : "Draft"}
                    </Text>
                    <MaterialIcons
                      name={look.status === "published" ? "check" : "edit"}
                      size={11}
                      color={mc.onTertiary}
                    />
                  </View>
                  {look.status === "published" && (
                    <View style={s.statOverlay}>
                      <View style={s.statOverlayItem}>
                        <MaterialIcons name="visibility" size={13} color="#fff" />
                        <Text style={s.statOverlayText}>{look.views}</Text>
                      </View>
                      <View style={s.statOverlayItem}>
                        <MaterialIcons name="event-available" size={13} color={mc.tertiaryFixedDim} />
                        <Text style={[s.statOverlayText, { color: mc.tertiaryFixedDim, fontFamily: mf.bold }]}>
                          {look.bookings} bookings
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
                <View style={s.cardBody}>
                  <Text style={s.cardName} numberOfLines={1}>
                    {look.name}
                  </Text>
                  <Text style={s.cardPrice}>KES {look.price.toLocaleString()}</Text>
                  {look.status === "published" ? (
                    <View style={s.cardActions}>
                      <Pressable style={s.boostBtn} onPress={() => setBoostFor(look)}>
                        <MaterialIcons name="bolt" size={14} color={mc.primary} />
                        <Text style={s.boostBtnText}>Boost</Text>
                      </Pressable>
                      <Pressable style={s.moreBtn}>
                        <MaterialIcons name="more-horiz" size={16} color={mc.onSurfaceVariant} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={s.publishBtn} onPress={() => setCreateOpen(true)}>
                      <MaterialIcons name="publish" size={14} color={mc.onSecondaryFixed} />
                      <Text style={s.publishBtnText}>Edit & Publish</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View style={s.tipCard}>
            <View style={s.tipIcon}>
              <MaterialIcons name="lightbulb" size={18} color={mc.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tipTitle}>Pro Growth Tip</Text>
              <Text style={s.tipBody}>
                Looks with linked services tend to get more appointments. Keep your portfolio
                tagged so customers can book straight from your feed.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={s.fabWrap}>
          <Pressable style={s.fab} onPress={() => setCreateOpen(true)}>
            <MaterialIcons name="add-a-photo" size={20} color={mc.onPrimary} />
            <Text style={s.fabText}>Create Look</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ComingSoonSheet
        visible={boostFor !== null}
        icon="electric-bolt"
        title="Boost Look Visibility"
        body={
          boostFor
            ? `Featuring "${boostFor.name}" to more local clients is launching soon.`
            : ""
        }
        onClose={() => setBoostFor(null)}
      />
      <ComingSoonSheet
        visible={createOpen}
        icon="add-a-photo"
        title="Create Look"
        body="Uploading and publishing new looks is launching soon — for now, add photos to your Studio Gallery from the Profile tab."
        onClose={() => setCreateOpen(false)}
      />
    </View>
  );
}

function ComingSoonSheet({
  visible,
  icon,
  title,
  body,
  onClose,
}: {
  visible: boolean;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  body: string;
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={s.sheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={s.sheetCard}>
        <View style={s.sheetHandle} />
        <View style={s.sheetHeaderRow}>
          <View style={s.sheetIcon}>
            <MaterialIcons name={icon} size={24} color={mc.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Text style={s.sheetBody}>{body}</Text>
          </View>
        </View>
        <Pressable style={s.sheetClose} onPress={onClose}>
          <Text style={s.sheetCloseText}>Got it</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: ms.md, gap: ms.sm, paddingBottom: 110 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headTitle: { fontFamily: mf.extrabold, fontSize: 24, color: mc.onSurface },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: `${mc.tertiary}1A`,
    borderRadius: mr.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: mc.tertiary },
  livePillText: { fontFamily: mf.semibold, fontSize: 11, color: mc.tertiary },
  headSub: { fontFamily: mf.regular, fontSize: 13, color: mc.onSurfaceVariant, lineHeight: 18 },

  statsBar: {
    flexDirection: "row",
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.xl,
    padding: ms.sm,
  },
  statCol: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: mf.bold, fontSize: 18, color: mc.primary },
  statLabel: { fontFamily: mf.semibold, fontSize: 9, color: mc.onSurfaceVariant, letterSpacing: 0.4, marginTop: 2 },

  pillRow: { gap: 8, paddingVertical: 2 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: mr.full, backgroundColor: mc.surfaceContainer },
  filterPillActive: { backgroundColor: mc.onSurface },
  filterPillText: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSurfaceVariant },
  filterPillTextActive: { color: mc.surface },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47%",
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr.xl,
    overflow: "hidden",
  },
  imageWrap: { aspectRatio: 4 / 5, backgroundColor: mc.surfaceContainer, position: "relative" },
  image: { width: "100%", height: "100%" },
  categoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: mr.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryBadgeText: { fontFamily: mf.semibold, fontSize: 10, color: mc.onSurface },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: mc.tertiaryContainer,
    borderRadius: mr.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeDraft: { backgroundColor: mc.secondaryContainer },
  statusBadgeText: { fontFamily: mf.semibold, fontSize: 10, color: mc.onTertiary },
  statOverlay: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statOverlayItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  statOverlayText: { color: "#fff", fontFamily: mf.medium, fontSize: 10 },

  cardBody: { padding: 10, gap: 4 },
  cardName: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  cardPrice: { fontFamily: mf.bold, fontSize: 13, color: mc.primary },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  boostBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: mr.lg,
    backgroundColor: mc.primaryFixed,
  },
  boostBtnText: { fontFamily: mf.semibold, fontSize: 11, color: mc.onPrimaryFixed },
  moreBtn: {
    width: 30,
    height: 30,
    borderRadius: mr.lg,
    backgroundColor: mc.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  publishBtn: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 7,
    borderRadius: mr.lg,
    backgroundColor: mc.secondaryFixed,
  },
  publishBtnText: { fontFamily: mf.semibold, fontSize: 11, color: mc.onSecondaryFixed },

  tipCard: {
    flexDirection: "row",
    gap: ms.sm,
    backgroundColor: `${mc.primaryFixed}80`,
    borderRadius: mr.xl,
    padding: ms.sm,
    marginTop: 4,
  },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: mr.md,
    backgroundColor: mc.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: { fontFamily: mf.semibold, fontSize: 13, color: mc.onPrimaryFixed },
  tipBody: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant, lineHeight: 17, marginTop: 2 },

  fabWrap: { position: "absolute", right: ms.md, bottom: ms.md },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 52,
    paddingHorizontal: 18,
    borderRadius: mr.full,
    backgroundColor: mc.primary,
    shadowColor: mc.primary,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabText: { fontFamily: mf.bold, fontSize: 14, color: mc.onPrimary },

  sheetBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    backgroundColor: mc.surface,
    borderTopLeftRadius: mr["2xl"],
    borderTopRightRadius: mr["2xl"],
    padding: ms.lg,
    gap: ms.md,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: mc.outlineVariant,
    alignSelf: "center",
  },
  sheetHeaderRow: { flexDirection: "row", gap: ms.sm, alignItems: "flex-start" },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: mr.lg,
    backgroundColor: mc.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontFamily: mf.bold, fontSize: 17, color: mc.onSurface },
  sheetBody: { fontFamily: mf.regular, fontSize: 13, color: mc.onSurfaceVariant, marginTop: 2, lineHeight: 19 },
  sheetClose: {
    height: 48,
    borderRadius: mr.lg,
    backgroundColor: mc.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseText: { fontFamily: mf.semibold, fontSize: 14, color: mc.onSurface },
});
