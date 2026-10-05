/**
 * Seller dashboard — Sales tab.
 * Matches: Inspo/code sales performance.html
 * Two sources, merged into one ledger: accepted bookings (confirmed or
 * completed, from src/merchant/bookings-context.tsx — each one is a sale
 * dated on its appointment day) and hand-entered transactions, saved to the
 * merchant's account (src/merchant/sales-context.tsx).
 * The Daily / Weekly / Monthly switch scopes the totals, chart and list.
 *
 * Deliberately drops two things the mockup shows that this screen has no
 * honest basis for: a "+18% vs last month" delta (no prior-month data
 * exists on a fresh local store) and a "you're in the top 15% of Nairobi
 * studios" claim (an unverifiable, fabricated ranking). Real numbers only.
 */
import { KeyboardAvoider } from "@/components/KeyboardAvoider";
import { DashboardHeader } from "@/components/merchant/DashboardHeader";
import { useBookings } from "@/merchant/bookings-context";
import { useSales, type SalesGoals, type TransactionType } from "@/merchant/sales-context";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { localIsoDate, parseLocalDate } from "@/utils/dates";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PERIODS = ["Daily", "Weekly", "Monthly"] as const;
type Period = (typeof PERIODS)[number];

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// One row of the sales ledger: either a transaction the merchant typed in,
// or a booking they accepted.
type SalesEntry = {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  method: string;
  date: string; // YYYY-MM-DD
  hour: number; // 0–23, for the Daily chart
  time: string; // display only
  sortKey: string;
  fromBooking: boolean;
};

function to12h(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function sum(entries: SalesEntry[], type: TransactionType) {
  return entries.filter((e) => e.type === type).reduce((s, e) => s + e.amount, 0);
}

const PERIOD_COPY: Record<
  Period,
  { hero: string; chartTitle: string; chartSub: string; empty: string }
> = {
  Daily: {
    hero: "Total Revenue Today",
    chartTitle: "Today's Rhythm",
    chartSub: "Income by time of day",
    empty: "No sales today yet.",
  },
  Weekly: {
    hero: "Total Revenue This Week",
    chartTitle: "Daily Rhythm",
    chartSub: "Income across this week's days",
    empty: "No sales this week yet.",
  },
  Monthly: {
    hero: "Total Revenue This Month",
    chartTitle: "Weekly Rhythm",
    chartSub: "Income across this month's weeks",
    empty: "No sales this month yet.",
  },
};

export default function SalesScreen() {
  const {
    transactions,
    goals,
    error: salesError,
    refresh: refreshSales,
    addTransaction,
    setGoal,
  } = useSales();
  const { bookings, refresh } = useBookings();
  const [period, setPeriod] = useState<Period>("Monthly");
  const [addOpen, setAddOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<keyof SalesGoals | null>(null);

  // A booking accepted (or made) since this tab was last open should count.
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshSales();
    }, [refresh, refreshSales]),
  );

  const now = useMemo(() => new Date(), []);
  const todayIso = localIsoDate(now);
  // Sunday to Saturday, as local calendar dates (string compare is safe for
  // YYYY-MM-DD and avoids time-of-day edge cases).
  const weekStartIso = localIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()),
  );
  const weekEndIso = localIsoDate(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 6),
  );
  const monthPrefix = todayIso.slice(0, 7);

  // Every accepted booking is a sale, dated on the day of the appointment.
  // Pending bookings aren't revenue until the merchant accepts them, and
  // cancelled ones never are — so cancelling a booking removes its sale.
  const entries = useMemo<SalesEntry[]>(() => {
    const manual = transactions.map((t): SalesEntry => {
      const created = new Date(t.createdAt);
      const hour = Number.isNaN(created.getTime()) ? 12 : created.getHours();
      const minute = Number.isNaN(created.getTime()) ? 0 : created.getMinutes();
      return {
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        method: t.method,
        date: t.date,
        hour,
        time: t.time,
        sortKey: `${t.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        fromBooking: false,
      };
    });
    const booked = bookings
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .map(
        (b): SalesEntry => ({
          id: `booking-${b.id}`,
          type: "income",
          amount: b.price,
          description: `${b.serviceName} · ${b.customerName}`,
          method: "Booking",
          date: b.date,
          hour: Number(b.time.slice(0, 2)) || 0,
          time: to12h(b.time),
          sortKey: `${b.date}T${b.time}`,
          fromBooking: true,
        }),
      );
    return [...manual, ...booked].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [transactions, bookings]);

  const inPeriod = useCallback(
    (date: string, p: Period) =>
      p === "Daily"
        ? date === todayIso
        : p === "Weekly"
          ? date >= weekStartIso && date <= weekEndIso
          : date.startsWith(monthPrefix),
    [todayIso, weekStartIso, weekEndIso, monthPrefix],
  );

  const periodEntries = useMemo(
    () => entries.filter((e) => inPeriod(e.date, period)),
    [entries, inPeriod, period],
  );

  const income = sum(periodEntries, "income");
  const expenses = sum(periodEntries, "expense");
  const net = income - expenses;

  // The three targets always show their own period, whichever tab is active.
  const todayIncome = sum(entries.filter((e) => inPeriod(e.date, "Daily")), "income");
  const weekIncome = sum(entries.filter((e) => inPeriod(e.date, "Weekly")), "income");
  const monthIncome = sum(entries.filter((e) => inPeriod(e.date, "Monthly")), "income");

  const pendingInPeriod = bookings.filter(
    (b) => b.status === "pending" && inPeriod(b.date, period),
  );
  const pendingValue = pendingInPeriod.reduce((s, b) => s + b.price, 0);

  // Income only. Daily splits today by time of day, Weekly by weekday,
  // Monthly by week of the month. Sparse on a fresh install, which is the
  // honest state for a merchant with no sales history yet.
  const chart = useMemo(() => {
    const labels =
      period === "Daily"
        ? ["Morning", "Afternoon", "Evening"]
        : period === "Weekly"
          ? WEEKDAY
          : ["Wk 1", "Wk 2", "Wk 3", "Wk 4"];
    const values = labels.map(() => 0);
    for (const e of periodEntries) {
      if (e.type !== "income") continue;
      const idx =
        period === "Daily"
          ? e.hour < 12
            ? 0
            : e.hour < 17
              ? 1
              : 2
          : period === "Weekly"
            ? parseLocalDate(e.date).getDay()
            : Math.min(3, Math.floor((parseLocalDate(e.date).getDate() - 1) / 7));
      values[idx] += e.amount;
    }
    return labels.map((label, i) => ({ label, value: values[i] }));
  }, [periodEntries, period]);
  const maxBucket = Math.max(1, ...chart.map((c) => c.value));
  const peakIdx = chart.findIndex((c) => c.value === maxBucket);

  const periodLabel =
    period === "Daily"
      ? now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
      : period === "Weekly"
        ? `${parseLocalDate(weekStartIso).toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${parseLocalDate(weekEndIso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
        : now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const copy = PERIOD_COPY[period];

  return (
    <View style={{ flex: 1, backgroundColor: mc.surface }}>
      <DashboardHeader title="Sales" />
      <SafeAreaView edges={[]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.topRow}>
            <View>
              <Text style={s.overviewLabel}>Sales Overview</Text>
              <Text style={s.monthLabel}>{periodLabel}</Text>
            </View>
            <View style={s.syncPill}>
              <View style={s.syncDot} />
              <Text style={s.syncPillText}>Saved to account</Text>
            </View>
          </View>

          <View style={s.banner}>
            <MaterialIcons name="verified-user" size={20} color={mc.primary} />
            <Text style={s.bannerText}>
              Accepted bookings count as sales automatically. Transactions and targets you add
              are saved to your account, so they follow you to any phone.
            </Text>
          </View>
          {salesError && (
            <Pressable style={s.banner} onPress={refreshSales}>
              <MaterialIcons name="cloud-off" size={18} color={mc.error} />
              <Text style={[s.bannerText, { color: mc.error }]}>
                Couldn&apos;t load your saved transactions ({salesError}). Tap to retry.
              </Text>
            </Pressable>
          )}

          <View style={s.segment}>
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                style={[s.segmentBtn, period === p && s.segmentBtnActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[s.segmentText, period === p && s.segmentTextActive]}>{p}</Text>
              </Pressable>
            ))}
          </View>

          <LinearGradient
            colors={[mc.primary, mc.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.heroCard}
          >
            <Text style={s.heroLabel}>{copy.hero}</Text>
            <View style={s.heroAmountRow}>
              <Text style={s.heroCurrency}>KES</Text>
              <Text style={s.heroAmount}>{income.toLocaleString()}</Text>
            </View>
            <View style={s.heroGrid}>
              <View style={s.heroGridItem}>
                <Text style={s.heroGridLabel}>Income</Text>
                <Text style={[s.heroGridValue, { color: mc.tertiaryFixedDim }]}>
                  +{income.toLocaleString()}
                </Text>
              </View>
              <View style={s.heroGridItem}>
                <Text style={s.heroGridLabel}>Expenses</Text>
                <Text style={[s.heroGridValue, { color: mc.primaryFixed }]}>
                  -{expenses.toLocaleString()}
                </Text>
              </View>
              <View style={s.heroGridItem}>
                <Text style={s.heroGridLabel}>Net Profit</Text>
                <Text style={[s.heroGridValue, { color: "#fff", fontFamily: mf.extrabold }]}>
                  {net.toLocaleString()}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {pendingInPeriod.length > 0 && (
            <View style={s.banner}>
              <MaterialIcons name="hourglass-top" size={18} color={mc.primary} />
              <Text style={s.bannerText}>
                {pendingInPeriod.length} pending{" "}
                {pendingInPeriod.length === 1 ? "booking" : "bookings"} worth KES{" "}
                {pendingValue.toLocaleString()} will count here once you accept{" "}
                {pendingInPeriod.length === 1 ? "it" : "them"} in Bookings.
              </Text>
            </View>
          )}

          <View style={s.chartCard}>
            <View style={s.chartHeaderRow}>
              <View>
                <Text style={s.chartTitle}>{copy.chartTitle}</Text>
                <Text style={s.chartSub}>{copy.chartSub}</Text>
              </View>
            </View>
            <View style={s.chartRow}>
              {chart.map(({ label, value: v }, i) => {
                const heightPct = Math.max(6, (v / maxBucket) * 100);
                const isPeak = i === peakIdx && v > 0;
                return (
                  <View key={label} style={s.chartBarCol}>
                    <Text style={s.chartBarValue}>{v > 0 ? `${Math.round(v / 100) / 10}k` : "—"}</Text>
                    <View style={s.chartBarTrack}>
                      {isPeak ? (
                        <LinearGradient
                          colors={[mc.primaryContainer, mc.primary]}
                          style={[s.chartBarFill, { height: `${heightPct}%` }]}
                        />
                      ) : (
                        <View
                          style={[
                            s.chartBarFill,
                            { height: `${heightPct}%`, backgroundColor: mc.surfaceContainer },
                          ]}
                        />
                      )}
                    </View>
                    <Text style={[s.chartBarLabel, isPeak && { color: mc.primary, fontFamily: mf.bold }]}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={s.goalsHeader}>
            <Text style={s.sectionTitle}>Your Growth Targets</Text>
          </View>
          <GoalRow
            icon="wb-sunny"
            iconColor={mc.primary}
            label="Today's Pace"
            value={todayIncome}
            target={goals.daily}
            barColor={mc.primary}
            onEdit={() => setEditingGoal("daily")}
          />
          <GoalRow
            icon="date-range"
            iconColor={mc.tertiary}
            label="Weekly Benchmark"
            value={weekIncome}
            target={goals.weekly}
            barColor={mc.tertiary}
            onEdit={() => setEditingGoal("weekly")}
          />
          <GoalRow
            icon="flag"
            iconColor={mc.primaryContainer}
            label={`${now.toLocaleDateString(undefined, { month: "long" })} Milestone`}
            value={monthIncome}
            target={goals.monthly}
            barColor={mc.primaryContainer}
            onEdit={() => setEditingGoal("monthly")}
          />

          <View style={s.logHeader}>
            <Text style={s.sectionTitle}>Recent Cashflows</Text>
          </View>
          {periodEntries.length === 0 ? (
            <Text style={s.emptyText}>{copy.empty}</Text>
          ) : (
            periodEntries.slice(0, 12).map((t) => (
              <View key={t.id} style={s.txRow}>
                <View style={s.txLeft}>
                  <View
                    style={[
                      s.txIconWrap,
                      { backgroundColor: t.type === "income" ? `${mc.tertiary}1A` : mc.errorContainer },
                    ]}
                  >
                    <MaterialIcons
                      name={
                        t.fromBooking ? "event-available" : t.type === "income" ? "content-cut" : "inventory-2"
                      }
                      size={18}
                      color={t.type === "income" ? mc.tertiary : mc.error}
                    />
                  </View>
                  <View style={{ minWidth: 0, flex: 1 }}>
                    <Text style={s.txDesc} numberOfLines={1}>
                      {t.description}
                    </Text>
                    <View style={s.txMetaRow}>
                      <Text style={s.txMethod}>{t.method}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[s.txAmount, { color: t.type === "income" ? mc.tertiary : mc.error }]}>
                    {t.type === "income" ? "+" : "-"}KES {t.amount.toLocaleString()}
                  </Text>
                  <Text style={s.txTime}>
                    {period === "Daily"
                      ? t.time
                      : `${parseLocalDate(t.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${t.time}`}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={s.fabWrap}>
          <Pressable style={s.fab} onPress={() => setAddOpen(true)}>
            <MaterialIcons name="add" size={20} color={mc.onPrimary} />
            <Text style={s.fabText}>Add Transaction</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <AddTransactionModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(input) => {
          addTransaction(input)
            .then(() => setAddOpen(false))
            .catch((err: Error) => Alert.alert("Couldn't save transaction", err.message));
        }}
      />
      <EditGoalModal
        goalKey={editingGoal}
        currentValue={editingGoal ? goals[editingGoal] : 0}
        onClose={() => setEditingGoal(null)}
        onSave={(v) => {
          if (editingGoal) {
            setGoal(editingGoal, v).catch((err: Error) =>
              Alert.alert("Couldn't save target", err.message),
            );
          }
          setEditingGoal(null);
        }}
      />
    </View>
  );
}

function GoalRow({
  icon,
  iconColor,
  label,
  value,
  target,
  barColor,
  onEdit,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  label: string;
  value: number;
  target: number;
  barColor: string;
  onEdit: () => void;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const remaining = Math.max(0, target - value);
  return (
    <Pressable style={s.goalCard} onPress={onEdit}>
      <View style={s.goalTopRow}>
        <View style={s.goalTitleRow}>
          <MaterialIcons name={icon} size={16} color={iconColor} />
          <Text style={s.goalTitle}>{label}</Text>
        </View>
        <View style={s.goalValueRow}>
          <Text style={s.goalValue}>KES {value.toLocaleString()}</Text>
          <Text style={s.goalTarget}> / {target.toLocaleString()}</Text>
        </View>
      </View>
      <View style={s.goalTrack}>
        <View style={[s.goalFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <View style={s.goalBottomRow}>
        <Text style={s.goalPct}>{Math.round(pct)}% achieved</Text>
        <Text style={[s.goalRemaining, { color: barColor }]}>
          {remaining > 0 ? `KES ${remaining.toLocaleString()} to go · tap to edit target` : "Target hit!"}
        </Text>
      </View>
    </Pressable>
  );
}

function AddTransactionModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: { type: TransactionType; amount: number; description: string; method?: string }) => void;
}) {
  const [type, setType] = useState<TransactionType>("income");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState("M-Pesa");

  const canSubmit = Number(amount) > 0 && description.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoider>
      <View style={s.modalBackdrop}>
        <View style={s.formCard}>
          <View style={s.formHeader}>
            <Text style={s.formTitle}>Add Transaction</Text>
            <Pressable style={s.modalCloseBtn} onPress={onClose}>
              <MaterialIcons name="close" size={16} color={mc.onSurface} />
            </Pressable>
          </View>
          <View style={s.typeToggle}>
            <Pressable
              style={[s.typeBtn, type === "income" && { backgroundColor: mc.tertiary }]}
              onPress={() => setType("income")}
            >
              <Text style={[s.typeBtnText, type === "income" && { color: mc.onTertiary }]}>Income</Text>
            </Pressable>
            <Pressable
              style={[s.typeBtn, type === "expense" && { backgroundColor: mc.error }]}
              onPress={() => setType("expense")}
            >
              <Text style={[s.typeBtnText, type === "expense" && { color: mc.onError }]}>Expense</Text>
            </Pressable>
          </View>
          <TextInput
            style={s.input}
            placeholder="Amount (KES)"
            placeholderTextColor={mc.outline}
            keyboardType="number-pad"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
          />
          <TextInput
            style={s.input}
            placeholder="Description"
            placeholderTextColor={mc.outline}
            value={description}
            onChangeText={setDescription}
          />
          <TextInput
            style={s.input}
            placeholder="Method (M-Pesa, Cash, ...)"
            placeholderTextColor={mc.outline}
            value={method}
            onChangeText={setMethod}
          />
          <Pressable
            style={[s.formSubmit, !canSubmit && { opacity: 0.5 }]}
            disabled={!canSubmit}
            onPress={() =>
              onSubmit({ type, amount: Number(amount), description: description.trim(), method })
            }
          >
            <Text style={s.formSubmitText}>Save Transaction</Text>
          </Pressable>
        </View>
      </View>
      </KeyboardAvoider>
    </Modal>
  );
}

function EditGoalModal({
  goalKey,
  currentValue,
  onClose,
  onSave,
}: {
  goalKey: keyof SalesGoals | null;
  currentValue: number;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState(String(currentValue));

  return (
    <Modal visible={goalKey !== null} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoider>
      <View style={s.modalBackdropCenter}>
        <View style={s.editGoalCard}>
          <Text style={s.formTitle}>Edit {goalKey} target</Text>
          <TextInput
            style={s.input}
            keyboardType="number-pad"
            value={value}
            onChangeText={(v) => setValue(v.replace(/[^0-9]/g, ""))}
            autoFocus
          />
          <View style={{ flexDirection: "row", gap: ms.sm }}>
            <Pressable style={[s.formSubmit, { flex: 1, backgroundColor: mc.surfaceContainerHigh }]} onPress={onClose}>
              <Text style={[s.formSubmitText, { color: mc.onSurface }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.formSubmit, { flex: 1 }]}
              onPress={() => onSave(Number(value) || 0)}
            >
              <Text style={s.formSubmitText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
      </KeyboardAvoider>
    </Modal>
  );
}

const s = StyleSheet.create({
  content: { padding: ms.md, gap: ms.sm, paddingBottom: 110 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  overviewLabel: { fontFamily: mf.bold, fontSize: 18, color: mc.onSurface },
  monthLabel: { fontFamily: mf.semibold, fontSize: 14, color: mc.primary, marginTop: 2 },
  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: mc.surfaceContainerHigh,
    borderRadius: mr.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: mc.tertiary },
  syncPillText: { fontFamily: mf.semibold, fontSize: 11, color: mc.onSurfaceVariant },

  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: mc.surfaceContainer,
    borderRadius: mr.lg,
    padding: ms.sm,
  },
  bannerText: { flex: 1, fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant, lineHeight: 17 },

  segment: { flexDirection: "row", backgroundColor: mc.surfaceContainerHigh, borderRadius: mr.lg, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: mr.md, alignItems: "center" },
  segmentBtnActive: { backgroundColor: mc.surfaceContainerLowest },
  segmentText: { fontFamily: mf.semibold, fontSize: 12, color: mc.onSurfaceVariant },
  segmentTextActive: { color: mc.primary, fontFamily: mf.bold },

  heroCard: { borderRadius: mr.xl, padding: ms.md, gap: ms.sm },
  heroLabel: { fontFamily: mf.semibold, fontSize: 11, color: "#fff", textTransform: "uppercase", letterSpacing: 0.6 },
  heroAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  heroCurrency: { fontFamily: mf.bold, fontSize: 16, color: "#fff" },
  heroAmount: { fontFamily: mf.extrabold, fontSize: 32, color: "#fff" },
  heroGrid: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: mr.lg,
    padding: ms.sm,
    gap: 8,
  },
  heroGridItem: { flex: 1 },
  heroGridLabel: { fontFamily: mf.medium, fontSize: 10, color: "rgba(255,255,255,0.8)" },
  heroGridValue: { fontFamily: mf.semibold, fontSize: 14, marginTop: 2 },

  chartCard: { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.xl, padding: ms.md, gap: ms.sm },
  chartHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chartTitle: { fontFamily: mf.bold, fontSize: 15, color: mc.onSurface },
  chartSub: { fontFamily: mf.regular, fontSize: 11, color: mc.onSurfaceVariant, marginTop: 1 },
  chartRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, height: 120, paddingTop: 8 },
  chartBarCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  chartBarValue: { fontFamily: mf.semibold, fontSize: 10, color: mc.onSurfaceVariant, marginBottom: 4 },
  chartBarTrack: { width: "70%", flex: 1, justifyContent: "flex-end" },
  chartBarFill: { width: "100%", borderRadius: 6 },
  chartBarLabel: { fontFamily: mf.medium, fontSize: 10, color: mc.secondary, marginTop: 6 },

  goalsHeader: { marginTop: 6 },
  sectionTitle: { fontFamily: mf.bold, fontSize: 16, color: mc.onSurface },
  goalCard: { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr.lg, padding: ms.sm, gap: 8 },
  goalTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalTitle: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  goalValueRow: { flexDirection: "row", alignItems: "baseline" },
  goalValue: { fontFamily: mf.bold, fontSize: 14, color: mc.onSurface },
  goalTarget: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant },
  goalTrack: { height: 10, borderRadius: 5, backgroundColor: mc.surfaceContainer, overflow: "hidden" },
  goalFill: { height: "100%", borderRadius: 5 },
  goalBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalPct: { fontFamily: mf.medium, fontSize: 11, color: mc.onSurfaceVariant },
  goalRemaining: { fontFamily: mf.semibold, fontSize: 11 },

  logHeader: { marginTop: 6 },
  emptyText: { fontFamily: mf.medium, fontSize: 13, color: mc.onSurfaceVariant, textAlign: "center", paddingVertical: ms.md },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr.lg,
    padding: ms.sm,
  },
  txLeft: { flexDirection: "row", alignItems: "center", gap: ms.sm, flex: 1, minWidth: 0 },
  txIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txDesc: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  txMetaRow: { flexDirection: "row", gap: 6, marginTop: 2 },
  txMethod: {
    fontFamily: mf.medium,
    fontSize: 10,
    color: mc.onSurfaceVariant,
    backgroundColor: mc.surfaceContainer,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  txAmount: { fontFamily: mf.bold, fontSize: 13 },
  txTime: { fontFamily: mf.regular, fontSize: 10, color: mc.onSurfaceVariant, marginTop: 2 },

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
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { fontFamily: mf.bold, fontSize: 13, color: mc.onPrimary },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(30,27,24,0.5)", justifyContent: "flex-end" },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(30,27,24,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: ms.lg,
  },
  formCard: {
    backgroundColor: mc.surfaceContainerLowest,
    borderTopLeftRadius: mr["2xl"],
    borderTopRightRadius: mr["2xl"],
    padding: ms.lg,
    gap: ms.sm,
  },
  editGoalCard: {
    backgroundColor: mc.surfaceContainerLowest,
    borderRadius: mr.xl,
    padding: ms.lg,
    gap: ms.sm,
    width: "100%",
  },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formTitle: { fontFamily: mf.bold, fontSize: 16, color: mc.onSurface, textTransform: "capitalize" },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: mc.surfaceContainerHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  typeToggle: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: mr.md,
    backgroundColor: mc.surfaceContainerHigh,
    alignItems: "center",
  },
  typeBtnText: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  input: {
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.md,
    paddingHorizontal: ms.sm,
    paddingVertical: 12,
    fontFamily: mf.regular,
    fontSize: 14,
    color: mc.onSurface,
  },
  formSubmit: {
    height: 50,
    borderRadius: mr.lg,
    backgroundColor: mc.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  formSubmitText: { fontFamily: mf.bold, fontSize: 15, color: mc.onPrimary },
});
