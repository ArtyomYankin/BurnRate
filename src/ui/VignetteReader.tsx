import React from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Vignette } from "../core/vignettes";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  vignette: Vignette | null;
  onClose(): void;
  /** GDD §4 Beat 3: Slack reply picker. Called with the reply index when
   *  the player taps a chip that has a `replyEffects` entry. The reader
   *  hands off to the store, which applies the effect and closes the modal. */
  onResolve?(replyIdx: number): void;
  /** Index of the previously picked reply if this vignette is already
   *  resolved. SlackView renders chips disabled and ticks the chosen one. */
  resolvedReplyIdx?: number;
}

/**
 * Fullscreen vignette reader — GDD §15 "Vignette overlay · Full-screen
 * takeover; medium-specific template."
 *
 * The reader dispatches to one of 7 inner views by medium. Each view is a
 * faithful *pastiche* of the real product (Slack / X / Gmail / TechCrunch /
 * podcast transcript / corp board doc / terminal log) — explicitly NOT pixel
 * art, per GDD §13: "the comedy lives in the 'fake productivity tool'
 * moments — vignette overlays that look like real Slack, real Notion."
 *
 * System fonts (system-ui / Georgia / VT323-mono) are used inside the medium
 * frame; the surrounding chrome stays in the game's pixel language so the
 * player remembers they're still in Burn Rate.
 */
export function VignetteReader({ vignette, onClose, onResolve, resolvedReplyIdx }: Props) {
  // Absolute-positioned overlays don't inherit safe-area from the app-level
  // SafeAreaView, so we pull the insets ourselves and push the frame's top /
  // bottom in by the actual notch + home-indicator distance. Without this the
  // × close button can sit under the dynamic island on iPhone 14 Pro+.
  const insets = useSafeAreaInsets();
  if (!vignette) return null;
  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[
        styles.frame,
        { top: insets.top + 8, bottom: insets.bottom + 8 },
      ]}>
        {/* Game-chrome topbar — close button + tiny "vignette" label so the
            player can tell the reader apart from the live OS notification it
            mimics. */}
        <View style={styles.chrome}>
          <Text style={styles.chromeLabel}>BURN·RATE · VIGNETTE</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.chromeClose}>
            <Text style={styles.chromeCloseText}>×</Text>
          </Pressable>
        </View>
        {/* Medium-specific content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
        >
          {renderByMedium(vignette, { onClose, onResolve, resolvedReplyIdx })}
        </ScrollView>
      </View>
    </View>
  );
}

interface InnerProps {
  onClose(): void;
  onResolve?(replyIdx: number): void;
  resolvedReplyIdx?: number;
}

function renderByMedium(v: Vignette, p: InnerProps): React.ReactNode {
  switch (v.medium) {
    case "slack":        return <SlackView v={v} {...p} />;
    case "leaked_email": return <EmailView v={v} />;
    case "board_memo":   return <BoardMemoView v={v} />;
    case "fake_tweet":   return <TweetView v={v} />;
    case "fake_news":    return <NewsView v={v} />;
    case "podcast":      return <PodcastView v={v} />;
    case "system":       return <SystemView v={v} />;
  }
}

// ─── Helper: short fake "now" timestamp ───────────────────────────────────
// Stand-in until firedAt lands in PersistentState. Locale-aware short time.
function nowShort(): string {
  const d = new Date();
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// ─── SLACK ────────────────────────────────────────────────────────────────
// Straight port of Claude Design `screens.jsx::VignetteBody` for medium ===
// 'slack': just the message card. No workspace sidebar, no channel header
// — the design treats the vignette as a single Slack-DM fragment, the way
// a notification preview would. 18px sage avatar + name + timestamp on one
// line, body indented under, reply chips below.
function SlackView({ v, onClose, onResolve, resolvedReplyIdx }: { v: Vignette } & InnerProps) {
  const avatarInitial = v.sender.charAt(0).toUpperCase();
  const isResolved = resolvedReplyIdx !== undefined;
  const handlePick = (i: number) => {
    if (isResolved) return;
    if (v.replyEffects?.[i] && onResolve) onResolve(i);
    else onClose();
  };

  return (
    <View style={slack.outer}>
      <View style={slack.card}>
        <View style={slack.head}>
          <View style={slack.avatar}>
            <Text style={slack.avatarText}>{avatarInitial}</Text>
          </View>
          <Text style={slack.sender}>{v.sender}</Text>
          <Text style={slack.time}>{nowShort()}</Text>
        </View>
        <Text style={slack.body}>{v.body}</Text>
        {v.replies && v.replies.length > 0 && (
          <View style={slack.replies}>
            {v.replies.map((r, i) => {
              const effect = v.replyEffects?.[i];
              const picked = i === resolvedReplyIdx;
              // Spoiler rule: pre-pick we show ONLY the reply text — the
              // player has to read the message to guess buff/neutral/debuff.
              // Post-pick we reveal the resolved effect on the PICKED chip
              // (color-coded by kind: green buff / muted neutral / red debuff)
              // with a small fade+rise animation so the player notices the
              // outcome instead of wondering why the modal didn't close.
              const kind = effect?.kind ?? (effect ? "buff" : undefined);
              return (
                <Pressable
                  key={i}
                  onPress={() => handlePick(i)}
                  disabled={isResolved}
                  style={[
                    slack.replyBtn,
                    picked && slack.replyBtnPicked,
                    isResolved && !picked && slack.replyBtnDimmed,
                  ]}
                >
                  <Text
                    style={[
                      slack.replyBtnText,
                      picked && slack.replyBtnTextPicked,
                    ]}
                  >
                    {picked ? "✓ " : ""}{r}
                  </Text>
                  {picked && effect && (
                    <RevealLabel kind={kind}>→ {effect.label}</RevealLabel>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
        {isResolved && (
          <Text style={slack.resolvedNote}>You already replied.</Text>
        )}
      </View>
    </View>
  );
}

/**
 * Animated reveal label shown under a picked Slack reply chip — opacity 0 → 1
 * + translateY 8 → 0 over ~320ms. The animation runs on mount, which happens
 * the moment the player picks (since the parent re-renders with picked=true).
 * Re-opens of an already-resolved vignette re-play the animation too, which
 * is fine: it gives the same beat of "here's what you chose" each time.
 */
function RevealLabel({
  kind,
  children,
}: {
  kind: "buff" | "neutral" | "debuff" | undefined;
  children: React.ReactNode;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  const ty = React.useRef(new Animated.Value(8)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(ty,      { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [opacity, ty]);
  const color =
    kind === "buff"    ? "#1ED760" :
    kind === "debuff"  ? "#FF6B6B" :
    kind === "neutral" ? "#9B9C9F" :
    "#D1D2D3";
  return (
    <Animated.Text
      style={[slack.replyEffectHint, { color, opacity, transform: [{ translateY: ty }] }]}
    >
      {children}
    </Animated.Text>
  );
}

// ─── EMAIL (Gmail-style) ──────────────────────────────────────────────────
// Toolbar strip, header block with from/to/subject/date, body in serif-ish
// system font, single attachment indicator line at bottom for flavor.
function EmailView({ v }: { v: Vignette }) {
  return (
    <View style={email.shell}>
      <View style={email.toolbar}>
        <Text style={email.toolbarText}>← Inbox</Text>
        <View style={{ flex: 1 }} />
        <Text style={email.toolbarIcon}>⌫</Text>
        <Text style={email.toolbarIcon}>⌖</Text>
        <Text style={email.toolbarIcon}>⋯</Text>
      </View>
      <Text style={email.subject}>{v.subject ?? v.name}</Text>
      <View style={email.headerRow}>
        <View style={email.avatar}>
          <Text style={email.avatarText}>{v.sender.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={email.from}>{v.sender}</Text>
          <Text style={email.to}>to me · {nowShort()}</Text>
        </View>
        <Text style={email.star}>☆</Text>
      </View>
      <Text style={email.body}>{v.body}</Text>
      <View style={email.attachment}>
        <Text style={email.attachmentIcon}>📎</Text>
        <Text style={email.attachmentText}>lockup_period.pdf · 84 KB</Text>
      </View>
    </View>
  );
}

// ─── BOARD MEMO (PDF-style) ───────────────────────────────────────────────
// Confidential banner, centered title, body in serif, sign-off line.
function BoardMemoView({ v }: { v: Vignette }) {
  return (
    <View style={memo.shell}>
      <View style={memo.confBanner}>
        <Text style={memo.confText}>CONFIDENTIAL · BOARD OF DIRECTORS ONLY</Text>
      </View>
      <Text style={memo.title}>{v.subject ?? v.name}</Text>
      <View style={memo.divider} />
      <Text style={memo.meta}>
        FROM: {v.sender}{"   "}DATE: {new Date().toLocaleDateString()}
      </Text>
      <View style={memo.divider} />
      <Text style={memo.body}>{v.body}</Text>
      <View style={memo.signoffWrap}>
        <Text style={memo.signoffLine}>— {v.sender}</Text>
        <Text style={memo.pageFooter}>Page 1 / 1</Text>
      </View>
    </View>
  );
}

// ─── TWEET (X / Twitter) ──────────────────────────────────────────────────
// Black header bar with X logo, profile avatar, handle, body, fake stats.
function TweetView({ v }: { v: Vignette }) {
  // Sender is typically already in @handle form per our vignette data.
  const handle = v.sender.startsWith("@") ? v.sender : "@" + v.sender.replace(/\s+/g, "_");
  const displayName = v.sender.replace(/^@/, "").replace(/_/g, " ");
  return (
    <View style={tweet.shell}>
      <View style={tweet.topBar}>
        <Text style={tweet.xLogo}>𝕏</Text>
        <Text style={tweet.topBarText}>Post</Text>
      </View>
      <View style={tweet.body}>
        <View style={tweet.head}>
          <View style={tweet.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={tweet.displayName}>{displayName}</Text>
            <Text style={tweet.handle}>{handle}</Text>
          </View>
          <Text style={tweet.follow}>Follow</Text>
        </View>
        <Text style={tweet.tweetText}>{v.body}</Text>
        <Text style={tweet.time}>{nowShort()} · Burn Rate for iOS</Text>
        <View style={tweet.stats}>
          <Stat icon="↺" n="4.7K" color={tweet.muted.color} />
          <Stat icon="♡" n="38.2K" color={tweet.muted.color} />
          <Stat icon="💬" n="1.2K" color={tweet.muted.color} />
          <Stat icon="↗" n="918" color={tweet.muted.color} />
        </View>
      </View>
    </View>
  );
}

function Stat({ icon, n, color }: { icon: string; n: string; color: string }) {
  return (
    <View style={tweet.stat}>
      <Text style={[tweet.statIcon, { color }]}>{icon}</Text>
      <Text style={tweet.statN}>{n}</Text>
    </View>
  );
}

// ─── NEWS (TechCrunch) ────────────────────────────────────────────────────
// Green TC strip, headline, byline + timestamp, lead paragraph in serif.
function NewsView({ v }: { v: Vignette }) {
  return (
    <View style={news.shell}>
      <View style={news.topBar}>
        <Text style={news.logo}>TechCrunch</Text>
      </View>
      <Text style={news.section}>AI · BREAKING</Text>
      <Text style={news.headline}>{v.subject ?? v.name}</Text>
      <View style={news.byline}>
        <View style={news.bylineAvatar} />
        <View>
          <Text style={news.bylineAuthor}>by Connie Loizos</Text>
          <Text style={news.bylineDate}>{new Date().toDateString()}</Text>
        </View>
      </View>
      <Text style={news.lead}>{v.body}</Text>
      <View style={news.cta}>
        <Text style={news.ctaText}>Sign up for the Daily Crunch newsletter</Text>
      </View>
    </View>
  );
}

// ─── PODCAST ──────────────────────────────────────────────────────────────
// Show name + episode title; if body contains speaker labels with [HH:MM:SS]
// timestamps we render them as a transcript. Otherwise we render the body
// flat with a small "transcript excerpt" label.
function PodcastView({ v }: { v: Vignette }) {
  return (
    <View style={pod.shell}>
      <View style={pod.head}>
        <View style={pod.cover}>
          <Text style={pod.coverText}>▶</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pod.show}>{v.sender}</Text>
          <Text style={pod.episode} numberOfLines={3}>{v.subject ?? v.name}</Text>
        </View>
      </View>
      <View style={pod.controls}>
        <Text style={pod.controlBtn}>⏮</Text>
        <Text style={[pod.controlBtn, pod.controlPlay]}>►</Text>
        <Text style={pod.controlBtn}>⏭</Text>
        <View style={{ flex: 1 }} />
        <Text style={pod.time}>1:14:22</Text>
      </View>
      <Text style={pod.transcriptLabel}>TRANSCRIPT EXCERPT</Text>
      <Text style={pod.transcript}>{v.body}</Text>
    </View>
  );
}

// ─── SYSTEM (terminal) ────────────────────────────────────────────────────
// Black background, green VT323 monospace, blinking cursor at the end.
// Used by late-game vignettes (V12 Congressional, V13 model-responds-to-
// itself, V15 achievement-closing) for the "we lost the thread" tone.
function SystemView({ v }: { v: Vignette }) {
  const [cursor, setCursor] = React.useState(true);
  React.useEffect(() => {
    const id = setInterval(() => setCursor((c) => !c), 530);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={sys.shell}>
      <View style={sys.titleBar}>
        <View style={[sys.dot, { backgroundColor: "#FF5F57" }]} />
        <View style={[sys.dot, { backgroundColor: "#FEBC2E" }]} />
        <View style={[sys.dot, { backgroundColor: "#28C840" }]} />
        <Text style={sys.titleText}>{v.subject ?? "anomaly.log"}</Text>
      </View>
      <View style={sys.body}>
        <Text style={sys.line}>
          <Text style={sys.prompt}>$ tail -f {v.subject ?? "anomaly.log"}</Text>
        </Text>
        <Text style={sys.line}>
          <Text style={sys.dim}>[{nowShort()}] </Text>
          <Text style={sys.tag}>[{v.sender}]</Text>
        </Text>
        <Text style={sys.payload}>
          {v.body}
          <Text style={{ opacity: cursor ? 1 : 0 }}> █</Text>
        </Text>
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0, right: 0, top: 0, bottom: 0,
    zIndex: 100,
  },
  backdrop: {
    position: "absolute",
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: "rgba(26,22,18,0.75)",
  },
  frame: {
    position: "absolute",
    left: 8, right: 8, top: 24, bottom: 16,
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  chrome: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.cream_2,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
  },
  chromeLabel: {
    fontFamily: fonts.display,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 1.5,
    flex: 1,
  },
  chromeClose: {
    paddingHorizontal: 4,
  },
  chromeCloseText: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
    lineHeight: 18,
  },
  scrollPad: {
    flexGrow: 1,
  },
});

// ─── Slack styles ────────────────────────────────────────────────────────
// Numbers ported 1:1 from screens.jsx::VignetteBody: dark card on the cream
// reader frame, 18×18 sage avatar, name + timestamp inline, body indented
// 24px to match the design's `marginLeft: 24`. Reply chip palette is the
// design's bordered "dark on slightly darker" Slack thread-button look.
const slack = StyleSheet.create({
  outer: {
    padding: 14,
  },
  card: {
    backgroundColor: "#1A1D29",
    borderRadius: 6,
    padding: 12,
    // 1-line ink outline — matches the design's `boxShadow: 0 0 0 1px ink`
    borderWidth: 1,
    borderColor: colors.ink,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#7E9A85",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "System",
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sender: {
    fontFamily: "System",
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  time: {
    fontFamily: "System",
    fontSize: 11,
    color: "#9B9C9F",
  },
  body: {
    fontFamily: "System",
    fontSize: 13,
    color: "#D1D2D3",
    lineHeight: 19,
    marginLeft: 24, // design: marginLeft: 24 — aligns body under sender text
  },
  replies: {
    marginLeft: 24,
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  replyBtn: {
    borderWidth: 1,
    borderColor: "#383B44",
    backgroundColor: "#222631",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  replyBtnPicked: {
    borderColor: "#1ED760", // Slack-green accent for the picked reply
    backgroundColor: "#1B3A28",
  },
  replyBtnDimmed: {
    opacity: 0.4,
  },
  replyBtnText: {
    fontFamily: "System",
    fontSize: 11,
    color: "#D1D2D3",
  },
  replyBtnTextPicked: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  replyEffectHint: {
    fontFamily: "System",
    fontSize: 10,
    color: "#9B9C9F",
    marginTop: 2,
    fontStyle: "italic",
  },
  resolvedNote: {
    marginLeft: 24,
    marginTop: 10,
    fontFamily: "System",
    fontSize: 11,
    color: "#9B9C9F",
    fontStyle: "italic",
  },
});

// ─── Email styles ────────────────────────────────────────────────────────
const email = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#FFFFFF", padding: 14 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  toolbarText: {
    fontFamily: "System",
    fontSize: 13,
    color: "#5F6368",
  },
  toolbarIcon: {
    fontSize: 16,
    color: "#5F6368",
  },
  subject: {
    fontFamily: "System",
    fontSize: 20,
    fontWeight: "400",
    color: "#202124",
    marginTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#C97B5B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  from: {
    fontFamily: "System",
    fontSize: 14,
    fontWeight: "600",
    color: "#202124",
  },
  to: {
    fontFamily: "System",
    fontSize: 12,
    color: "#5F6368",
    marginTop: 1,
  },
  star: { fontSize: 20, color: "#5F6368" },
  body: {
    fontFamily: "System",
    fontSize: 14,
    color: "#202124",
    lineHeight: 22,
    marginTop: 14,
  },
  attachment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  attachmentIcon: { fontSize: 14 },
  attachmentText: {
    fontFamily: "System",
    fontSize: 12,
    color: "#1A73E8",
  },
});

// ─── Board memo styles ──────────────────────────────────────────────────
const memo = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#FAFAF7", padding: 18 },
  confBanner: {
    backgroundColor: "#B23A48",
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "center",
  },
  confText: {
    fontFamily: "System",
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 2,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginTop: 18,
  },
  divider: {
    height: 1,
    backgroundColor: "#1A1A1A",
    marginVertical: 12,
  },
  meta: {
    fontFamily: "Courier",
    fontSize: 11,
    color: "#1A1A1A",
    textAlign: "center",
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: "#1A1A1A",
    lineHeight: 22,
  },
  signoffWrap: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  signoffLine: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: "#1A1A1A",
    fontStyle: "italic",
  },
  pageFooter: {
    fontFamily: "Courier",
    fontSize: 10,
    color: "#5C5C5C",
  },
});

// ─── Tweet styles ───────────────────────────────────────────────────────
const tweet = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#000000" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2F3336",
  },
  xLogo: {
    fontFamily: "System",
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  topBarText: {
    fontFamily: "System",
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  body: { padding: 14 },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#7E9A85",
  },
  displayName: {
    fontFamily: "System",
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  handle: {
    fontFamily: "System",
    fontSize: 13,
    color: "#71767B",
  },
  follow: {
    fontFamily: "System",
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tweetText: {
    fontFamily: "System",
    fontSize: 17,
    color: "#E7E9EA",
    lineHeight: 24,
    marginTop: 12,
  },
  time: {
    fontFamily: "System",
    fontSize: 13,
    color: "#71767B",
    marginTop: 12,
  },
  stats: {
    flexDirection: "row",
    gap: 24,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2F3336",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statIcon: { fontSize: 14 },
  statN: {
    fontFamily: "System",
    fontSize: 13,
    color: "#71767B",
  },
  muted: { color: "#71767B" },
});

// ─── News styles ────────────────────────────────────────────────────────
const news = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#FFFFFF" },
  topBar: {
    backgroundColor: "#0A8542",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  logo: {
    fontFamily: "System",
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  section: {
    fontFamily: "System",
    fontSize: 11,
    fontWeight: "700",
    color: "#0A8542",
    letterSpacing: 1.5,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 24,
    fontWeight: "700",
    color: "#0F1419",
    paddingHorizontal: 14,
    marginTop: 6,
    lineHeight: 30,
  },
  byline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  bylineAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#CCCCCC",
  },
  bylineAuthor: {
    fontFamily: "System",
    fontSize: 13,
    fontWeight: "600",
    color: "#0F1419",
  },
  bylineDate: {
    fontFamily: "System",
    fontSize: 12,
    color: "#5C5C5C",
    marginTop: 1,
  },
  lead: {
    fontFamily: "Georgia",
    fontSize: 16,
    color: "#0F1419",
    lineHeight: 26,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  cta: {
    marginHorizontal: 14,
    marginBottom: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
    alignItems: "center",
  },
  ctaText: {
    fontFamily: "System",
    fontSize: 13,
    color: "#0A8542",
    fontWeight: "600",
  },
});

// ─── Podcast styles ──────────────────────────────────────────────────────
const pod = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#1C1C1E", padding: 16 },
  head: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  cover: {
    width: 72,
    height: 72,
    backgroundColor: "#B23A48",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  coverText: {
    fontSize: 32,
    color: "#FFFFFF",
  },
  show: {
    fontFamily: "System",
    fontSize: 12,
    color: "#9B9C9F",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  episode: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
    lineHeight: 22,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#2F2F31",
  },
  controlBtn: {
    fontSize: 24,
    color: "#FFFFFF",
  },
  controlPlay: {
    fontSize: 32,
  },
  time: {
    fontFamily: "Courier",
    fontSize: 12,
    color: "#9B9C9F",
  },
  transcriptLabel: {
    fontFamily: "System",
    fontSize: 11,
    fontWeight: "700",
    color: "#9B9C9F",
    letterSpacing: 1.5,
    marginTop: 18,
  },
  transcript: {
    fontFamily: "Courier",
    fontSize: 14,
    color: "#D1D2D3",
    marginTop: 8,
    lineHeight: 22,
  },
});

// ─── System styles ──────────────────────────────────────────────────────
const sys = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#0A0A0A" },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#1A1A1A",
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2A",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  titleText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: "#9B9C9F",
    marginLeft: 6,
  },
  body: { flex: 1, padding: 14 },
  line: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: "#7CFF7C",
    lineHeight: 22,
    marginBottom: 4,
  },
  prompt: {
    color: "#7CFF7C",
  },
  dim: { color: "#4A8A4A" },
  tag: { color: "#EBBE6E" },
  payload: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: "#E7E9EA",
    lineHeight: 22,
    marginTop: 12,
  },
});
