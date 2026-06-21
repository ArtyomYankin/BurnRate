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
import { VignettesInbox } from "./src/ui/VignettesInbox";
import { PushOptInModal } from "./src/ui/PushOptInModal";
import { EndgameModal } from "./src/ui/EndgameModal";
import { colors } from "./src/ui/theme";
import { ChainId } from "./src/core/types";
import { cancelScheduledReturn, scheduleReengagement } from "./src/game/notifications";

type Screen = "home" | "producers" | "allocate" | "research" | "vignettes" | "achievements";

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
          onOpenResearch={() => setScreen("research")}
          onOpenTraining={() => setTrainingOpen(true)}
          onOpenPrestige={() => setPrestigeOpen(true)}
          onOpenVignettes={() => setScreen("vignettes")}
          onOpenAchievements={() => setScreen("achievements")}
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
