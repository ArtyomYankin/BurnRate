import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ACHIEVEMENTS,
  AchievementBucket,
  AchievementDef,
} from "../core/achievements";
import { selectUnlockedAchievements, useGame } from "../game/store";
import { PanelHelpModal, PanelHint, PanelInfoButton } from "./PanelHelp";
import { useStrings } from "../core/i18n";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  onBack(): void;
}

// ─── Bucket metadata ─────────────────────────────────────────────────────
// Visual identity + display order per GDD §10. Order goes from approachable
// (milestone) to deep (endgame), so the grid reads top-down as progression.
const BUCKET_META: Record<
  AchievementBucket,
  { color: string; hideLockedDescription: boolean }
> = {
  milestone: { color: colors.sage,        hideLockedDescription: false },
  grind:     { color: colors.terracotta,  hideLockedDescription: false },
  subtle:    { color: colors.tension_2,   hideLockedDescription: true  },
  comedy:    { color: colors.gold,        hideLockedDescription: false },
  endgame:   { color: colors.tensionRed,  hideLockedDescription: false },
};

const BUCKET_ORDER: AchievementBucket[] = ["milestone", "grind", "subtle", "comedy", "endgame"];

const BY_BUCKET: Record<AchievementBucket, AchievementDef[]> = (() => {
  const out: Record<AchievementBucket, AchievementDef[]> = {
    milestone: [], grind: [], subtle: [], comedy: [], endgame: [],
  };
  for (const a of ACHIEVEMENTS) out[a.bucket].push(a);
  return out;
})();

export function AchievementsScreen({ onBack }: Props) {
  const [infoOpen, setInfoOpen] = React.useState(false);
  const t = useStrings();
  const unlocked = useGame(selectUnlockedAchievements);
  const unlockedSet = React.useMemo(() => new Set(unlocked), [unlocked]);
  const total = ACHIEVEMENTS.length;
  const done = unlocked.length;

  return (
    <View style={styles.shell}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>
            BURN<Text style={{ color: colors.terracotta }}>·</Text>RATE
          </Text>
          <Text style={styles.title}>{t.achievements.title}</Text>
          <Text style={styles.sub}>{done} / {total} {t.achievements.unlockedPattern}</Text>
        </View>
        <PanelInfoButton onPress={() => setInfoOpen(true)} />
      </View>

      <PanelHint panelKey="achievements" text={t.achievements.hint} />

      <PanelHelpModal
        visible={infoOpen}
        title={t.achievements.title}
        sections={t.achievements.help}
        onClose={() => setInfoOpen(false)}
      />

      {/* Progress bar — quick visual of completion % */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${total > 0 ? (done / total) * 100 : 0}%` },
          ]}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {BUCKET_ORDER.map((bucket) => {
          const list = BY_BUCKET[bucket];
          if (list.length === 0) return null;
          const meta = BUCKET_META[bucket];
          const bucketDone = list.filter((a) => unlockedSet.has(a.id)).length;
          return (
            <View key={bucket} style={styles.bucket}>
              <View style={styles.bucketHeader}>
                <View style={[styles.bucketSwatch, { backgroundColor: meta.color }]} />
                <Text style={[styles.bucketLabel, { color: meta.color }]}>
                  {t.achievements.buckets[bucket]}
                </Text>
                <Text style={styles.bucketCount}>{bucketDone} / {list.length}</Text>
              </View>
              {list.map((a) => (
                <AchievementCard
                  key={a.id}
                  def={a}
                  unlocked={unlockedSet.has(a.id)}
                  hideLockedDescription={meta.hideLockedDescription}
                  accent={meta.color}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function AchievementCard({
  def,
  unlocked,
  hideLockedDescription,
  accent,
}: {
  def: AchievementDef;
  unlocked: boolean;
  hideLockedDescription: boolean;
  accent: string;
}) {
  const t = useStrings();
  const showName = unlocked || !hideLockedDescription;
  const showDesc = unlocked || !hideLockedDescription;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: unlocked ? colors.cream_hi : colors.cream_2,
          borderColor: unlocked ? accent : colors.cream_4,
          opacity: unlocked ? 1 : 0.7,
        },
      ]}
    >
      <View style={[styles.cardSwatch, { backgroundColor: unlocked ? accent : colors.muted }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            styles.cardName,
            { color: unlocked ? colors.ink : colors.muted },
          ]}
          numberOfLines={2}
        >
          {showName ? def.name : t.achievements.hidden}
        </Text>
        <Text
          style={[
            styles.cardDesc,
            { color: unlocked ? accent : colors.muted_2 },
          ]}
          numberOfLines={3}
        >
          {showDesc ? def.description : t.achievements.hiddenDesc}
        </Text>
      </View>
      {unlocked && (
        <View style={[styles.cardBadge, { borderColor: accent }]}>
          <Text style={[styles.cardBadgeText, { color: accent }]}>✓</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.cream,
  },
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
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.cream_2,
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.sage,
  },
  list: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  bucket: {
    gap: 6,
  },
  bucketHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  bucketSwatch: {
    width: 10,
    height: 10,
  },
  bucketLabel: {
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
    flex: 1,
  },
  bucketCount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  cardSwatch: {
    width: 4,
    alignSelf: "stretch",
  },
  cardName: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 15,
  },
  cardDesc: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 3,
  },
  cardBadge: {
    width: 22,
    height: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream_hi,
  },
  cardBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 14,
  },
});
