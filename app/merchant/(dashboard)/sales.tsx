/**
 * Seller dashboard — Sales tab.
 * Matches: Inspo/code sales performance.html
 * Local-only data (src/merchant/sales-context.tsx) — merchant_prd.md §5.2:
 * "All sales data is local to the device in Phase Zero."
 *
 * Deliberately drops two things the mockup shows that this screen has no
 * honest basis for: a "+18% vs last month" delta (no prior-month data
 * exists on a fresh local store) and a "you're in the top 15% of Nairobi
 * studios" claim (an unverifiable, fabricated ranking). Real numbers only.
 */
import { DashboardHeader } from "@/components/merchant/DashboardHeader";
import { useSales, type SalesGoals, type TransactionType } from "@/merchant/sales-context";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PERIODS = ["Daily", "Weekly", "Monthly"] as const;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export default function SalesScreen() {
  const { transactions, goals, addTransaction, setGoal } = useSales();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("Monthly");
  const [addOpen, setAddOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<keyof SalesGoals | null>(null);

  const now = useMemo(() => new Date(), []);
  const thisMonth = useMemo(
    () => transactions.filter((t) => monthKey(new Date(t.date)) === monthKey(now)),
    [transactions, now],
  );

  const income = thisMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = thisMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;

  const todayIso = now.toISOString().slice(0, 10);
  const todayIncome = transactions
    .filter((t) => t.type === "income" && t.date === todayIso)
    .reduce((s, t) => s + t.amount, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weekIncome = transactions
    .filter((t) => t.type === "income" && new Date(t.date) >= startOfWeek)
    .reduce((s, t) => s + t.amount, 0);

  // 4 week-of-month buckets, income only — sparse on a fresh install, which
  // is the honest state for a merchant with no sales history yet.
  const weekBuckets = useMemo(() => {
    const buckets = [0, 0, 0, 0];
    for (const t of thisMonth) {
      if (t.type !== "income") continue;
      const day = new Date(t.date).getDate();
      const idx = Math.min(3, Math.floor((day - 1) / 7));
      buckets[idx] += t.amount;
    }
    return buckets;
  }, [thisMonth]);
  const maxBucket = Math.max(1, ...weekBuckets);
  const peakIdx = weekBuckets.indexOf(Math.max(...weekBuckets));

  return (
    <View style={{ flex: 1, backgroundColor: mc.surface }}>
      <DashboardHeader title="Sales" />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.topRow}>
            <View>
              <Text style={s.overviewLabel}>Sales Overview</Text>
              <Text style={s.monthLabel}>
                {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </Text>
            </View>
            <View style={s.syncPill}>
              <View style={s.syncDot} />
              <Text style={s.syncPillText}>Local device</Text>
            </View>
          </View>

          <View style={s.banner}>
            <MaterialIcons name="verified-user" size={20} color={mc.primary} />
            <Text style={s.bannerText}>
              Your sales data is currently stored locally on this device ·{" "}
              <Text style={{ fontFamily: mf.bold, color: mc.onSurface }}>Phase Zero</Text>
            </Text>
          </View>

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
            <Text style={s.heroLabel}>Total Revenue This Month</Text>
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

          <View style={s.chartCard}>
            <View style={s.chartHeaderRow}>
              <View>
                <Text style={s.chartTitle}>Weekly Rhythm</Text>
                <Text style={s.chartSub}>Income across this month&apos;s weeks</Text>
              </View>
            </View>
            <View style={s.chartRow}>
              {weekBuckets.map((v, i) => {
                const heightPct = Math.max(6, (v / maxBucket) * 100);
                const isPeak = i === peakIdx && v > 0;
                return (
                  <View key={i} style={s.chartBarCol}>
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
                      Wk {i + 1}
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
            value={income}
            target={goals.monthly}
            barColor={mc.primaryContainer}
            onEdit={() => setEditingGoal("monthly")}
          />

          <View style={s.logHeader}>
            <Text style={s.sectionTitle}>Recent Cashflows</Text>
          </View>
          {transactions.length === 0 ? (
            <Text style={s.emptyText}>No transactions yet.</Text>
          ) : (
            transactions.slice(0, 12).map((t) => (
              <View key={t.id} style={s.txRow}>
                <View style={s.txLeft}>
                  <View
                    style={[
                      s.txIconWrap,
                      { backgroundColor: t.type === "income" ? `${mc.tertiary}1A` : mc.errorContainer },
                    ]}
                  >
                    <MaterialIcons
                      name={t.type === "income" ? "content-cut" : "inventory-2"}
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
                  <Text style={s.txTime}>{t.time}</Text>
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
          addTransaction(input);
          setAddOpen(false);
        }}
      />
      <EditGoalModal
        goalKey={editingGoal}
        currentValue={editingGoal ? goals[editingGoal] : 0}
        onClose={() => setEditingGoal(null)}
        onSave={(v) => {
          if (editingGoal) setGoal(editingGoal, v);
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
