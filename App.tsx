import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, SafeAreaView, StyleSheet } from "react-native";
import { freshSave } from "./src/core/save";
import { initStorage, loadSave, saveSave } from "./src/game/persistence";
import { startTickEngine } from "./src/game/tickEngine";
import { useGame } from "./src/game/store";
import { AllocateScreen } from "./src/ui/AllocateScreen";
import { DebtEventModal } from "./src/ui/DebtEventModal";
import { HomeScreen } from "./src/ui/HomeScreen";
import { Onboarding } from "./src/ui/Onboarding";
import { PrestigeModal } from "./src/ui/PrestigeModal";
import { ProducersScreen } from "./src/ui/ProducersScreen";
import { ResearchScreen } from "./src/ui/ResearchScreen";
import { TrainingRunModal } from "./src/ui/TrainingRunModal";
import { colors } from "./src/ui/theme";
import { ChainId } from "./src/core/types";

type Screen = "home" | "producers" | "allocate" | "research";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [producersChain, setProducersChain] = useState<ChainId | undefined>(undefined);
  const [prestigeOpen, setPrestigeOpen] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const hydrated = useGame((s) => s.hydrated);
  const hydrate = useGame((s) => s.hydrate);
  const applyOffline = useGame((s) => s.applyOfflineCatchup);
  const toSaveBlob = useGame((s) => s.toSaveBlob);
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
      stopTick = startTickEngine();
    })();
    return () => {
      cancelled = true;
      stopTick?.();
    };
  }, [hydrate, applyOffline]);

  // Persist on backgrounding, refresh offline catchup on foregrounding.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appState.current;
      appState.current = next;
      if (next === "active" && prev !== "active") {
        applyOffline();
      }
      if (next.match(/inactive|background/) && prev === "active") {
        saveSave(toSaveBlob()).catch(() => {});
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

  return (
    <SafeAreaView style={styles.root}>
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
        />
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
      <Onboarding />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
});
