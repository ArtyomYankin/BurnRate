import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useGame } from "../game/store";
import { useAudioStore } from "../audio";
import { LAST_ROUND_IDX } from "../core/rounds";
import { colors, fonts, PIXEL } from "./theme";
import { useStrings } from "../core/i18n";
import {
  cancelScheduledReturn,
  requestPushPermission,
  scheduleReengagement,
} from "../game/notifications";

/**
 * Settings menu — port of design v12 SettingsModal. Sections:
 *
 *   1. Sound FX toggle (sage swatch) — wired to audioStore.sfxMuted
 *   2. Music toggle (terracotta swatch) — wired to audioStore.musicEnabled
 *   3. Language switcher — EN + DE (full localization wired through i18n).
 *   4. Restart row — wipe save + fresh seed (two-tap confirm).
 *
 * Sits at the App root, shown when settingsOpen state is true (controlled
 * by the gear button in HomeScreen). The earlier Notifications section
 * (status indicator + Enable button) was removed — push opt-in still happens
 * via the auto PushOptInModal flow on session 3+, but Settings is now
 * focused on the player's day-to-day audio/language/restart controls.
 */
interface Props {
  visible: boolean;
  onClose(): void;
}

const LANGS = [
  { code: "EN", name: "English" },
  { code: "DE", name: "Deutsch" },
  { code: "PL", name: "Polski" },
];

export function SettingsModal({ visible, onClose }: Props) {
  const language = useGame((s) => s.account.language ?? "EN");
  const setLanguage = useGame((s) => s.setLanguage);
  const restartGame = useGame((s) => s.restartGame);
  // "Raise a new seed" is gated behind actually CLOSING the finale — being
  // on AGI Singularity isn't enough, the player must have crossed the
  // threshold at least once (prestige from LAST_ROUND_IDX ⇒ totalPrestiges
  // becomes LAST_ROUND_IDX + 1 = 10). Rationale: restart is a "new game+"
  // choice, and it only makes narrative + design sense after the player
  // has seen the ending. Two-tap confirm still gates the destructive
  // action so a mis-hit post-finale can't nuke progress either.
  const totalPrestiges = useGame((s) => s.persistent.totalPrestiges);
  const canRestart = totalPrestiges > LAST_ROUND_IDX;
  const sfxMuted = useAudioStore((s) => s.sfxMuted);
  const toggleSfx = useAudioStore((s) => s.toggleSfx);
  const musicEnabled = useAudioStore((s) => s.musicEnabled);
  const toggleMusic = useAudioStore((s) => s.toggleMusic);
  // Notifications toggle — reads pushOptedIn from persisted account
  // state. Turning ON runs the iOS permission ask (idempotent if already
  // granted) and immediately seeds the 4-slot re-engagement queue so the
  // next backgrounding fires nudges without needing a full app cycle.
  // Turning OFF wipes the queue and clears the opted-in flag so no
  // future backgrounding schedules more.
  const pushOptedIn = useGame((s) => s.account.pushOptedIn);
  const recordPushPromptResult = useGame((s) => s.recordPushPromptResult);
  const toggleNotifications = React.useCallback(async () => {
    if (pushOptedIn) {
      recordPushPromptResult(false);
      await cancelScheduledReturn().catch(() => {});
      return;
    }
    const granted = await requestPushPermission().catch(() => false);
    recordPushPromptResult(granted);
    if (granted) {
      // Seed the queue so the very next backgrounding kicks off nudges.
      await scheduleReengagement(useGame.getState()).catch(() => {});
    }
  }, [pushOptedIn, recordPushPromptResult]);

  const [confirmRestart, setConfirmRestart] = React.useState(false);

  const t = useStrings();
  const L = { ...t.settings, on: t.common.on, off: t.common.off, done: t.common.done };
  // Sound is "on" when NOT muted — invert sfxMuted for the toggle.
  const soundOn = !sfxMuted;

  const rows = [
    {
      key: "sound" as const,
      label: L.sound,
      sub: L.soundSub,
      color: colors.sage,
      on: soundOn,
      onToggle: toggleSfx,
    },
    {
      key: "music" as const,
      label: L.music,
      sub: L.musicSub,
      color: colors.terracotta,
      on: musicEnabled,
      onToggle: toggleMusic,
    },
    {
      key: "notifications" as const,
      label: L.notifications,
      sub: L.notificationsSub,
      color: colors.gold,
      on: pushOptedIn,
      onToggle: toggleNotifications,
    },
  ];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerSwatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.headerTitle}>{L.title.toUpperCase()}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          </View>

          {/* Toggle rows */}
          <View style={styles.rows}>
            {rows.map((r) => (
              <Pressable
                key={r.key}
                style={[
                  styles.row,
                  { borderColor: r.on ? r.color : colors.cream_4 },
                ]}
                onPress={r.onToggle}
              >
                <View
                  style={[
                    styles.rowSwatch,
                    { backgroundColor: r.on ? r.color : colors.cream_2 },
                  ]}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  {/* numberOfLines={1} so a long localized string (German
                      'Klicks, Münzen, Summen' wraps on narrow screens) can't
                      push the row from 48px to 62px and shift the whole modal
                      below. Truncates with ellipsis if it doesn't fit. */}
                  <Text style={styles.rowLabel} numberOfLines={1}>{r.label}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{r.sub}</Text>
                </View>
                <PixelToggle on={r.on} color={r.color} labelOn={L.on} labelOff={L.off} />
              </Pressable>
            ))}
          </View>

          {/* Language switcher */}
          <View style={styles.langSection}>
            <View style={styles.langHeader}>
              <Text style={styles.langHeaderText}>🌐  {L.lang.toUpperCase()}</Text>
              <View style={styles.langHeaderRule} />
            </View>
            <View style={styles.langGrid}>
              {LANGS.map((lng) => {
                const active = language === lng.code;
                return (
                  <Pressable
                    key={lng.code}
                    onPress={() => setLanguage(lng.code)}
                    style={[
                      styles.langBtn,
                      {
                        backgroundColor: active ? colors.sage : colors.cream,
                        // Keep borderWidth constant so the inner content
                        // doesn't shift by 1px when switching active state.
                        borderColor: active ? colors.ink : colors.cream_4,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.langName,
                        { color: active ? colors.cream_hi : colors.ink },
                      ]}
                      numberOfLines={1}
                    >
                      {lng.name}
                    </Text>
                    <Text
                      style={[
                        styles.langCode,
                        { color: active ? colors.cream_hi : colors.muted },
                      ]}
                    >
                      {lng.code}
                    </Text>
                    {active && <Text style={styles.langCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Restart row — wipe save + fresh seed. Two-step (tap once to
              arm, tap "Yes" to confirm) so a misclick can't nuke a long run.
              Hidden entirely before the finale — see canRestart above. */}
          {canRestart && <View style={styles.restartSection}>
            {confirmRestart ? (
              <View style={styles.restartConfirmRow}>
                <Text style={styles.restartConfirmText}>{L.restartConfirm}</Text>
                <View style={styles.restartConfirmBtns}>
                  <Pressable
                    style={[styles.restartBtn, { backgroundColor: colors.cream_2 }]}
                    onPress={() => setConfirmRestart(false)}
                  >
                    <Text style={[styles.restartBtnText, { color: colors.ink }]}>{L.restartNo.toUpperCase()}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.restartBtn, { backgroundColor: colors.tensionRed }]}
                    onPress={() => {
                      setConfirmRestart(false);
                      onClose();
                      restartGame();
                    }}
                  >
                    <Text style={[styles.restartBtnText, { color: colors.cream_hi }]}>{L.restartYes.toUpperCase()}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={styles.restartTrigger}
                onPress={() => setConfirmRestart(true)}
              >
                <Text style={styles.restartTriggerText}>↻ {L.restart.toUpperCase()}</Text>
              </Pressable>
            )}
          </View>}

          {/* Footer — Done button */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneText}>{L.done.toUpperCase()}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── PixelToggle — sliding pixel-style switch ───────────────────────────
function PixelToggle({
  on,
  color,
  labelOn,
  labelOff,
}: {
  on: boolean;
  color: string;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <View
      style={[
        toggleStyles.track,
        { backgroundColor: on ? color : colors.cream_2 },
      ]}
    >
      <View
        style={[
          toggleStyles.knob,
          { left: on ? 30 : 2 },
        ]}
      />
      <Text
        style={[
          toggleStyles.label,
          on
            ? { left: 6, color: colors.cream_hi }
            : { right: 6, color: colors.muted },
        ]}
      >
        {on ? labelOn : labelOff}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,26,26,0.50)",
    // Anchored near the top instead of vertically centered: when the language
    // changes the sheet's intrinsic height shifts (different text length per
    // locale), and a centered modal recomputes its origin → visible "jump."
    // A fixed top inset means the sheet just grows/shrinks downward.
    paddingTop: 120,
    paddingHorizontal: 14,
  },
  sheet: {
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cream,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  headerSwatch: { width: 10, height: 10 },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 2,
  },
  closeX: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    color: colors.muted,
    lineHeight: 22,
    paddingHorizontal: 6,
  },
  rows: {
    flexDirection: "column",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    // Fixed height (not minHeight) so language switches can't grow the row
    // even when sub-text would have wrapped. Combined with numberOfLines={1}
    // above this guarantees the sheet stays the same total height.
    height: 56,
    borderWidth: 1,
    backgroundColor: colors.cream,
  },
  rowSwatch: { width: 30, height: 30 },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 16,
  },
  rowSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  langSection: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  langHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  langHeaderText: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  langHeaderRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cream_4,
    marginLeft: 4,
  },
  langGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  langBtn: {
    // EN + DE + PL — 3 columns. flex:1 in the row's flexWrap container
    // would not split cleanly, so go with a percent that leaves room for
    // the 6px gap. 31.3% × 3 + 2×6px gap ≈ 100% of available width.
    width: "31.3%",
    height: 50, // fixed, not minHeight — language switches must not resize the grid
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cream_4,
    position: "relative",
  },
  langName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 13,
  },
  langCode: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    marginTop: 2,
    letterSpacing: 1,
  },
  langCheck: {
    position: "absolute",
    top: 2,
    right: 4,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: colors.cream_hi,
  },
  restartSection: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  restartTrigger: {
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cream_4,
    backgroundColor: colors.cream_hi,
  },
  restartTriggerText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  restartConfirmRow: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.tensionRed,
    backgroundColor: "#FCE6E8",
    gap: 6,
  },
  restartConfirmText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.tensionRed,
    textAlign: "center",
  },
  restartConfirmBtns: {
    flexDirection: "row",
    gap: 6,
  },
  restartBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ink,
  },
  restartBtnText: {
    fontFamily: fonts.display,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  footer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  doneBtn: {
    backgroundColor: colors.ink,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  doneText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.cream_hi,
    letterSpacing: 2,
  },
});

const toggleStyles = StyleSheet.create({
  track: {
    position: "relative",
    width: 56,
    height: 26,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  knob: {
    position: "absolute",
    top: 2,
    bottom: 2,
    width: 22,
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  label: {
    position: "absolute",
    top: 0,
    bottom: 0,
    fontFamily: fonts.display,
    fontSize: 7,
    letterSpacing: 1,
    textAlignVertical: "center",
    lineHeight: 26,
  },
});
