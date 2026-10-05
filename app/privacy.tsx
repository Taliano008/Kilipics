import { neuColors } from "@/theme/neumorphism";
import { colors, spacing } from "@/theme/tokens";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Section = {
  heading: string;
  intro?: string;
  points?: string[];
  outro?: string;
};

// Kept in step with what the app and backend actually do — if a feature
// starts collecting something new (location, payments, push tokens, ...),
// it has to be added here in the same change.
const SECTIONS: Section[] = [
  {
    heading: "What we collect",
    points: [
      "Account details: your name, email address and password. Your password is stored only in a scrambled (hashed) form that we cannot read.",
      "Profile photo, if you choose to add one.",
      "Booking details: the name and WhatsApp number you enter, the business and services you pick, your preferred date and time, and any note you add.",
      "Reviews you write: your rating and comments.",
      "If you list a business: your business name, contact phone and email, address, opening hours, photos, services and prices, the bookings you receive, and the sales records and targets you enter.",
      "Usage information: which screens and listings are viewed, searches, and taps on actions such as save or book, so we can see what is useful.",
      "Crash and error reports: technical details about your device and app version when something goes wrong.",
    ],
  },
  {
    heading: "What stays on your phone",
    points: [
      "Places you save are kept on your device and are not sent to us.",
      "A copy of the public business directory is stored on your device so the app works with a poor connection.",
      "The app uses your camera or photo library only when you choose to add a photo. We do not collect your location or your contacts.",
    ],
  },
  {
    heading: "Why we use it",
    points: [
      "To create and secure your account.",
      "To send your booking request to the business you chose, and to tell you when they accept, decline or change it.",
      "To show your bookings, notifications and reviews in the app.",
      "To let businesses manage their listing, bookings and sales.",
      "To fix faults, prevent misuse and improve KiliPicks.",
    ],
    outro:
      "We rely on your consent for booking requests (you tick a box before sending one), on what is needed to provide the service you asked for, and on our legitimate interest in keeping the app working and safe.",
  },
  {
    heading: "Who sees your information",
    points: [
      "The business you book with sees your name, WhatsApp number, the services, date and time you asked for, and your note. They may call or message you on WhatsApp about that booking.",
      "Reviews are public. They show your first name and the initial of your last name, and your profile photo if you have one.",
      "Business listings are public: business name, contact details, address, photos, services and prices.",
      "Service providers that run the app for us: our database and file hosting provider, and our crash-reporting provider. They handle it only to provide that service to us.",
      "We do not sell your personal information, and we do not share it with advertisers.",
    ],
  },
  {
    heading: "Where it is stored",
    intro:
      "Your information is stored on servers in the European Union (Ireland), which means it is transferred outside Kenya. It is encrypted when it travels between the app and our servers.",
  },
  {
    heading: "How long we keep it",
    intro:
      "We keep your account and booking history while your account is open, so you and the business have a record. If you ask us to delete your account we remove your personal details, except where we must keep a record to meet a legal obligation or resolve a dispute.",
  },
  {
    heading: "Payments",
    intro:
      "KiliPicks does not take payments in the app. You pay the business directly, and we do not collect card or mobile-money details.",
  },
  {
    heading: "Your rights",
    intro:
      "Under Kenya's Data Protection Act, 2019, you have the right to:",
    points: [
      "be told how your information is used (this notice);",
      "see the information we hold about you;",
      "have it corrected if it is wrong or out of date;",
      "have it deleted;",
      "object to, or withdraw consent for, how we use it;",
      "receive a copy in a form you can take elsewhere.",
    ],
    outro:
      "You can cancel a booking yourself under Activity. For anything else, contact us using the support option in the Account tab. If you are not satisfied, you can complain to the Office of the Data Protection Commissioner (odpc.go.ke).",
  },
  {
    heading: "Children",
    intro:
      "KiliPicks is for people aged 18 and over. We do not knowingly collect information from children.",
  },
  {
    heading: "Changes to this notice",
    intro:
      "If we change how we handle your information we will update this notice and the date at the top.",
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Pressable
          style={styles.close}
          onPress={() => router.back()}
          accessibilityLabel="Close"
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>LAST UPDATED 30 SEPTEMBER 2026</Text>
        <Text style={styles.title}>Privacy notice</Text>
        <Text style={styles.paragraph}>
          This notice explains what personal information KiliPicks collects
          when you use the app, why, who sees it, and the choices you have.
          It applies to customers and to businesses listed on KiliPicks.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.heading}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.intro ? (
              <Text style={styles.paragraph}>{section.intro}</Text>
            ) : null}
            {section.points?.map((point) => (
              <Text key={point} style={styles.bullet}>
                {"• "}
                {point}
              </Text>
            ))}
            {section.outro ? (
              <Text style={styles.paragraph}>{section.outro}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: neuColors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerSpacer: { flex: 1 },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: { color: colors.ink, fontSize: 22 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  eyebrow: {
    color: colors.clay,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 5,
    marginBottom: spacing.md,
  },
  heading: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginTop: spacing.lg,
  },
  paragraph: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  bullet: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.xs,
    paddingLeft: spacing.md,
  },
});
