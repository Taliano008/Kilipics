import { useCatalog } from "@/catalog/catalog-context";
import { report } from "@/observability/report";
import { useVideoPlayer, VideoView } from "expo-video";
import * as SplashScreen from "expo-splash-screen";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";

// Cold-start only: plays once, muted, no controls, not skippable. The native
// splash (already held by app/_layout.tsx) stays up until this video's first
// frame is actually rendered, so there's never a blank/white gap between the
// two. Two independent 3s safety nets guard against a hung/corrupt asset —
// one bounding how long we wait for a first frame, one bounding playback —
// so a codec failure or a slow device can never trap a user on a black
// screen. Failing to load reports once and proceeds straight to Home.
const VIDEO_TIMEOUT_MS = 3000;
const splashVideoSource = require("../../assets/splash/intro.mp4");

export function VideoSplashGate({ children }: PropsWithChildren) {
  const { loading: catalogLoading } = useCatalog();
  const [appReady, setAppReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [videoErrored, setVideoErrored] = useState(false);
  const revealed = useRef(false);
  const finished = useRef(false);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const player = useVideoPlayer(splashVideoSource, (instance) => {
    instance.muted = true;
    instance.loop = false;
  });

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => {
        if (!cancelled) setReduceMotion(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    setAppReady(true);
  }, []);

  const reveal = useCallback(
    (skipVideo: boolean) => {
      if (revealed.current) return;
      revealed.current = true;
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
      void SplashScreen.hideAsync();
      if (skipVideo) {
        finish();
        return;
      }
      playTimeoutRef.current = setTimeout(finish, VIDEO_TIMEOUT_MS);
    },
    [finish],
  );

  // Start playback as soon as the player exists, concurrently with the
  // catalog fetch — by the time either settles, the other is likely warm too.
  useEffect(() => {
    if (reduceMotion) return;
    player.play();
  }, [player, reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const statusSub = player.addListener(
      "statusChange",
      ({ status, error }) => {
        if (status === "error") {
          report(error ?? new Error("Video splash failed to load"), {
            scope: "video_splash",
          });
          setVideoErrored(true);
        }
      },
    );
    const endSub = player.addListener("playToEnd", finish);
    return () => {
      statusSub.remove();
      endSub.remove();
    };
  }, [player, reduceMotion, finish]);

  // The single decision point: reveal (video or straight to app) once the
  // catalog has settled and we know whether to show a video at all.
  useEffect(() => {
    if (revealed.current || catalogLoading || reduceMotion === null) return;
    if (reduceMotion || videoErrored) {
      reveal(true);
    } else if (firstFrameReady) {
      reveal(false);
    }
  }, [catalogLoading, reduceMotion, firstFrameReady, videoErrored, reveal]);

  // Safety net: if the catalog has settled but the video never reaches a
  // first frame (or an error) within 3s, don't wait on it any longer.
  useEffect(() => {
    if (catalogLoading) return;
    const timer = setTimeout(() => {
      if (!revealed.current) {
        report("Video splash timed out before a first frame", {
          scope: "video_splash",
        });
        reveal(true);
      }
    }, VIDEO_TIMEOUT_MS);
    revealTimeoutRef.current = timer;
    return () => clearTimeout(timer);
  }, [catalogLoading, reveal]);

  if (appReady) return children;
  if (reduceMotion) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        onFirstFrameRender={() => setFirstFrameReady(true)}
      />
    </View>
  );
}
