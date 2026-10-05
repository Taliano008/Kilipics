/**
 * Profile tab — "Store visits" card.
 * Matches: Inspo/StoreVisitsCard.dc.html (states: data, no comparison yet,
 * no visits yet, not live, loading, error; collapsible).
 *
 * Counts only, never who visited: the backend aggregates the anonymous
 * analytics events for this business (GET /api/merchant/insights/visits).
 * The merchant's own phone is excluded so checking their listing doesn't
 * pad the numbers.
 */
import { analyticsDeviceId } from "@/analytics/events";
import { useAuth } from "@/auth/auth-context";
import { fetchStoreVisits, type StoreVisits, type StoreVisitsRange } from "@/api/merchant";
import { report } from "@/observability/report";
import { mf } from "@/theme/merchant";
import { neu, neuAccent } from "@/theme/neumorphism";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Animated, Pressable, Share, StyleSheet, Text, View } from "react-native";

// Palette from the Inspo design.
const C = {
  ink: "#1F1A17",
  body: "#3A332F",
  muted: "#6B625C",
  faint: "#7D746E",
  brand: "#B33A0F",
  brandTint: "#FDE3DA",
  track: "#ECE7E3",
  skeleton: "#F1ECE8",
  divider: "#EFE8E3",
  note: "#FBF6F2",
  iconMuted: "#8A817B",
  upBg: "#E2F1E9",
  upFg: "#0E7A4F",
  downBg: "#F6E7E2",
  downFg: "#8E3F2E",
};

const RANGES: { key: StoreVisitsRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const COMPARE_CAPTION: Record<StoreVisitsRange, string> = {
  today: "vs this time yesterday",
  week: "vs same days last week",
  month: "vs same days last month",
};

const NO_COMPARE: Record<StoreVisitsRange, string> = {
  today: "Comparison appears from tomorrow",
  week: "Comparison appears after your first full week",
  month: "Comparison appears after your first full month",
};

// Bar look per range, as in the design: chunky for 3 dayparts, 22px for
// weekdays, thin for a month of days.
const BARS: Record<StoreVisitsRange, { gap: number; width: number | "100%"; radius: number }> = {
  today: { gap: 14, width: "100%", radius: 12 },
  week: { gap: 10, width: 22, radius: 8 },
  month: { gap: 3, width: "100%", radius: 3 },
};
const BAR_MAX = 74;
const COLLAPSED_KEY = "kilipicks.merchant.storeVisits.collapsed";

type Props = {
  businessId: string;
  businessName: string;
  live: boolean;
  activeToken: string | null;
  // Bumped by the Profile's pull-to-refresh.
  refreshKey?: number;
};

export function StoreVisitsCard({ businessId, businessName, live, activeToken, refreshKey = 0 }: Props) {
  const { saveMerchantSession } = useAuth();
  const [range, setRange] = useState<StoreVisitsRange>("week");
  const [data, setData] = useState<StoreVisits | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [focusKey, setFocusKey] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(COLLAPSED_KEY)
      .then((v) => setCollapsed(v === "1"))
      .catch(() => {});
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      void AsyncStorage.setItem(COLLAPSED_KEY, c ? "0" : "1").catch(() => {});
      return !c;
    });
  };

  // Re-read whenever the Profile tab comes back into view.
  useFocusEffect(useCallback(() => setFocusKey((k) => k + 1), []));

  useEffect(() => {
    if (!live || !activeToken) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const exclude = await analyticsDeviceId().catch(() => undefined);
        const res = await fetchStoreVisits(activeToken, {
          range,
          tzOffset: -new Date().getTimezoneOffset(),
          exclude,
        });
        if (!active) return;
        if (res.merchantToken) void saveMerchantSession(res.merchantToken);
        setData(res);
      } catch (err) {
        if (!active) return;
        // A server that predates this endpoint answers 404 ("Not Found") —
        // expected until the backend is deployed, so not an error.
        const notDeployed = (err as { code?: string }).code === "Not Found";
        report(err, { scope: "store_visits_load" }, notDeployed ? "warning" : "error");
        setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [live, activeToken, range, focusKey, refreshKey, saveMerchantSession]);

  const share = async () => {
    try {
      const url = `kilipicks://provider/${businessId}`;
      await Share.share({ message: `Check out ${businessName} on KiliPicks! ${url}`, url });
    } catch (err) {
      report(err, { scope: "store_visits_share" });
    }
  };

  // First load shows the skeleton; later reloads keep the last numbers on
  // screen so switching ranges doesn't flash.
  const firstLoad = loading && !data;
  const state: "notLive" | "loading" | "error" | "empty" | "data" = !live
    ? "notLive"
    : firstLoad
      ? "loading"
      : failed && !data
        ? "error"
        : data && data.lifetimeVisits === 0
          ? "empty"
          : "data";

  if (state === "loading") {
    return (
      <View style={s.card}>
        <LoadingSkeleton />
      </View>
    );
  }

  const shown = data;
  // While another range loads, the previous numbers stay up — describe them
  // as what they are, not as the tab just tapped.
  const shownRange = data?.range ?? range;
  const cmp = shown?.comparison ?? null;
  const badge = cmp ? comparisonBadge(cmp, shownRange) : null;

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Pressable
          style={s.titleBtn}
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          accessibilityLabel="Store visits"
        >
          <Text style={s.title}>Store visits</Text>
          <MaterialIcons
            name="expand-more"
            size={22}
            color={C.muted}
            style={{ transform: [{ rotate: collapsed ? "-90deg" : "0deg" }] }}
          />
        </Pressable>

        {collapsed && state === "data" && shown ? (
          <Pressable style={s.summary} onPress={toggle}>
            <Text style={s.summaryText}>
              <Text style={s.summaryNum}>{shown.visits}</Text> visits
            </Text>
            {badge ? (
              <Text style={[s.badgeSmall, { backgroundColor: badge.bg, color: badge.fg }]}>{badge.text}</Text>
            ) : null}
          </Pressable>
        ) : null}

        {!collapsed && state === "data" ? (
          <View style={s.segment} accessibilityRole="tablist">
            {RANGES.map((r) => {
              const on = r.key === range;
              return (
                <Pressable
                  key={r.key}
                  style={[s.segBtn, on && s.segBtnOn]}
                  onPress={() => setRange(r.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.segText, on && s.segTextOn]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!collapsed && state === "notLive" ? (
          <View style={s.notLivePill}>
            <View style={s.notLiveDot} />
            <Text style={s.notLiveText}>Not live yet</Text>
          </View>
        ) : null}
      </View>

      {collapsed ? null : state === "data" && shown ? (
        <View style={s.stack}>
          <View style={s.heroRow}>
            <View>
              <View style={s.bigRow}>
                <Text style={s.bigNum}>{shown.visits}</Text>
                <Text style={s.bigUnit}>visits</Text>
              </View>
              <Text style={s.people}>
                from {shown.people} {shown.people === 1 ? "person" : "people"}
              </Text>
            </View>
            {badge ? (
              <View style={s.cmpCol}>
                <Text style={[s.badge, { backgroundColor: badge.bg, color: badge.fg }]}>{badge.text}</Text>
                <Text style={s.cmpCap}>{COMPARE_CAPTION[shownRange]}</Text>
              </View>
            ) : (
              <View style={s.noCmp}>
                <MaterialIcons name="schedule" size={16} color={C.muted} />
                <Text style={s.noCmpText}>{NO_COMPARE[shownRange]}</Text>
              </View>
            )}
          </View>

          <Bars data={shown} range={shownRange} />

          <View style={s.divider} />

          <View style={s.chips}>
            <Chip icon="chat-bubble" n={shown.contacted} label="contacted" />
            <Chip icon="event-available" n={shown.bookTaps} label="tapped Book" />
            <Chip icon="favorite" n={shown.saves} label="saved" />
          </View>

          <View style={s.note}>
            <Text style={s.noteText}>
              <Text style={s.noteStrong}>
                {shown.contacted} of {shown.people}
              </Text>{" "}
              {shown.people === 1 ? "visitor" : "visitors"} got in touch
            </Text>
          </View>

          <View style={s.privacy}>
            <MaterialIcons name="lock" size={14} color={C.faint} />
            <Text style={s.privacyText}>Counts are anonymous. Visitors&apos; identities aren&apos;t shared.</Text>
          </View>
        </View>
      ) : state === "empty" ? (
        <View style={s.centered}>
          <View style={s.bigIcon}>
            <MaterialIcons name="storefront" size={28} color={C.iconMuted} />
          </View>
          <Text style={s.centerTitle}>No visits yet</Text>
          <Text style={s.centerBody}>Share your store link to get your first customers</Text>
          <Pressable style={({ pressed }) => [s.shareBtn, pressed && { transform: [{ scale: 0.97 }] }]} onPress={share}>
            <MaterialIcons name="share" size={18} color="#FFFFFF" />
            <Text style={s.shareText}>Share your store</Text>
          </Pressable>
        </View>
      ) : state === "notLive" ? (
        <View style={s.notLiveBody}>
          <View style={s.ghostBars}>
            {[40, 60, 35, 75, 55, 90, 50].map((h, i) => (
              <View key={i} style={[s.ghostBar, { height: `${h}%` }]} />
            ))}
          </View>
          <Text style={s.people}>Visits start counting once your listing is live.</Text>
        </View>
      ) : (
        <Pressable
          style={s.centered}
          onPress={() => setFocusKey((k) => k + 1)}
          accessibilityRole="button"
          accessibilityLabel="Couldn't load visits. Tap to retry."
        >
          <View style={s.bigIcon}>
            <MaterialIcons name="cloud-off" size={28} color={C.iconMuted} />
          </View>
          <Text style={s.centerTitle}>Couldn&apos;t load visits</Text>
          <View style={s.retryRow}>
            <MaterialIcons name="refresh" size={18} color={C.brand} />
            <Text style={s.retryText}>Tap to retry</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function comparisonBadge(cmp: { delta: number; percent: number }, range: StoreVisitsRange) {
  if (cmp.delta === 0) return { text: "No change", bg: C.track, fg: C.muted };
  const up = cmp.delta > 0;
  // Today is small numbers, so show the difference ("+2"); longer periods a
  // percentage.
  const amount =
    range === "today" ? `${up ? "+" : "−"}${Math.abs(cmp.delta)}` : `${Math.abs(cmp.percent)}%`;
  return { text: `${up ? "▲" : "▼"} ${amount}`, bg: up ? C.upBg : C.downBg, fg: up ? C.upFg : C.downFg };
}

function Bars({ data, range }: { data: StoreVisits; range: StoreVisitsRange }) {
  const look = BARS[range];
  const max = Math.max(1, ...data.series.map((b) => b.value));
  return (
    <View style={[s.bars, { gap: look.gap }]}>
      {data.series.map((b, i) => {
        const current = i === data.currentIndex;
        const future = i > data.currentIndex;
        const label = b.label || (range === "month" ? `Day ${i + 1}` : "");
        return (
          <View
            key={i}
            style={s.barCol}
            accessible
            accessibilityLabel={future ? `${label}: still to come` : `${label}: ${b.value} visits`}
          >
            <View
              style={{
                width: look.width,
                height: Math.max(6, Math.round((b.value / max) * BAR_MAX)),
                backgroundColor: C.brand,
                // Today's bar solid, earlier ones lighter, days still to come
                // a faint stub rather than a misleading "zero visits".
                opacity: current ? 1 : future ? 0.12 : 0.4,
                borderTopLeftRadius: look.radius,
                borderTopRightRadius: look.radius,
                borderBottomLeftRadius: Math.max(1, Math.round(look.radius / 3)),
                borderBottomRightRadius: Math.max(1, Math.round(look.radius / 3)),
              }}
            />
            <Text style={[s.barLabel, current && s.barLabelOn]} numberOfLines={1}>
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Chip({ icon, n, label }: { icon: keyof typeof MaterialIcons.glyphMap; n: number; label: string }) {
  return (
    <View style={s.chip}>
      <View style={s.chipIcon}>
        <MaterialIcons name={icon} size={18} color={C.brand} />
      </View>
      <View style={{ minWidth: 0 }}>
        <Text style={s.chipNum}>{n}</Text>
        <Text style={s.chipLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function LoadingSkeleton() {
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const block = (w: number | `${number}%`, h: number, r = 8) => (
    <Animated.View style={{ width: w, height: h, borderRadius: r, backgroundColor: C.skeleton, opacity: pulse }} />
  );
  return (
    <View style={s.stack} accessibilityLabel="Loading store visits" accessibilityState={{ busy: true }}>
      <View style={s.skelRow}>
        {block(120, 22)}
        {block(176, 34, 999)}
      </View>
      <View style={s.skelRow}>
        <View style={{ gap: 8 }}>
          {block(110, 48, 12)}
          {block(96, 14, 6)}
        </View>
        {block(64, 26, 999)}
      </View>
      <View style={[s.bars, { height: 76, justifyContent: "space-around" }]}>
        {[50, 70, 40, 85, 60, 95, 55].map((h, i) => (
          <View key={i} style={{ width: 22, height: `${h}%`, borderRadius: 8, backgroundColor: C.skeleton }} />
        ))}
      </View>
      <View style={s.divider} />
      <View style={s.chips}>
        {block("31%", 32, 10)}
        {block("31%", 32, 10)}
        {block("31%", 32, 10)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...neu.raised, borderRadius: 28, padding: 20, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 34 },
  titleBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  title: { fontFamily: mf.semibold, fontSize: 20, letterSpacing: -0.2, color: C.ink },
  summary: { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryText: { fontFamily: mf.regular, fontSize: 15, color: C.body },
  summaryNum: { fontFamily: mf.bold, color: C.ink },
  badgeSmall: {
    fontFamily: mf.semibold,
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  // A groove pressed into the card; the selected range is raised out of it.
  segment: { flexDirection: "row", ...neu.inset, borderRadius: 999, padding: 4, gap: 4 },
  segBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999 },
  segBtnOn: neu.raisedSm,
  segText: { fontFamily: mf.medium, fontSize: 13, color: C.muted },
  segTextOn: { color: C.ink },
  notLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.track,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  notLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#9A918B" },
  notLiveText: { fontFamily: mf.medium, fontSize: 13, color: C.muted },
  stack: { gap: 16 },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  bigRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  bigNum: { fontFamily: mf.bold, fontSize: 52, lineHeight: 56, letterSpacing: -1.5, color: C.ink },
  bigUnit: { fontFamily: mf.medium, fontSize: 17, color: C.body },
  people: { fontFamily: mf.regular, fontSize: 15, color: C.muted, marginTop: 6 },
  cmpCol: { alignItems: "flex-end", gap: 6, maxWidth: 130, paddingTop: 4 },
  badge: {
    fontFamily: mf.semibold,
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  cmpCap: { fontFamily: mf.regular, fontSize: 12, lineHeight: 16, color: C.muted, textAlign: "right" },
  noCmp: { flexDirection: "row", alignItems: "flex-start", gap: 6, maxWidth: 140, paddingTop: 6 },
  noCmpText: { flexShrink: 1, fontFamily: mf.regular, fontSize: 12, lineHeight: 16, color: C.muted },
  bars: { flexDirection: "row", alignItems: "flex-end", height: 98 },
  barCol: { flex: 1, minWidth: 0, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  barLabel: { fontFamily: mf.regular, fontSize: 12, lineHeight: 14, height: 14, color: C.muted },
  barLabelOn: { fontFamily: mf.semibold, color: C.ink },
  divider: { height: 1, backgroundColor: C.divider },
  chips: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  chip: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    ...neu.inset,
    alignItems: "center",
    justifyContent: "center",
  },
  chipNum: { fontFamily: mf.bold, fontSize: 16, color: C.ink },
  chipLabel: { fontFamily: mf.regular, fontSize: 12, color: C.muted },
  note: { ...neu.inset, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  noteText: { fontFamily: mf.medium, fontSize: 15, color: C.body },
  noteStrong: { fontFamily: mf.semibold, color: C.brand },
  privacy: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4 },
  privacyText: { flexShrink: 1, fontFamily: mf.regular, fontSize: 12, color: C.faint },
  centered: { alignItems: "center", gap: 6, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 4 },
  bigIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    ...neu.inset,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  centerTitle: { fontFamily: mf.semibold, fontSize: 17, color: C.ink },
  centerBody: { fontFamily: mf.regular, fontSize: 14, color: C.muted, maxWidth: 240, textAlign: "center" },
  shareBtn: {
    marginTop: 10,
    ...neuAccent(false, C.brand),
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shareText: { fontFamily: mf.semibold, fontSize: 15, color: "#FFFFFF" },
  notLiveBody: { gap: 14 },
  ghostBars: { flexDirection: "row", alignItems: "flex-end", gap: 10, height: 56, paddingHorizontal: 6 },
  ghostBar: {
    flex: 1,
    backgroundColor: C.skeleton,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  retryRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  retryText: { fontFamily: mf.semibold, fontSize: 15, color: C.brand },
  skelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
