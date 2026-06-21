import React from "react";
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useGame } from "../game/store";
import { useAudioStore } from "../audio";
import {
  getNotificationPermissionStatus,
  NotifPermStatus,
  requestPushPermission,
  sendTestNotification,
} from "../game/notifications";
import { colors, fonts, PIXEL } from "./theme";

/**
 * Settings menu — port of design v12 SettingsModal. Three sections:
 *
 *   1. Sound FX toggle (sage swatch) — wired to audioStore.sfxMuted
 *   2. Music toggle (terracotta swatch) — wired to audioStore.musicEnabled
 *   3. Language switcher — 6 options, only EN actually wired (others are
 *      i18n stubs per GDD §12 — the switcher persists the pick so the
 *      menu feels real even though the rest of the UI stays English).
 *
 * Sits at the App root, shown when settingsOpen state is true (controlled
 * by the gear button in HomeScreen). Per Pillar 1 — settings persist across
 * launches via the save schema (language) + audioStore (sound/music kept
 * in-memory only for now; that's a known limitation).
 */
interface Props {
  visible: boolean;
  onClose(): void;
}

// Localized strings per design. Only one screen worth — the rest of the
// app stays in English regardless of selection (TODO: full i18n pass).
const I18N: Record<string, {
  title: string; sound: string; soundSub: string; music: string; musicSub: string;
  lang: string; done: string; on: string; off: string;
  restart: string; restartConfirm: string; restartYes: string; restartNo: string;
  notifSection: string; notifEnable: string; notifTest: string;
  notifGranted: string; notifDenied: string; notifAsk: string; notifSentToast: string;
}> = {
  EN: { title: "Settings", sound: "Sound FX", soundSub: "Clicks, coins, machine hum",
        music: "Music", musicSub: "Ambient chiptune score",
        lang: "Language", done: "Done", on: "ON", off: "OFF",
        restart: "Raise a new seed", restartConfirm: "Wipe save and start over?",
        restartYes: "Yes, restart", restartNo: "Cancel",
        notifSection: "Notifications", notifEnable: "Enable push reminders",
        notifTest: "Send test push (5s)",
        notifGranted: "Enabled", notifDenied: "Blocked — open iOS Settings",
        notifAsk: "Not yet enabled", notifSentToast: "Scheduled — fires in 5s" },
  ES: { title: "Ajustes", sound: "Efectos", soundSub: "Clics, monedas, zumbido",
        music: "Música", musicSub: "Banda chiptune ambiental",
        lang: "Idioma", done: "Hecho", on: "SÍ", off: "NO",
        restart: "Nueva semilla", restartConfirm: "¿Borrar y empezar de nuevo?",
        restartYes: "Sí, reiniciar", restartNo: "Cancelar",
        notifSection: "Notificaciones", notifEnable: "Activar recordatorios",
        notifTest: "Enviar push de prueba (5s)",
        notifGranted: "Activadas", notifDenied: "Bloqueadas — abre Ajustes",
        notifAsk: "No activadas", notifSentToast: "Programado — llega en 5s" },
  FR: { title: "Réglages", sound: "Effets", soundSub: "Clics, pièces, bourdon",
        music: "Musique", musicSub: "Fond chiptune ambiant",
        lang: "Langue", done: "Terminé", on: "OUI", off: "NON",
        restart: "Nouvelle graine", restartConfirm: "Effacer et recommencer ?",
        restartYes: "Oui, recommencer", restartNo: "Annuler",
        notifSection: "Notifications", notifEnable: "Activer les rappels",
        notifTest: "Envoyer un test (5s)",
        notifGranted: "Activées", notifDenied: "Bloquées — ouvre Réglages",
        notifAsk: "Pas encore activées", notifSentToast: "Programmé — dans 5s" },
  DE: { title: "Einstellungen", sound: "Soundeffekte", soundSub: "Klicks, Münzen, Summen",
        music: "Musik", musicSub: "Ambient-Chiptune",
        lang: "Sprache", done: "Fertig", on: "AN", off: "AUS",
        restart: "Neue Seed-Runde", restartConfirm: "Spielstand löschen?",
        restartYes: "Ja, neustarten", restartNo: "Abbrechen",
        notifSection: "Benachrichtigungen", notifEnable: "Erinnerungen aktivieren",
        notifTest: "Test-Push senden (5s)",
        notifGranted: "Aktiviert", notifDenied: "Blockiert — iOS-Einstellungen",
        notifAsk: "Noch nicht aktiviert", notifSentToast: "Geplant — in 5s" },
  JA: { title: "設定", sound: "効果音", soundSub: "クリック・コイン・駆動音",
        music: "音楽", musicSub: "アンビエント・チップチューン",
        lang: "言語", done: "完了", on: "ON", off: "OFF",
        restart: "シードからやり直し", restartConfirm: "セーブを消去して再開？",
        restartYes: "はい、再起動", restartNo: "キャンセル",
        notifSection: "通知", notifEnable: "通知を有効にする",
        notifTest: "テスト通知 (5秒)",
        notifGranted: "有効", notifDenied: "ブロック中 — 設定を開く",
        notifAsk: "未設定", notifSentToast: "5秒後に届きます" },
  ZH: { title: "设置", sound: "音效", soundSub: "点击、金币、机器嗡鸣",
        music: "音乐", musicSub: "环境芯片音乐",
        lang: "语言", done: "完成", on: "开", off: "关",
        restart: "重新开始", restartConfirm: "清除存档并重新开始?",
        restartYes: "是的，重新开始", restartNo: "取消",
        notifSection: "通知", notifEnable: "启用提醒",
        notifTest: "发送测试通知 (5秒)",
        notifGranted: "已启用", notifDenied: "已阻止 — 打开 iOS 设置",
        notifAsk: "未启用", notifSentToast: "5秒后送达" },
};

const LANGS = [
  { code: "EN", name: "English" },
  { code: "ES", name: "Español" },
  { code: "FR", name: "Français" },
  { code: "DE", name: "Deutsch" },
  { code: "JA", name: "日本語" },
  { code: "ZH", name: "中文" },
];

export function SettingsModal({ visible, onClose }: Props) {
  const language = useGame((s) => s.account.language ?? "EN");
  const setLanguage = useGame((s) => s.setLanguage);
  const restartGame = useGame((s) => s.restartGame);
  const sfxMuted = useAudioStore((s) => s.sfxMuted);
  const toggleSfx = useAudioStore((s) => s.toggleSfx);
  const musicEnabled = useAudioStore((s) => s.musicEnabled);
  const toggleMusic = useAudioStore((s) => s.toggleMusic);

  const [confirmRestart, setConfirmRestart] = React.useState(false);

  // Live notification permission status — refreshed every time the modal
  // opens so we reflect the current iOS state even if the player just
  // toggled it in iOS Settings.
  const recordPushPrompt = useGame((s) => s.recordPushPromptResult);
  const [notifStatus, setNotifStatus] = React.useState<NotifPermStatus>("undetermined");
  const [testToast, setTestToast] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!visible) return;
    getNotificationPermissionStatus().then(setNotifStatus);
  }, [visible]);

  const L = I18N[language] ?? I18N.EN;
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

          {/* Notifications — status + Enable / Test buttons. Exists so the
              player can verify the push pipeline works without waiting 22h
              for the real re-engagement scheduler, and so they have a way
              to manually grant permission if they missed the auto-prompt. */}
          <View style={styles.notifSection}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifHeaderText}>🔔  {L.notifSection.toUpperCase()}</Text>
              <View style={styles.notifHeaderRule} />
            </View>
            <Pressable
              style={styles.notifStatusRow}
              onPress={() => {
                if (notifStatus === "denied") Linking.openSettings();
              }}
            >
              <View
                style={[
                  styles.notifStatusDot,
                  {
                    backgroundColor:
                      notifStatus === "granted" ? colors.sage_2 :
                      notifStatus === "denied"  ? colors.tensionRed :
                      colors.muted,
                  },
                ]}
              />
              <Text style={styles.notifStatusText}>
                {notifStatus === "granted" ? L.notifGranted
                  : notifStatus === "denied" ? L.notifDenied + " ›"
                  : L.notifAsk}
              </Text>
            </Pressable>
            {notifStatus !== "granted" && (
              <Pressable
                style={styles.notifBtn}
                onPress={async () => {
                  const ok = await requestPushPermission();
                  recordPushPrompt(ok);
                  setNotifStatus(ok ? "granted" : "denied");
                }}
              >
                <Text style={styles.notifBtnText}>{L.notifEnable.toUpperCase()}</Text>
              </Pressable>
            )}
            {notifStatus === "granted" && (
              <Pressable
                style={[styles.notifBtn, { backgroundColor: colors.cream_2 }]}
                onPress={async () => {
                  const res = await sendTestNotification();
                  if (res.ok) {
                    Alert.alert(
                      "Test scheduled",
                      `Notification fires in 5 seconds.\n\nIf you don't see it:\n• Check iOS Focus / Do Not Disturb is off\n• Make sure Settings → BurnRate → Notifications → "Banners" is enabled\n• The phone may show it in the Notification Center only (swipe down from top)\n\nScheduled id: ${res.scheduledId.slice(0, 8)}…`,
                      [{ text: "OK" }],
                    );
                  } else if (res.reason === "denied") {
                    Alert.alert(
                      "Permission denied",
                      `iOS is blocking notifications.\n\nFix: open iOS Settings → BurnRate → Notifications → toggle Allow Notifications.\n\nDetail: ${res.detail}`,
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Open iOS Settings", onPress: () => Linking.openSettings() },
                      ],
                    );
                  } else if (res.reason === "no_native") {
                    Alert.alert("Native module missing", res.detail);
                  } else {
                    Alert.alert("Scheduling failed", res.detail);
                  }
                }}
              >
                <Text style={[styles.notifBtnText, { color: colors.ink }]}>{L.notifTest.toUpperCase()}</Text>
              </Pressable>
            )}
            {testToast && (
              <Text style={styles.notifToast}>{testToast}</Text>
            )}
          </View>

          {/* Restart row — wipe save + fresh seed. Two-step (tap once to
              arm, tap "Yes" to confirm) so a misclick can't nuke a long run. */}
          <View style={styles.restartSection}>
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
          </View>

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
    width: "31.3%", // 3 columns w/ 6px gap
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
  notifSection: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 6,
  },
  notifHeaderText: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  notifHeaderRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cream_4,
    marginLeft: 4,
  },
  notifStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  notifStatusDot: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  notifStatusText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
    flex: 1,
  },
  notifBtn: {
    marginTop: 6,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  notifBtnText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.ink,
    letterSpacing: 1.5,
  },
  notifToast: {
    marginTop: 6,
    paddingVertical: 6,
    textAlign: "center",
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.sage_2,
    backgroundColor: colors.cream_2,
    borderLeftWidth: 2,
    borderLeftColor: colors.sage_2,
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
