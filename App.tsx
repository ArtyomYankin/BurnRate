import { StatusBar } from "expo-status-bar";
import { useFonts, PixelifySans_400Regular, PixelifySans_500Medium, PixelifySans_600SemiBold, PixelifySans_700Bold } from "@expo-google-fonts/pixelify-sans";

// Splash dismissal is handled by the OS via the legacy `splash` field in
// app.json (LaunchScreen.storyboard generated at native build time). It
// auto-dismisses on first React paint — no JS code needed.
import { Silkscreen_400Regular, Silkscreen_700Bold } from "@expo-google-fonts/silkscreen";
import { VT323_400Regular } from "@expo-google-fonts/vt323";
import React, { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { freshSave } from "./src/core/save";
import { initStorage, loadSave, saveSave } from "./src/game/persistence";
import { startTickEngine } from "./src/game/tickEngine";
import { useGame } from "./src/game/store";
import { AllocateScreen } from "./src/ui/AllocateScreen";
import { DebtEventModal } from "./src/ui/DebtEventModal";
import { HomeScreen } from "./src/ui/HomeScreen";
import { IntroModal } from "./src/ui/IntroModal";
import { PrestigeModal } from "./src/ui/PrestigeModal";
import { ProducersScreen } from "./src/ui/ProducersScreen";
import { AchievementsScreen } from "./src/ui/AchievementsScreen";
import { ResearchScreen } from "./src/ui/ResearchScreen";
import { TrainingRunModal } from "./src/ui/TrainingRunModal";
import { TutorialSpotlight } from "./src/ui/TutorialSpotlight";
import { VignettesInbox } from "./src/ui/VignettesInbox";
import { PushOptInModal } from "./src/ui/PushOptInModal";
import { EndgameModal } from "./src/ui/EndgameModal";
import { colors } from "./src/ui/theme";
import { ChainId } from "./src/core/types";
import { cancelScheduledReturn, scheduleReengagement } from "./src/game/notifications";
import * as audio from "./src/audio";
import { preloadAll as preloadAudio, useAudioStore } from "./src/audio";

type Screen = "home" | "producers" | "allocate" | "research" | "vignettes" | "achievements";

/** Auto-advance the forced-walkthrough onboarding chain when the player opens
 *  the panel that the current force step was pointing at. No-op if the
 *  player is past or before the matching step (so re-opens later in the
 *  game don't reset the tutorial). */
function advanceOnboardingFromForceStep(expectedStep: number) {
  const s = useGame.getState();
  if (s.account.onboardingStep === expectedStep) {
    s.setOnboardingStep(expectedStep + 1);
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PixelifySans_400Regular,
    PixelifySans_500Medium,
    PixelifySans_600SemiBold,
    PixelifySans_700Bold,
    Silkscreen_400Regular,
    Silkscreen_700Bold,
    VT323_400Regular,
  });
  const [screen, setScreen] = useState<Screen>("home");
  const [producersChain, setProducersChain] = useState<ChainId | undefined>(undefined);
  // Forced-tutorial chain lock: during onboarding steps 2 & 3 we restrict
  // the ProducersScreen to a single chain (engineers / gpu) so the player
  // can only buy what the tutorial asked for. Subscribed reactively so
  // mid-screen step changes (e.g. buying the engineer auto-advances 2→3)
  // re-render the screen with the new lock.
  const onboardingStepLive = useGame((s) => s.account.onboardingStep);
  const lockedProducerChain: ChainId | undefined =
    onboardingStepLive === 2
      ? "engineers"
      : onboardingStepLive === 3
      ? "gpu"
      : undefined;
  // Auto-return to home when a forced-tutorial step finishes while the
  // player is on ProducersScreen. The store auto-advances 2→3 on engineer
  // buy and 3→4 on GPU buy; in both cases we pop back so the next scene
  // pulse (or explainer) is visible. Guarded on PREVIOUS step being 2 or 3
  // so we only pop when actually transitioning out of a forced step —
  // veteran players (always past step 3) never trigger this.
  const screenRef = useRef(screen);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);
  const prevStepRef = useRef(onboardingStepLive);
  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = onboardingStepLive;
    if (prev === onboardingStepLive) return;
    const curScreen = screenRef.current;
    // Force steps + their owning screens. When a force-step finishes (the
    // player completed the required action), pop back to home so the next
    // tutorial chip/spotlight is visible.
    // Only auto-back when the action that advances the step does NOT
    // itself navigate away. Steps 5 (save() calls onBack), 9 (player
    // browses Research, taps back manually) and 11 (Achievements, view-
    // only) are excluded — auto-back there would flash the screen for one
    // frame before bouncing home.
    const popMap: Record<number, Screen> = {
      2: "producers",
      3: "producers",
      10: "vignettes",
    };
    if (popMap[prev] === curScreen) {
      setScreen("home");
    }
  }, [onboardingStepLive]);
  const [prestigeOpen, setPrestigeOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const hydrated = useGame((s) => s.hydrated);
  const hydrate = useGame((s) => s.hydrate);
  const applyOffline = useGame((s) => s.applyOfflineCatchup);
  const toSaveBlob = useGame((s) => s.toSaveBlob);
  const incrementSessionsStarted = useGame((s) => s.incrementSessionsStarted);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Boot: init storage, hydrate state, apply offline catchup, start ticker.
  useEffect(() => {
    let stopTick: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        await initStorage();
        const save = await loadSave();
        if (cancelled) return;
        hydrate(save);
        applyOffline();
      } catch {
        // Refused-load (e.g. newer schema) — start fresh rather than crash for M0.
        hydrate(freshSave());
      }
      // Sync persisted audio preferences into the in-memory AudioStore.
      // Direct set() skips the write-back-to-AccountState side effect that
      // setSfxMuted/setMusicEnabled would trigger.
      const acct = useGame.getState().account;
      useAudioStore.setState({
        sfxMuted: acct.sfxMuted,
        musicEnabled: acct.musicEnabled,
      });
      // Eagerly preload all SFX + music players so the first music-on toggle
      // doesn't sit silent for a couple of seconds while expo-audio loads
      // the file (the bug the player reported on iOS).
      preloadAudio();
      // Kick the music engine post-hydration. HomeScreen's setMusicForRound
      // effect runs BEFORE the save finishes loading (HomeScreen mounts on
      // first paint, save load is async), so it sees the default
      // musicEnabled=false and never starts playback — even for saves with
      // music persisted as on. Re-fire with the loaded round + audio prefs
      // so a tablet user who had music enabled previously actually hears it.
      if (acct.musicEnabled) {
        const roundIdx = useGame.getState().run.fundingRoundIdx;
        audio.setMusicForRound(roundIdx);
      }
      // GDD §12 — count this launch toward the session threshold and cancel
      // any scheduled re-engagement ping (we're here, no need to nag).
      incrementSessionsStarted();
      cancelScheduledReturn().catch(() => {});
      stopTick = startTickEngine();
    })();
    return () => {
      cancelled = true;
      stopTick?.();
    };
  }, [hydrate, applyOffline, incrementSessionsStarted]);

  // Persist on backgrounding, refresh offline catchup on foregrounding,
  // and (re)schedule the personalized re-engagement notification.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;
      if (next === "active" && prev !== "active") {
        applyOffline();
        cancelScheduledReturn().catch(() => {});
      }
      if (next.match(/inactive|background/) && prev === "active") {
        saveSave(toSaveBlob()).catch(() => {});
        scheduleReengagement(useGame.getState()).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [applyOffline, toSaveBlob]);

  // Also persist on a slow interval as a safety net.
  useEffect(() => {
    if (!hydrated) return;
    const id = setInterval(() => {
      saveSave(toSaveBlob()).catch(() => {});
    }, 15_000);
    return () => clearInterval(id);
  }, [hydrated, toSaveBlob]);

  // No font-gate: render immediately. Fonts pop in when they load (brief
  // system-font flash for the first frame). Splash auto-dismisses on first
  // paint via the legacy native LaunchScreen.storyboard.
  void fontsLoaded;

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.root} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" />
      {screen === "home" && (
        <HomeScreen
          onOpenProducers={(chain) => {
            setProducersChain(chain);
            setScreen("producers");
          }}
          onOpenAllocate={() => setScreen("allocate")}
          onOpenResearch={() => {
            setScreen("research");
            // Step 9 advances on open (view-only), not on buying a node —
            // first prestige can leave the player with 0 Equity and we
            // don't want to deadlock the tutorial.
            advanceOnboardingFromForceStep(9);
          }}
          onOpenTraining={() => setTrainingOpen(true)}
          onOpenPrestige={() => setPrestigeOpen(true)}
          onOpenVignettes={() => setScreen("vignettes")}
          onOpenAchievements={() => {
            setScreen("achievements");
            // Step 11 (Open ACHIEVEMENTS) is view-only — there's no
            // meaningful action on the screen, so the advance fires on
            // screen-open. Steps 5 and 10 advance from inside their
            // action handlers (setAllocation / markVignetteRead).
            advanceOnboardingFromForceStep(11);
          }}
        />
      )}
      {screen === "vignettes" && (
        <VignettesInbox onBack={() => setScreen("home")} />
      )}
      {screen === "achievements" && (
        <AchievementsScreen onBack={() => setScreen("home")} />
      )}
      {screen === "producers" && (
        <ProducersScreen
          onBack={() => setScreen("home")}
          defaultChain={producersChain}
          lockedChain={lockedProducerChain}
        />
      )}
      {screen === "allocate" && (
        <AllocateScreen onBack={() => setScreen("home")} />
      )}
      {screen === "research" && (
        <ResearchScreen onBack={() => setScreen("home")} />
      )}
      <PrestigeModal
        visible={prestigeOpen}
        onClose={() => setPrestigeOpen(false)}
      />
      <TrainingRunModal
        visible={trainingOpen}
        onClose={() => setTrainingOpen(false)}
      />
      <DebtEventModal />
      <IntroModal />
      <PushOptInModal />
      <EndgameTrigger />
      {/* Forced-walkthrough overlay. Renders nothing for non-force steps;
          for steps 5/10/11 it dims the screen and only lets the highlighted
          control receive taps. The action prop wires the in-hole tap
          forwarder (Modal absorbs taps even in the "uncovered" hole, so
          we route them explicitly). */}
      <TutorialSpotlight
        actions={{
          "alloc-bar": () => setScreen("allocate"),
          "slack-btn": () => setScreen("vignettes"),
          "ach-btn": () => {
            setScreen("achievements");
            advanceOnboardingFromForceStep(11);
          },
        }}
      />
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

/**
 * Mounts the EndgameModal when the store flips `endgameOpen` to true (set by
 * prestige() the first time the player closes the AGI Singularity round).
 * Lives in its own component so the store selector only re-renders this leaf
 * and not the whole App tree on the flag's transitions.
 */
function EndgameTrigger() {
  const open = useGame((s) => s.endgameOpen);
  const dismiss = useGame((s) => s.dismissEndgame);
  const restart = useGame((s) => s.restartGame);
  return (
    <EndgameModal
      visible={open}
      onStayWatch={dismiss}
      onRaiseNewSeed={restart}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
});
