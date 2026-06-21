import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  getVignette,
  VignetteMedium,
  VIGNETTE_BY_ID,
} from "../core/vignettes";
import {
  selectResolvedVignettes,
  selectUnlockedVignettes,
  selectUnreadVignettes,
  useGame,
} from "../game/store";
import { colors, fonts, PIXEL } from "./theme";
import { VignetteReader } from "./VignetteReader";

interface Props {
  onBack(): void;
}

// ─── Medium metadata ─────────────────────────────────────────────────────
// Mirrors Claude Design `sub-screens.jsx::MEDIUM_META`: each medium gets a
// signature color + glyph so a glance at the row tells the player what they
// are about to read. Aubergine for Slack, gold for board memos, ink for
// tweets, etc. — these aren't our palette colors, they're the *medium's*
// real-world brand colors (parody-distance per GDD §13).
const MEDIUM: Record<VignetteMedium, { label: string; color: string; glyph: string }> = {
  slack:        { label: "SLACK",       color: "#1A1D29",        glyph: "#" },
  board_memo:   { label: "BOARD MEMO",  color: colors.gold_2,    glyph: "▤" },
  fake_tweet:   { label: "X / TWITTER", color: "#000000",        glyph: "𝕏" },
  leaked_email: { label: "EMAIL",       color: colors.muted_2,   glyph: "✉" },
  fake_news:    { label: "TECHCRUNCH",  color: "#0A8542",        glyph: "TC" },
  podcast:      { label: "PODCAST",     color: colors.tensionRed, glyph: "▶" },
  system:       { label: "SYSTEM",      color: colors.ink,       glyph: "!" },
};

// Filter chips at the top of the inbox. "all" + each medium that the player
// might want to slice by. Kept short so they fit one row even on small phones.
const FILTERS: Array<{ key: "all" | VignetteMedium; label: string }> = [
  { key: "all",          label: "ALL" },
  { key: "slack",        label: "SLACK" },
  { key: "board_memo",   label: "BOARD" },
  { key: "leaked_email", label: "EMAIL" },
  { key: "fake_tweet",   label: "X" },
  { key: "fake_news",    label: "NEWS" },
  { key: "podcast",      label: "POD" },
  { key: "system",       label: "SYS" },
];

/**
 * Vignettes inbox — design port of Claude Design
 * `sub-screens.jsx::VignettesScreen`.
 *
 * Visual contract:
 *  - Header: BURN·RATE / Inbox / "N unread · M total events"
 *  - Filter chip row (active = ink fill, inactive = cream_2 fill)
 *  - Feed of rows, newest first:
 *      • 28×28 medium-colored badge with glyph
 *      • sender (pixelB) · time (small muted)  ← time TODO once firedAt lands
 *      • medium label in medium color
 *      • single-line body preview
 *      • absolute tension-red dot top-right while unread
 *  - Unread rows: cream_hi bg + ink shadow (loud)
 *  - Read rows:   cream bg + cream_4 shadow (quiet)
 *
 * Tap a row → bottom sheet with full body. Sheet visuals are still the
 * minimal Step 4 shape; Step 6 swaps it for per-medium templates (real
 * Slack-pastiche, fake Gmail, etc.).
 */
export function VignettesInbox({ onBack }: Props) {
  const unlocked = useGame(selectUnlockedVignettes);
  const unread = useGame(selectUnreadVignettes);
  const resolved = useGame(selectResolvedVignettes);
  const markRead = useGame((s) => s.markVignetteRead);
  const resolveVignette = useGame((s) => s.resolveVignette);

  const [filter, setFilter] = React.useState<typeof FILTERS[number]["key"]>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);

  const unreadSet = React.useMemo(() => new Set(unread), [unread]);
  // Newest-first: store appends on unlock, reverse for display.
  const ordered = React.useMemo(() => [...unlocked].reverse(), [unlocked]);
  const filtered = React.useMemo(
    () =>
      filter === "all"
        ? ordered
        : ordered.filter((id) => VIGNETTE_BY_ID[id]?.medium === filter),
    [ordered, filter],
  );

  // getVignette returns undefined for a missing id (only happens if save
  // contains a vignette id we no longer ship). Coerce to null for the reader.
  const open = (openId ? getVignette(openId) : null) ?? null;

  const onTap = (id: string) => {
    setOpenId(id);
    if (unreadSet.has(id)) markRead(id);
  };

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>
            BURN<Text style={{ color: colors.terracotta }}>·</Text>RATE
          </Text>
          <Text style={styles.title}>Inbox</Text>
          <Text style={styles.sub}>
            {unread.length} unread · {ordered.length} total event{ordered.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filtersRow}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.ink : colors.cream_2,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? colors.cream_hi : colors.ink },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Feed */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {ordered.length === 0
              ? "Nothing here yet. Hire your first engineer to break the silence."
              : `No ${filter.replace("_", " ")} events yet.`}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filtered.map((id) => {
            const v = VIGNETTE_BY_ID[id];
            if (!v) return null;
            const meta = MEDIUM[v.medium];
            const isUnread = unreadSet.has(id);
            return (
              <Pressable
                key={id}
                onPress={() => onTap(id)}
                style={[
                  styles.row,
                  {
                    backgroundColor: isUnread ? colors.cream_hi : colors.cream,
                    borderColor: isUnread ? colors.ink : colors.cream_4,
                    shadowColor: isUnread ? colors.ink : colors.cream_4,
                  },
                ]}
              >
                <View style={[styles.badge, { backgroundColor: meta.color }]}>
                  <Text style={styles.badgeText}>{meta.glyph}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rowTopLine}>
                    <Text style={styles.rowSender} numberOfLines={1}>{v.sender}</Text>
                    {/* TODO: real time once firedAt lands in PersistentState */}
                  </View>
                  <Text style={[styles.rowMedium, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {v.body.replace(/\n+/g, " ")}
                  </Text>
                </View>
                {isUnread && <View style={styles.unreadDot} />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Fullscreen reader with per-medium template (Slack / Email / Tweet /
          BoardMemo / News / Podcast / System). See VignetteReader.tsx.
          For Slack DMs with replyEffects, the reader hands the picked index
          back through onResolve, which applies the buff. The modal stays
          open so the reveal-label (→ +X% Hype · 1h) animates in — the
          player taps × or the backdrop to close once they've read it. */}
      <VignetteReader
        vignette={open}
        onClose={() => setOpenId(null)}
        onResolve={(replyIdx) => {
          if (openId) resolveVignette(openId, replyIdx);
        }}
        resolvedReplyIdx={openId ? resolved[openId] : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.cream_2,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream_4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: { padding: 6 },
  backChevron: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 22,
  },
  brand: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 2,
    lineHeight: 18,
  },
  sub: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  filterChipText: {
    fontFamily: fonts.display,
    fontSize: 9,
    letterSpacing: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    position: "relative",
  },
  badge: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 6,
  },
  rowSender: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 14,
    flexShrink: 1,
  },
  rowMedium: {
    fontFamily: fonts.display,
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 3,
  },
  rowPreview: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink_hi,
    marginTop: 3,
    lineHeight: 14,
  },
  unreadDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    backgroundColor: colors.tensionRed,
  },
});
