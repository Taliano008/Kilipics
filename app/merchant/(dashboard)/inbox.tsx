/**
 * Seller dashboard — Inbox tab.
 * Matches: Inspo/code merchant inbox.html
 * Per merchant_prd.md §5.4: "In Phase Zero, this is a WhatsApp deep link
 * rather than an in-app chat, since there is no messaging backend." Chats
 * and Activity are illustrative mock content (no chat/event backend
 * exists); Support is real — same SUPPORT_WHATSAPP_NUMBER + gating pattern
 * app/(tabs)/account.tsx already uses.
 */
import { DashboardHeader } from "@/components/merchant/DashboardHeader";
import { SUPPORT_WHATSAPP_NUMBER } from "@/config/env";
import { mc, mf, mr, ms } from "@/theme/merchant";
import { openWhatsapp } from "@/utils/whatsapp";
import { MaterialIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Chat = {
  id: string;
  name: string;
  phone: string;
  tag: string;
  message: string;
  timeAgo: string;
  waMessage: string;
};

const CHATS: Chat[] = [
  {
    id: "1",
    name: "Jane Wanjiku",
    phone: "+254712345678",
    tag: "Knotless Braids",
    message: "Hi Glow Beauty! Are you available tomorrow at 2 PM?",
    timeAgo: "2 min ago",
    waMessage: "Hi Jane! Yes, we have an opening for Knotless Braids tomorrow at 2 PM.",
  },
  {
    id: "2",
    name: "Brenda Mutua",
    phone: "+254720987654",
    tag: "Pending Slot",
    message: "I just requested a Gel Manicure for Thursday morning.",
    timeAgo: "25 min ago",
    waMessage: "Hi Brenda! Received your Gel Manicure request for Thursday morning.",
  },
  {
    id: "3",
    name: "Kevin Mwangi",
    phone: "+254733112233",
    tag: "Completed",
    message: "Thanks for the beard grooming appointment earlier!",
    timeAgo: "Yesterday",
    waMessage: "Thank you Kevin! Looking forward to your next grooming session.",
  },
];

const TABS = ["Chats", "Activity", "Support"] as const;

export default function InboxScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Chats");
  const [expanded, setExpanded] = useState<string | null>(null);
  const supportAvailable = SUPPORT_WHATSAPP_NUMBER.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: mc.surface }}>
      <DashboardHeader title="Inbox" />
      <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.statusStrip}>
            <View style={s.statusLeft}>
              <View style={s.pulseDot} />
              <Text style={s.statusText}>
                <Text style={{ fontFamily: mf.bold, color: mc.tertiary }}>WhatsApp Connected</Text>{" "}
                · Direct merchant dispatch
              </Text>
            </View>
            <MaterialIcons name="verified" size={18} color={mc.secondary} />
          </View>

          <Text style={s.title}>Inbox</Text>
          <Text style={s.subtitle}>Instant WhatsApp bridges & booking chats</Text>

          <View style={s.segment}>
            {TABS.map((t) => (
              <Pressable
                key={t}
                style={[s.segmentBtn, tab === t && s.segmentBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[s.segmentText, tab === t && s.segmentTextActive]}>{t}</Text>
                {t === "Chats" && (
                  <View style={s.segmentBadge}>
                    <Text style={s.segmentBadgeText}>{CHATS.length}</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {tab === "Chats" && (
            <>
              <View style={s.infoBanner}>
                <View style={s.infoIcon}>
                  <MaterialIcons name="cell-tower" size={18} color={mc.onTertiaryContainer} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoTitle}>Phase Zero Direct Relay</Text>
                  <Text style={s.infoBody}>
                    Tap a conversation to continue it on WhatsApp, with the customer&apos;s details and
                    context ready to send.
                  </Text>
                </View>
              </View>

              {CHATS.map((chat) => {
                const isOpen = expanded === chat.id;
                return (
                  <Pressable
                    key={chat.id}
                    style={s.chatCard}
                    onPress={() => setExpanded(isOpen ? null : chat.id)}
                  >
                    <View style={s.chatTopRow}>
                      <View style={s.chatIdentity}>
                        <View style={s.chatAvatar}>
                          <Text style={s.chatAvatarText}>
                            {chat.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                          </Text>
                        </View>
                        <View style={{ minWidth: 0, flex: 1 }}>
                          <View style={s.chatNameRow}>
                            <Text style={s.chatName} numberOfLines={1}>
                              {chat.name}
                            </Text>
                            <View style={s.chatTagPill}>
                              <Text style={s.chatTagText}>{chat.tag}</Text>
                            </View>
                          </View>
                          <Text style={s.chatMessage} numberOfLines={1}>
                            &ldquo;{chat.message}&rdquo;
                          </Text>
                        </View>
                      </View>
                      <Text style={s.chatTime}>{chat.timeAgo}</Text>
                    </View>

                    {isOpen && (
                      <View style={s.handoffCard}>
                        <View style={s.handoffTopRow}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <MaterialIcons name="open-in-new" size={14} color={mc.tertiary} />
                            <Text style={s.handoffLabel}>Continue on WhatsApp</Text>
                          </View>
                          <Text style={s.handoffPhone}>{chat.phone}</Text>
                        </View>
                        <Pressable
                          style={s.waButton}
                          onPress={() => void openWhatsapp(chat.phone, chat.waMessage)}
                        >
                          <Text style={s.waButtonText}>Open WhatsApp</Text>
                          <MaterialIcons name="chat" size={18} color="#fff" />
                        </Pressable>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </>
          )}

          {tab === "Activity" && (
            <View style={s.activityCard}>
              <Text style={s.activityHeading}>Recent Alerts</Text>
              <View style={s.activityRow}>
                <View style={[s.activityIcon, { backgroundColor: mc.tertiaryContainer }]}>
                  <MaterialIcons name="payments" size={18} color={mc.onTertiaryContainer} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.activityTitle}>M-Pesa Payout Settled</Text>
                  <Text style={s.activityBody}>
                    KES 4,200 deposited from a knotless braids session (Jane W.)
                  </Text>
                  <Text style={s.activityTime}>12 minutes ago</Text>
                </View>
              </View>
              <View style={s.activityRow}>
                <View style={[s.activityIcon, { backgroundColor: mc.primaryFixed }]}>
                  <MaterialIcons name="event-available" size={18} color={mc.onPrimaryFixed} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.activityTitle}>Reschedule Request</Text>
                  <Text style={s.activityBody}>
                    Faith O. asked to move Friday 4 PM to Saturday 10 AM.
                  </Text>
                  <Text style={s.activityTime}>1 hour ago</Text>
                </View>
              </View>
            </View>
          )}

          {tab === "Support" && (
            <View style={s.supportCard}>
              <View style={s.supportHeaderRow}>
                <View style={s.supportIconWrap}>
                  <MaterialIcons name="support-agent" size={24} color={mc.onSecondaryContainer} />
                </View>
                <View>
                  <Text style={s.supportTitle}>KiliPicks Partner Desk</Text>
                  <Text style={s.supportSub}>Nairobi Merchant Operations</Text>
                </View>
              </View>
              <Text style={s.supportBody}>
                Have an issue with bookings, listings, or your account? Chat with the KiliPicks
                team on WhatsApp.
              </Text>
              <Pressable
                style={[s.waButton, !supportAvailable && { opacity: 0.5 }]}
                disabled={!supportAvailable}
                onPress={() =>
                  void openWhatsapp(
                    SUPPORT_WHATSAPP_NUMBER,
                    "Hello KiliPicks Support, I need merchant assistance.",
                  )
                }
              >
                <Text style={s.waButtonText}>
                  {supportAvailable ? "Chat with Support" : "Support coming soon"}
                </Text>
                <MaterialIcons name="headset-mic" size={18} color="#fff" />
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: ms.md, gap: ms.sm, paddingBottom: 40 },
  statusStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: mc.surfaceContainerLow,
    borderRadius: mr.lg,
    paddingHorizontal: ms.sm,
    paddingVertical: 10,
  },
  statusLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: mc.tertiary },
  statusText: { fontFamily: mf.regular, fontSize: 11, color: mc.onSurface, flexShrink: 1 },

  title: { fontFamily: mf.extrabold, fontSize: 24, color: mc.onSurface, marginTop: 4 },
  subtitle: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant },

  segment: { flexDirection: "row", backgroundColor: mc.surfaceContainer, borderRadius: mr.xl, padding: 4, gap: 4 },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: mr.lg,
  },
  segmentBtnActive: { backgroundColor: mc.surfaceContainerLowest },
  segmentText: { fontFamily: mf.semibold, fontSize: 12, color: mc.secondary },
  segmentTextActive: { color: mc.primary },
  segmentBadge: { backgroundColor: mc.primary, borderRadius: mr.full, paddingHorizontal: 5, paddingVertical: 1 },
  segmentBadgeText: { fontFamily: mf.bold, fontSize: 9, color: mc.onPrimary },

  infoBanner: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: `${mc.surfaceContainerHigh}99`,
    borderRadius: mr.xl,
    padding: ms.sm,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: mr.md,
    backgroundColor: mc.tertiaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  infoBody: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant, marginTop: 2, lineHeight: 17 },

  chatCard: { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr["2xl"], padding: 14, gap: 10 },
  chatTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  chatIdentity: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 },
  chatAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: mc.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarText: { fontFamily: mf.bold, fontSize: 14, color: mc.onSecondaryContainer },
  chatNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  chatName: { fontFamily: mf.semibold, fontSize: 14, color: mc.onSurface },
  chatTagPill: { backgroundColor: mc.primaryFixed, borderRadius: mr.full, paddingHorizontal: 8, paddingVertical: 1 },
  chatTagText: { fontFamily: mf.semibold, fontSize: 10, color: mc.onPrimaryFixed },
  chatMessage: { fontFamily: mf.medium, fontSize: 13, color: mc.onSurface, marginTop: 3 },
  chatTime: { fontFamily: mf.semibold, fontSize: 11, color: mc.primary, flexShrink: 0 },

  handoffCard: { backgroundColor: mc.surfaceContainer, borderRadius: mr.lg, padding: 12, gap: 10 },
  handoffTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  handoffLabel: { fontFamily: mf.medium, fontSize: 12, color: mc.onSurface },
  handoffPhone: { fontFamily: mf.medium, fontSize: 11, color: mc.secondary },
  waButton: {
    minHeight: 44,
    borderRadius: mr.lg,
    backgroundColor: "#25D366",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  waButtonText: { fontFamily: mf.bold, fontSize: 14, color: "#fff" },

  activityCard: { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr["2xl"], padding: ms.md, gap: ms.sm },
  activityHeading: { fontFamily: mf.semibold, fontSize: 15, color: mc.onSurface },
  activityRow: { flexDirection: "row", gap: 10, backgroundColor: mc.surfaceContainerLow, borderRadius: mr.lg, padding: 10 },
  activityIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  activityTitle: { fontFamily: mf.semibold, fontSize: 13, color: mc.onSurface },
  activityBody: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant, marginTop: 2 },
  activityTime: { fontFamily: mf.medium, fontSize: 11, color: mc.secondary, marginTop: 4 },

  supportCard: { backgroundColor: mc.surfaceContainerLowest, borderRadius: mr["2xl"], padding: ms.md, gap: ms.sm },
  supportHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  supportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: mr.xl,
    backgroundColor: mc.secondaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  supportTitle: { fontFamily: mf.semibold, fontSize: 15, color: mc.onSurface },
  supportSub: { fontFamily: mf.regular, fontSize: 12, color: mc.onSurfaceVariant },
  supportBody: { fontFamily: mf.regular, fontSize: 13, color: mc.onSurfaceVariant, lineHeight: 19 },
});
