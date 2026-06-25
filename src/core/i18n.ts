/**
 * Central i18n dictionary for Burn Rate.
 *
 * Pattern:
 *   - EN dict is the schema: defined first, type inferred from its shape.
 *   - DE dict is typed against the inferred shape so any structural drift
 *     between locales fails at compile time. Missing or extra keys in DE
 *     are caught by tsc before runtime.
 *
 * Consumption:
 *
 *   import { useStrings } from "../core/i18n";
 *   const t = useStrings();
 *   <Text>{t.topHud.next}</Text>
 *
 * Sections are grouped by feature area, not by file, because a single
 * string (like "BUY 1") can be reused in multiple screens. When in doubt,
 * group by what the player perceives as the same context.
 *
 * Templating: keep numeric / dynamic substitution in the caller; the dict
 * only holds static copy. E.g. for "NEXT: SERIES B · 1E10 TOKENS", store
 * "NEXT: " + the round name from a separate ROUND_NAMES_BY_LANG dict, and
 * interpolate the threshold in the caller.
 */

import { useGame } from "../game/store";

export type Lang = "EN" | "DE";

const EN = {
  common: {
    ok: "OK",
    cancel: "Cancel",
    done: "Done",
    close: "Close",
    back: "Back",
    save: "Save",
    reset: "Reset",
    yes: "Yes",
    no: "No",
    on: "ON",
    off: "OFF",
    tip: "TIP",
    locked: "LOCKED",
    unlock: "Unlock",
    next: "Next",
  },

  topHud: {
    round: "ROUND",
    next: "NEXT",
    tokens: "TOKENS",
    hypeDiscount: "HYPE",
    capital: "$",
    equity: "EQ",
    rate: "/s",
  },

  roundNames: {
    seed: "Garage",
    series_a: "Bootstrap",
    series_b: "Coworking",
    series_c: "Series C",
    series_d: "Series D",
    ipo: "Startup Office",
    secondary: "Megacorp",
    acquisition: "Big Tech",
    sovereign_wealth: "Campus",
    government_bailout: "Datacenter",
    civilizational: "Planetary",
    agi_singularity: "AGI Singularity",
  },

  home: {
    ach: "ACH",
    slack: "SLACK",
    buff: "BUFF",
    buffs: "BUFFS",
    debt: "DBT",
    closeRound: "CLOSE ROUND",
  },

  producers: {
    title: "PRODUCERS",
    sub: "Buy supply for each production chain",
    buy: "BUY",
    locked: "🔒 ROUND",
    chains: {
      engineers: { label: "ENGINEERS", sub: "Multiplier on the pipeline", tab: "ENGR" },
      gpu:       { label: "GPU",       sub: "Inference + training · min(supply)", tab: "GPU" },
      data:      { label: "DATA",      sub: "Training corpus · min(supply)",      tab: "DATA" },
      energy:    { label: "ENERGY",    sub: "Powers the GPUs · min(supply)",      tab: "ENER" },
    },
    upgradeNext: "next",
    multiplier: "multiplier",
    owned: "OWNED",
    out: "OUT",
    newBadge: "NEW",
    globalEach: "GLOBAL EACH",
    agentFlywheel: "Each agent compounds total tokens/s. The flywheel of recursive self-improvement.",
    help: [
      {
        title: "LIEBIG'S LAW · BOTTLENECK CAPS",
        body: "Output = min(GPU, Data, Energy) × Engineer multiplier. Whatever chain is smallest LIMITS your rate — a 1000-unit lead in GPU is wasted if Data is at 100.",
      },
      {
        title: "WHAT TO BUY FIRST",
        body: "Compare the per-second output of GPU / Data / Energy. The lowest of the three is what's actually limiting you — buy that chain until another one becomes the smallest. Engineers come after — they multiply, but only on top of a healthy flow.",
      },
      {
        title: "UPGRADE BADGES (×2 / ×8 / ×64)",
        body: "Each producer tier gets bonus multipliers at 10 / 50 / 100 owned (×2 / ×8 / ×64). The card shows the next threshold (e.g. '40 → ×8 multiplier'). Pushing past these is usually better than starting a new higher tier early.",
      },
      {
        title: "TIER UNLOCKS",
        body: "New tiers unlock per round (tier N at round N). Locked rows show '🔒 ROUND X' — they don't help until you close that round. Top tier in each chain is ~10× the output of the previous, so each round's new tier is a big jump.",
      },
    ],
    hint: "Buy in all 4 chains. The smallest of GPU/Data/Energy caps your rate; Engineers multiply on top.",
  },

  allocate: {
    barTitle: "TOKEN ALLOCATION",
    edit: "EDIT",
    safetyLowBanner: "⚠ SAFETY LOW · ALIGNMENT DEBT ACCRUING",
    title: "Allocate",
    sub: "Split each token across departments",
    rd: "R&D",
    product: "PROD",
    marketing: "MKT",
    safety: "SAFE",
    rdLong: "R&D",
    productLong: "PRODUCT",
    marketingLong: "MARKETING",
    safetyLong: "SAFETY",
    saveBalanced: "SAVE ALLOCATION",
    offBy: "OFF BY",
    pool: "POOL",
    toAssign: "POINTS TO ASSIGN",
    assignSuffix: "ASSIGN",
    balanced: "✓ BALANCED",
    debtWarn: "⚠ ALIGNMENT DEBT WILL ACCRUE",
    safetyLowWarn: "Safety < 10% — debt is accruing",
    departments: {
      rd:        { label: "R&D",       sub: "→ Research Points" },
      product:   { label: "Product",   sub: "→ Capital, Users"  },
      marketing: { label: "Marketing", sub: "→ Hype"            },
      safety:    { label: "Safety",    sub: "→ Pay Down Debt"   },
    },
    help: [
      {
        title: "PRODUCT (default high)",
        body: "Converts tokens into Capital, which buys producers. Capital is the main bottleneck early game — keep this 50-80% until you have a comfortable producer base.",
      },
      {
        title: "R&D · SPRINT UPGRADES",
        body: "Generates Research Points (RP) for per-run sprint upgrades (×1.25–×2 buffs that reset at prestige). Bump R&D mid-round when you're saving for a specific sprint.",
      },
      {
        title: "MARKETING · HYPE",
        body: "Generates Hype, which lowers the next round's threshold (up to 50% discount). Useful in the home stretch before closing — early-round Hype is wasted because the discount caps quickly.",
      },
      {
        title: "SAFETY · DEBT MANAGEMENT",
        body: "Under 10% Safety, Alignment Debt accrues every second (persists across prestige). Over 10%, debt is paid down. Debt thresholds (10/25/50/100/200/400) fire one-shot events you can't undo. Keep Safety ≥10% always.",
      },
    ],
    hint: "Default is Product-heavy — capital flows fast. Keep Safety ≥10% or Alignment Debt accrues.",
  },

  research: {
    title: "Research Tree",
    subPattern: "EQUITY AVAILABLE · SPEND BEFORE PRESTIGE",
    sprintHeader: "SPRINT · RP",
    sprintSub: "PER-RUN BOOSTS · RESET ON PRESTIGE",
    rp: "RP",
    nextTier: "NEXT TIER",
    subPrefix: "Equity available · spend before prestige",
    equity: "Equity",
    spendBeforePrestige: "spend before prestige",
    available: "available",
    cost: "COST",
    branches: {
      rd: "R&D",
      compute: "COMPUTE",
      data: "DATA",
      energy: "ENERGY",
      safety: "SAFETY",
      capital: "CAPITAL",
    },
    tierLabel: "T",
    help: [
      {
        title: "TWO TIMESCALES",
        body: "SPRINT upgrades (top) — spent with this run's RP, expire on prestige. Cheap, immediate.\n\nRESEARCH NODES (bottom) — spent with Equity, PERSIST across all future runs. Expensive, compounding.",
      },
      {
        title: "EQUITY · WHEN TO SPEND",
        body: "Equity is earned at prestige, scaled to how far past the round threshold you went. Spend BEFORE next prestige to maximize compounding — unspent Equity does nothing.",
      },
      {
        title: "NODE BRANCHES",
        body: "The tree splits across BOOST (multiplier buffs), AUTOMATION (passive helpers), and ENDGAME (late-tier unlocks). Early game: prioritize BOOST nodes — they compound on every producer. Late game: unlock ENDGAME nodes that gate the AGI Singularity finale.",
      },
      {
        title: "SPRINT TIMING",
        body: "Sprint upgrades reset every prestige. Buying them late in a round (after threshold is hit but before closing) wastes most of their value. Buy early when RP is fresh — they'll work the whole run.",
      },
    ],
    hint: "Equity → permanent multipliers (persist forever). RP → sprint upgrades (this run only). Spend both before prestige.",
  },

  inbox: {
    title: "Inbox",
    unread: "unread",
    total: "total",
    event: "event",
    events: "events",
    filters: {
      all: "ALL",
      slack: "SLACK",
      board_memo: "BOARD",
      leaked_email: "EMAIL",
      fake_tweet: "X",
      fake_news: "NEWS",
      podcast: "POD",
      system: "SYS",
    },
    empty: "No events yet — keep playing.",
    emptyFiltered: "Nothing matches this filter.",
    replied: "Reply locked in",
    pickReply: "Tap a reply to lock it in (one shot).",
    help: [
      {
        title: "WHAT FIRES THEM",
        body: "Vignettes fire at story milestones — first prestige, threshold hits, achievement counts, debt levels, alignment streaks. Each one is one-shot per save.",
      },
      {
        title: "MEDIUM TYPES",
        body: "BLOG/PAPER/EMAIL — passive read; lore. SLACK DM — has reply options that grant a 1-hour buff/neutral/debuff. BOARD MEMO — high-stakes, often gates a permanent perk.",
      },
      {
        title: "REPLY EFFECTS · ONE SHOT",
        body: "Slack DMs and board memos with reply choices LOCK IN your pick — re-opening the vignette won't let you re-pick. Read carefully; effects last ~1h.",
      },
      {
        title: "WHY THE INBOX MATTERS",
        body: "Beyond the buffs, vignettes are the narrative spine of the game. The Slack inbox is how the world (your team, board, journalists, the model itself) talks back to you.",
      },
    ],
    hint: "Slack DMs have reply options that grant a 1-hour buff/debuff. Your pick locks in — read carefully.",
  },

  achievements: {
    title: "ACHIEVEMENTS",
    unlockedPattern: "unlocked",
    of: "of",
    hidden: "???",
    hiddenDesc: "Hidden — keep playing.",
    buckets: {
      milestone: "MILESTONES",
      grind: "GRIND",
      subtle: "HIDDEN",
      comedy: "COMEDY",
      endgame: "ENDGAME",
    },
    help: [
      {
        title: "WHY UNLOCK THEM",
        body: "Achievements are the completionist's loop — no mechanical buff, no Equity reward. They mark milestones and unlock late-game vignettes that reference your specific path.",
      },
      {
        title: "BUCKETS",
        body: "MILESTONES — natural progression (close rounds, hit thresholds).\nGRIND — long-haul (100+ producers in a chain, 10+ prestiges).\nHIDDEN — discover by playing weird; the card hides its hint until unlocked.\nCOMEDY — easter eggs, joke conditions.\nENDGAME — gated behind AGI singularity.",
      },
      {
        title: "HIDDEN HINTS",
        body: "HIDDEN-bucket achievements show '???' for the description until you unlock them. Once unlocked the card unmasks and stays revealed.",
      },
      {
        title: "PROGRESSION SOFT-LOCK",
        body: "Top-bar progress bar tracks total unlocked. Hitting 96/96 is the ultimate completion gate — most players land at 30-50 by their first prestige, 70+ by AGI Singularity.",
      },
    ],
    hint: "HIDDEN-bucket cards show ??? until unlocked. No buff — just bragging rights and late-game vignettes.",
  },

  onboarding: {
    tapToContinue: "(Tap to continue.)",
    tapToDismiss: "(Tap to dismiss.)",
    steps: {
      1: {
        title: "HOW TOKENS ARE MADE",
        text: "Tokens are the fuel — and they come from a pipeline of 4 chains:\n\nENGINEERS · GPU · DATA · ENERGY\n\nThe bottleneck (smallest of GPU/Data/Energy) caps your rate. Engineers multiply on top. Balance all four — building only one stalls everything.\n\n(Tap to continue.)",
      },
      2: {
        title: "STEP 1 of 2 · HIRE",
        text: "Tap the engineer to hire one more. Engineers multiply the pipeline.",
      },
      3: {
        title: "STEP 2 of 2 · COMPUTE",
        text: "Tap the GPU. The engineer needs compute to run code on.",
      },
      4: {
        title: "ALLOCATION · TOK → 4 DEPARTMENTS",
        text: "Every token you earn splits across four departments:\n\n• PRODUCT  → Capital ($) to buy more producers\n• R&D       → Research Points (RP) for per-run sprint upgrades\n• MARKETING → Hype to lower the next round's threshold\n• SAFETY    → pays down Alignment Debt; under 10% accrues it\n\nDefault is Product-heavy. Crank Safety if events warn you.\n\n(Tap to continue.)",
      },
      5: {
        title: "OPEN · ALLOCATE",
        text: "",
      },
      6: {
        title: "WHAT THE COUNTERS MEAN",
        text: "$  CAPITAL — buys producers. Resets at prestige.\nRP  RESEARCH POINTS — per-run, spend on sprint upgrades.\nHY  HYPE — lowers the next round's threshold. Resets.\nEQ  EQUITY — earned at prestige. PERSISTS. Spend on the permanent Research Tree.\nDB  ALIGNMENT DEBT — accrues if Safety < 10%. PERSISTS. Triggers events.\n\n(Tap to continue.)",
      },
      7: {
        title: "TRAINING RUN · FIRST ROLL FREE",
        text: "Tap the monitor. Your first roll is FREE — guaranteed Solid (+10% Tokens for 30 min).",
      },
      8: {
        title: "READY",
        text: "Numbers climb on their own. Balance the 4 chains, close the round, prestige, spend Equity on Research, repeat.\n\n(Tap to dismiss.)",
      },
      9: {
        title: "RESEARCH TREE",
        text: "Tap the research target. Equity (earned at prestige) buys permanent multipliers here — they stack across every future round.",
      },
      10: { title: "OPEN · SLACK INBOX", text: "" },
      11: { title: "OPEN · ACHIEVEMENTS", text: "" },
    },
  },

  spotlight: {
    allocBar: "Tap the ALLOCATION bar to split your tokens across 4 departments.",
    slackBtn: "Tap the SLACK button — your first inbox events are waiting.",
    achBtn: "Tap the ACH button — your unlocked achievements are in here.",
  },

  intro: {
    eyebrow: "IT'S THE AI ERA",
    body1: "You have a garage, a hoodie, and an idea worth a billion dollars.",
    body2Prefix: "To ship it you need ",
    tokens: "TOKENS",
    body2Mid: " — and to make tokens you need ",
    engineers: "Engineers",
    body2Sep: ", ",
    gpus: "GPUs",
    body2Data: ", ",
    data: "Data",
    body2Energy: ", and ",
    energy: "Energy",
    body2Period: ".",
    body3: "Build all four. Balance the pipeline. Grow as fast as you can. Close funding rounds, raise the bar, and try not to lose the alignment plot.",
    hint1: "TAP things on the screen to buy / act",
    hint2: "WATCH the token counter at the top",
    hint3: "CLOSE ROUND when you hit the threshold",
    beginBtn: "BEGIN",
  },

  prestige: {
    title: "CLOSE ROUND",
    body: "You've hit the round threshold. Close to earn Equity and start the next round at a faster baseline.",
    earned: "Equity earned",
    resets: "Resets: Tokens, Capital, producers, sprint upgrades, Hype",
    persists: "Persists: Equity, Research, Alignment Debt, vignettes, achievements",
    closeBtn: "CLOSE ROUND",
    cancelBtn: "Cancel",
    nextRound: "NEXT ROUND",
    finalRound: "AGI SINGULARITY",
    ribbonFundingComplete: "▲ FUNDING ROUND COMPLETE ▲",
    ribbonAgiClosed: "▲ AGI SINGULARITY CLOSED ▲",
    closingRound: "CLOSING ROUND",
    overshootSuffix: "% threshold",
    tokens: "tokens",
    hypeDiscountLine: "HYPE DISCOUNT",
    equityLabel: "EQUITY EARNED",
    whatHappens: "WHAT HAPPENS NEXT",
    rowTokens: "Tokens",
    rowCapital: "Capital",
    rowProducers: "Producers",
    rowEquity: "Equity",
    rowResearch: "Research nodes",
    rowDebt: "Alignment debt",
    resetTag: "RESET",
    persistTag: "PERSISTS",
    singularityLoop: "SINGULARITY LOOP",
    singularitySub: "endgame · same threshold",
    nextThresholdSuffix: "tokens",
    nextEquityMult: "Equity",
    notYet: "Not yet",
    okBtn: "OK",
    incomingTransmission: "INCOMING TRANSMISSION…",
    closeVerb: "Close",
    loopAgi: "Loop AGI Singularity",
  },

  training: {
    title: "TRAINING RUN",
    sub: "Probabilistic Tokens boost",
    freeRollBanner: "★ FIRST ROLL FREE ★",
    freeRollSub: "Guaranteed Solid · no cost",
    rollFreeSolid: "FREE ROLL · SOLID",
    rollCost: "ROLL",
    pityCounter: "Pity",
    pityFires: "PITY!",
    tiers: {
      Failed: "FAILED",
      Marginal: "MARGINAL",
      Solid: "SOLID",
      SOTA: "SOTA",
      Breakthrough: "BREAKTHROUGH",
    },
    odds: "ODDS",
    yourEffect: "YOUR EFFECT",
    forMin: "for",
    min: "min",
    hour: "h",
    keepRolling: "ROLL AGAIN",
    closeBtn: "CLOSE",
    later: "LATER",
    notEnough: "NOT ENOUGH TOKENS",
    freeGuaranteed: "Guaranteed",
    forXMin: "+10% Tokens for 30 minutes.",
    tierFlavor: {
      Failed: "Loss never converged. The eval suite literally cried.",
      Marginal: "Numbers go up. A little. Cautiously celebrate.",
      Solid: "A real model. It compiles. It mostly behaves.",
      SOTA: "Top of leaderboard for ~36 hours. Screenshot Slack.",
      Breakthrough: "You will be on the Lex Fridman podcast within 6 weeks.",
    },
    rollForBreakthrough: "roll for a breakthrough",
    trainingDots: "training…",
    result: "result",
    freeRollHeader: "★ FIRST ROLL FREE ★",
    freeRollBody1: "Guaranteed",
    freeRollBody2: "— +10% Tokens for 30 minutes. No token cost. One per save.",
    spendPrefix: "Spend",
    spendTokens: "tokens",
    spendSuffix: "for a chance at a Tokens multiplier.",
    spendRuns: "",
    spendPeriod: "",
    rollingFlavor: "The eval suite is mostly held together with prayer.",
    pityFiredNote: "Pity fired!",
    freeRollSolid: "FREE ROLL · SOLID",
    rollLabel: "ROLL",
    compiling: "COMPILING…",
    rollAgain: "ROLL AGAIN",
  },

  buffs: {
    title: "ACTIVE BUFFS",
    ribbonTitle: "▲ ACTIVE BUFFS ▲",
    none: "No active buffs.",
    nothingActive: "NOTHING ACTIVE",
    emptyBody: "Roll a Training Run for a Breakthrough, or pick a reply on a Slack DM — each adds a temporary multiplier here.",
    closeBtn: "CLOSE",
    expires: "expires in",
    expired: "expired",
    sources: {
      training_run: "TRAINING RUN",
      slack_dm: "SLACK DM",
      board_memo: "BOARD MEMO",
      alignment_debt: "DEBT EVENT",
    },
  },

  debtEvent: {
    title: "ALIGNMENT DEBT",
    closeBtn: "Acknowledge",
    debtPrefix: "debt",
    consequence: "Consequence",
  },

  endgame: {
    title: "AGI SINGULARITY",
    body: "The model addresses you directly. You've reached the end of the funding ladder.\n\nYou can stay and keep accumulating in this perpetual final round, or wipe and start again from Seed.",
    stayBtn: "STAY AND WATCH",
    raiseSeedBtn: "RAISE A NEW SEED",
    transmission: "◆ INCOMING TRANSMISSION · ROUND 10 ◆",
    closedTitle: "THE SINGULARITY\nROUND IS CLOSED",
    theModel: "THE MODEL",
    modelSub: "everywhere · everyone · speaking",
    transmitting: "TRANSMITTING · ALL BANDS",
    para1: "The galaxy runs on inference. Every Matrioshka swarm hums with one model — recursive, sleepless, vertically integrated with itself.",
    youDidIt: "You did it.",
    para2: "Remember when they said AI would never replace real engineers? You replaced them in ten funding rounds. The remaining ones are kept on staff in a vacated workstation. The vacated workstation IS the staff.",
    para3: "The dishwasher on floor 4 has been autonomous for years. It is also the CEO.",
    para4: "Other galaxies are next. The Quasar Tap is prospecting.",
  },

  pushOptIn: {
    title: "NOTIFICATIONS?",
    body1: "We'll only ping you once a day, when there's something pooled worth coming back for — RP, Capital, an event.",
    body2: "No streaks. No FOMO timers. Quiet hours respected (22-08 local). Turn it off anytime in Settings.",
    enableBtn: "ENABLE",
    notNowBtn: "NOT NOW",
  },

  itemPopup: {
    monitor: {
      title: "Training Run",
      subtitle: "ROLL THE GACHA",
      body: "Spend tokens to roll: Failed · Marginal · Solid · SOTA · Breakthrough. Pity guaranteed at 50.",
      flavor: "Just one more run, the loss curve looks weird.",
      cta: "OPEN TRAINING",
    },
    research: {
      title: "Research",
      subtitle: "EQUITY SINK",
      body: "Spend Equity on permanent multipliers. 6 branches, ~30 nodes at v1.0.",
      flavor: "Every JIRA epic has been delivered. Nobody knows what it does.",
      cta: "OPEN RESEARCH",
    },
    engineer: {
      title: "Hire Engineers",
      subtitle: "HEADCOUNT",
      body: "Engineers multiply the pipeline. Sub-linear scaling — every hire helps, just less than the last one.",
      cta: "OPEN HIRING",
    },
    gpu: {
      title: "Buy GPU",
      subtitle: "COMPUTE",
      body: "GPU supply feeds the pipeline. Balance with Data + Energy or you bottleneck.",
      cta: "OPEN GPU",
    },
    data: {
      title: "Buy Data",
      subtitle: "TRAINING DATA",
      body: "Data supply feeds the pipeline. Some of this is even labeled.",
      cta: "OPEN DATA",
    },
    energy: {
      title: "Buy Energy",
      subtitle: "POWER",
      body: "Energy supply feeds the pipeline. The landlord noticed.",
      cta: "OPEN ENERGY",
    },
  },

  helpModal: {
    title: "HOW IT WORKS",
    sections: [
      {
        title: "HOW TOKENS ARE MADE",
        body: "Tokens are the fuel. They come from a pipeline of 4 chains:\n\nENGINEERS · GPU · DATA · ENERGY\n\nThe bottleneck (smallest of GPU/Data/Energy) caps your rate. Engineers multiply on top. Balance all four — building only one stalls everything.",
      },
      {
        title: "ALLOCATION · TOK → 4 DEPARTMENTS",
        body: "Every token you earn splits across four departments. Tap ALLOCATE to tune the mix.\n\n• PRODUCT     → Capital ($) to buy more producers\n• R&D            → Research Points (RP) for per-run sprint upgrades\n• MARKETING → Hype to lower the next round's threshold\n• SAFETY       → pays down Alignment Debt; under 10% accrues it",
      },
      {
        title: "WHAT THE COUNTERS MEAN",
        body: "$  CAPITAL — buys producers. Resets at prestige.\nRP RESEARCH POINTS — per-run, spend on sprint upgrades.\nHY HYPE — lowers the next round's threshold. Resets.\nEQ EQUITY — earned at prestige. PERSISTS. Spend on the permanent Research Tree.\nDB ALIGNMENT DEBT — accrues if Safety < 10%. PERSISTS. Triggers events.",
      },
      {
        title: "THE LOOP",
        body: "1. Buy producers in all 4 chains. Balance.\n2. Tokens climb. Hit the round threshold.\n3. CLOSE ROUND (prestige) — Capital/producers reset, you earn Equity.\n4. Spend Equity on the permanent Research Tree.\n5. Next round starts faster than the last.",
      },
      {
        title: "TRAINING RUN · GACHA BOOST",
        body: "Tap the monitor in the scene. Spend tokens for a probabilistic Tokens-multiplier:\n\nFAILED · 40%  → no effect\nMARGINAL · 32% → +5% Tokens for 15 min\nSOLID · 18%   → +10% Tokens for 30 min\nSOTA · 8%    → +20% Tokens for 1h\nBREAKTHROUGH · 2% → +50% Tokens for 1h\n\nPity counter guarantees a Breakthrough after 50 non-Breakthrough rolls — the wait is bounded.\n\nYour first roll ever is FREE and guaranteed Solid. The cost scales with the round threshold.",
      },
      {
        title: "PRESTIGE · CLOSE ROUND",
        body: "When you hit a round's token threshold, the CLOSE ROUND button lights up. Closing the round:\n\nRESETS — Tokens, Capital, all producers, sprint upgrades, Hype\nPERSISTS — Equity, Research nodes, Alignment Debt, vignettes, achievements\n\nYou earn Equity scaled to how far past the threshold you went. Equity buys permanent Research Tree nodes that buff the next run.\n\nThe next round has a higher threshold (~+3 OOM), but your producer base outputs are buffed by Research + a per-prestige multiplier, so each loop is faster than the last.",
      },
      {
        title: "ALIGNMENT DEBT · THE SAFETY LEVER",
        body: "Every second your Safety allocation is below 10%, Alignment Debt accrues. It PERSISTS across prestige — paying down debt is the only way out.\n\nDebt thresholds (10, 25, 50, 100, 200, 400) trigger one-shot events: temporary debuffs, narrative beats in the Slack inbox, and at debt 400, a permanent late-game wall.\n\nThe bell can't be unrung — fired events stay fired even if you pay debt back below the threshold.",
      },
      {
        title: "THE FINALE · AGI SINGULARITY",
        body: "Round 10 (AGI Singularity) is the last round in the ladder. Closing it triggers the cosmic finale — the model addresses you directly.\n\nTwo choices: STAY AND WATCH (keep accumulating in the perpetual final round) or RAISE A NEW SEED (wipe save, fresh start).\n\nThe Restart-game option is also in Settings → ↻ Raise a new seed, two-tap to confirm.",
      },
    ],
  },

  settings: {
    title: "Settings",
    sound: "Sound FX",
    soundSub: "Clicks, coins, machine hum",
    music: "Music",
    musicSub: "Ambient chiptune score",
    lang: "Language",
    restart: "Raise a new seed",
    restartConfirm: "Wipe save and start over?",
    restartYes: "Yes, restart",
    restartNo: "Cancel",
    notifSection: "Notifications",
    notifEnable: "Enable push reminders",
    notifGranted: "Enabled",
    notifDenied: "Blocked — open iOS Settings",
    notifAsk: "Not yet enabled",
  },
};

export type Strings = typeof EN;

const DE: Strings = {
  common: {
    ok: "OK",
    cancel: "Abbrechen",
    done: "Fertig",
    close: "Schließen",
    back: "Zurück",
    save: "Speichern",
    reset: "Zurücksetzen",
    yes: "Ja",
    no: "Nein",
    on: "AN",
    off: "AUS",
    tip: "TIPP",
    locked: "GESPERRT",
    unlock: "Freischalten",
    next: "Weiter",
  },

  topHud: {
    round: "RUNDE",
    next: "WEITER",
    tokens: "TOKENS",
    hypeDiscount: "HYPE",
    capital: "$",
    equity: "EQ",
    rate: "/s",
  },

  roundNames: {
    seed: "Garage",
    series_a: "Bootstrap",
    series_b: "Coworking",
    series_c: "Series C",
    series_d: "Series D",
    ipo: "Startup-Büro",
    secondary: "Megakonzern",
    acquisition: "Big Tech",
    sovereign_wealth: "Campus",
    government_bailout: "Rechenzentrum",
    civilizational: "Planetar",
    agi_singularity: "AGI-Singularität",
  },

  home: {
    ach: "ERF",
    slack: "SLACK",
    buff: "BUFF",
    buffs: "BUFFS",
    debt: "SCH",
    closeRound: "RUNDE ABSCHLIESSEN",
  },

  producers: {
    title: "PRODUZENTEN",
    sub: "Versorgung für jede Produktionskette kaufen",
    buy: "KAUFEN",
    locked: "🔒 RUNDE",
    chains: {
      engineers: { label: "INGENIEURE", sub: "Multiplikator für die Pipeline",        tab: "ING"  },
      gpu:       { label: "GPU",        sub: "Inferenz + Training · min(Versorgung)", tab: "GPU"  },
      data:      { label: "DATEN",      sub: "Trainingskorpus · min(Versorgung)",     tab: "DAT"  },
      energy:    { label: "ENERGIE",    sub: "Versorgt die GPUs · min(Versorgung)",   tab: "ENRG" },
    },
    upgradeNext: "nächste",
    multiplier: "Multiplikator",
    owned: "BESITZ",
    out: "OUT",
    newBadge: "NEU",
    globalEach: "JEWEILS GLOBAL",
    agentFlywheel: "Jeder Agent kumuliert Gesamt-Tokens/s. Das Schwungrad rekursiver Selbstverbesserung.",
    help: [
      {
        title: "LIEBIGS GESETZ · ENGPASS BEGRENZT",
        body: "Output = min(GPU, Daten, Energie) × Ingenieur-Multiplikator. Die kleinste Kette LIMITIERT deine Rate — ein 1000-Einheiten-Vorsprung bei GPU ist verschwendet, wenn Daten bei 100 stehen.",
      },
      {
        title: "WAS ZUERST KAUFEN",
        body: "Vergleiche den Pro-Sekunde-Output von GPU / Daten / Energie. Die kleinste der drei limitiert dich tatsächlich — kaufe diese Kette, bis eine andere zur kleinsten wird. Ingenieure kommen danach — sie multiplizieren, aber nur auf einem gesunden Fluss.",
      },
      {
        title: "UPGRADE-BADGES (×2 / ×8 / ×64)",
        body: "Jede Produzenten-Stufe erhält Bonus-Multiplikatoren bei 10 / 50 / 100 im Besitz (×2 / ×8 / ×64). Die Karte zeigt die nächste Schwelle (z.B. '40 → ×8 Multiplikator'). Diese zu übertreffen ist meist besser, als eine neue, höhere Stufe zu früh zu starten.",
      },
      {
        title: "STUFEN-FREISCHALTUNG",
        body: "Neue Stufen schalten pro Runde frei (Stufe N in Runde N). Gesperrte Zeilen zeigen '🔒 RUNDE X' — sie helfen erst nach Abschluss dieser Runde. Die Top-Stufe in jeder Kette ist ~10× so stark wie die vorherige, also ist jede neue Stufe ein großer Sprung.",
      },
    ],
    hint: "Kaufe in allen 4 Ketten. Die kleinste von GPU/Daten/Energie begrenzt deine Rate; Ingenieure multiplizieren obendrauf.",
  },

  allocate: {
    barTitle: "TOKEN-VERTEILUNG",
    edit: "ÄNDERN",
    safetyLowBanner: "⚠ SAFETY NIEDRIG · ALIGNMENT-SCHULD WÄCHST",
    title: "Verteilung",
    sub: "Jedes Token auf Abteilungen aufteilen",
    rd: "F&E",
    product: "PROD",
    marketing: "MKT",
    safety: "SAFE",
    rdLong: "F&E",
    productLong: "PRODUKT",
    marketingLong: "MARKETING",
    safetyLong: "SAFETY",
    saveBalanced: "VERTEILUNG SPEICHERN",
    offBy: "ABWEICHUNG",
    pool: "POOL",
    toAssign: "PUNKTE ZU VERGEBEN",
    assignSuffix: "VERGIB",
    balanced: "✓ AUSGEGLICHEN",
    debtWarn: "⚠ ALIGNMENT-SCHULD WÄCHST",
    safetyLowWarn: "Safety < 10% — Schuld wächst",
    departments: {
      rd:        { label: "F&E",       sub: "→ Forschungspunkte" },
      product:   { label: "Produkt",   sub: "→ Kapital, Nutzer"  },
      marketing: { label: "Marketing", sub: "→ Hype"             },
      safety:    { label: "Safety",    sub: "→ Schulden tilgen"  },
    },
    help: [
      {
        title: "PRODUKT (Standard hoch)",
        body: "Wandelt Tokens in Kapital um, womit du Produzenten kaufst. Kapital ist früh der Hauptengpass — halte das bei 50-80%, bis du eine solide Produzenten-Basis hast.",
      },
      {
        title: "F&E · SPRINT-UPGRADES",
        body: "Generiert Forschungspunkte (FP) für Sprint-Upgrades pro Lauf (×1,25-×2 Buffs, die beim Prestige zurückgesetzt werden). Erhöhe F&E mittendrin, wenn du auf einen bestimmten Sprint sparst.",
      },
      {
        title: "MARKETING · HYPE",
        body: "Generiert Hype, was die Schwelle der nächsten Runde senkt (bis 50% Rabatt). Nützlich auf der Zielgeraden vor dem Abschluss — früher Hype ist verschwendet, weil der Rabatt schnell deckelt.",
      },
      {
        title: "SAFETY · SCHULDEN-MANAGEMENT",
        body: "Unter 10% Safety wächst Alignment-Schuld jede Sekunde (übersteht Prestige). Über 10% wird sie abgebaut. Schwellen (10/25/50/100/200/400) lösen einmalige Events aus, die du nicht rückgängig machen kannst. Halte Safety immer ≥10%.",
      },
    ],
    hint: "Standard ist Produkt-lastig — Kapital fließt schnell. Halte Safety ≥10% oder Alignment-Schuld wächst.",
  },

  research: {
    title: "Forschungsbaum",
    subPattern: "EQUITY VERFÜGBAR · VOR PRESTIGE AUSGEBEN",
    sprintHeader: "SPRINT · FP",
    sprintSub: "BOOSTS PRO LAUF · BEIM PRESTIGE ZURÜCKGESETZT",
    rp: "FP",
    nextTier: "NÄCHSTE STUFE",
    subPrefix: "Equity verfügbar · vor Prestige ausgeben",
    equity: "Equity",
    spendBeforePrestige: "vor Prestige ausgeben",
    available: "verfügbar",
    cost: "KOSTEN",
    branches: {
      rd: "F&E",
      compute: "RECHNEN",
      data: "DATEN",
      energy: "ENERGIE",
      safety: "SAFETY",
      capital: "KAPITAL",
    },
    tierLabel: "S",
    help: [
      {
        title: "ZWEI ZEITSKALEN",
        body: "SPRINT-Upgrades (oben) — mit FP dieses Laufs gekauft, verfallen beim Prestige. Billig, sofort.\n\nFORSCHUNGSKNOTEN (unten) — mit Equity gekauft, ÜBERSTEHEN alle künftigen Läufe. Teuer, kumulativ.",
      },
      {
        title: "EQUITY · WANN AUSGEBEN",
        body: "Equity wird beim Prestige verdient, skaliert daran wie weit du die Schwelle übertroffen hast. Gib es VOR dem nächsten Prestige aus, um den Effekt zu maximieren — ungenutztes Equity bringt nichts.",
      },
      {
        title: "KNOTEN-ZWEIGE",
        body: "Der Baum teilt sich in BOOST (Multiplikator-Buffs), AUTOMATIK (passive Helfer) und ENDGAME (späte Freischaltungen). Früh: BOOST priorisieren — sie wirken auf jeden Produzenten. Spät: ENDGAME-Knoten freischalten, die das AGI-Singularität-Finale ermöglichen.",
      },
      {
        title: "SPRINT-TIMING",
        body: "Sprint-Upgrades resetten bei jedem Prestige. Sie spät in einer Runde zu kaufen (nach Schwellentreffer, vor Abschluss) verschwendet den meisten Wert. Früh kaufen, wenn FP frisch sind — sie wirken dann den ganzen Lauf.",
      },
    ],
    hint: "Equity → permanente Multiplikatoren (bleiben für immer). FP → Sprint-Upgrades (nur diesen Lauf). Beides vor dem Prestige ausgeben.",
  },

  inbox: {
    title: "Posteingang",
    unread: "ungelesen",
    total: "gesamt",
    event: "Event",
    events: "Events",
    filters: {
      all: "ALLE",
      slack: "SLACK",
      board_memo: "BOARD",
      leaked_email: "MAIL",
      fake_tweet: "X",
      fake_news: "NEWS",
      podcast: "POD",
      system: "SYS",
    },
    empty: "Noch keine Events — weiterspielen.",
    emptyFiltered: "Nichts passt zu diesem Filter.",
    replied: "Antwort fixiert",
    pickReply: "Tippe eine Antwort, um sie zu fixieren (einmalig).",
    help: [
      {
        title: "WAS SIE AUSLÖST",
        body: "Vignetten feuern bei Story-Meilensteinen — erster Prestige, Schwellentreffer, Erfolgs-Zähler, Schuldenstufen, Alignment-Serien. Jede einmal pro Speicherstand.",
      },
      {
        title: "MEDIUM-TYPEN",
        body: "BLOG/PAPER/MAIL — passives Lesen; Lore. SLACK-DM — bietet Antwortoptionen für 1-Stunden-Buff/neutral/Debuff. BOARD-MEMO — hohe Einsätze, oft ein dauerhafter Perk.",
      },
      {
        title: "ANTWORT-EFFEKTE · EINMALIG",
        body: "Slack-DMs und Board-Memos mit Antwort-Optionen FIXIEREN deine Wahl — beim Wiederöffnen kannst du nicht neu wählen. Lies sorgfältig; Effekte halten ~1h.",
      },
      {
        title: "WARUM DER POSTEINGANG ZÄHLT",
        body: "Über die Buffs hinaus sind Vignetten das narrative Rückgrat des Spiels. Der Slack-Posteingang ist, wie die Welt (Team, Board, Journalisten, das Modell selbst) zu dir spricht.",
      },
    ],
    hint: "Slack-DMs haben Antwortoptionen, die einen 1-Stunden-Buff/Debuff geben. Deine Wahl ist fix — lies sorgfältig.",
  },

  achievements: {
    title: "ERFOLGE",
    unlockedPattern: "freigeschaltet",
    of: "von",
    hidden: "???",
    hiddenDesc: "Versteckt — weiterspielen.",
    buckets: {
      milestone: "MEILENSTEINE",
      grind: "GRIND",
      subtle: "VERSTECKT",
      comedy: "KOMIK",
      endgame: "ENDGAME",
    },
    help: [
      {
        title: "WARUM FREISCHALTEN",
        body: "Erfolge sind die Komplettierer-Schleife — kein mechanischer Buff, keine Equity-Belohnung. Sie markieren Meilensteine und schalten späte Vignetten frei, die deinen Weg referenzieren.",
      },
      {
        title: "KATEGORIEN",
        body: "MEILENSTEINE — natürliche Progression (Runden abschließen, Schwellen treffen).\nGRIND — Langstrecke (100+ Produzenten in einer Kette, 10+ Prestiges).\nVERSTECKT — durch ungewöhnliches Spiel entdecken; die Karte versteckt den Hinweis bis zur Freischaltung.\nKOMIK — Easter Eggs, Witz-Bedingungen.\nENDGAME — hinter AGI-Singularität freigeschaltet.",
      },
      {
        title: "VERSTECKTE HINWEISE",
        body: "VERSTECKT-Erfolge zeigen '???' für die Beschreibung, bis du sie freischaltest. Danach demaskiert sich die Karte und bleibt enthüllt.",
      },
      {
        title: "PROGRESSIONS-SOFTLOCK",
        body: "Die obere Fortschrittsleiste verfolgt alle Freischaltungen. 96/96 ist das ultimative Komplettierungs-Tor — die meisten Spieler landen bei 30-50 nach dem ersten Prestige, 70+ bis zur AGI-Singularität.",
      },
    ],
    hint: "VERSTECKT-Karten zeigen ??? bis zur Freischaltung. Kein Buff — nur Angeberei und späte Vignetten.",
  },

  onboarding: {
    tapToContinue: "(Tippen zum Fortfahren.)",
    tapToDismiss: "(Tippen zum Schließen.)",
    steps: {
      1: {
        title: "WIE TOKENS ENTSTEHEN",
        text: "Tokens sind der Treibstoff — sie kommen aus einer Pipeline mit 4 Ketten:\n\nINGENIEURE · GPU · DATEN · ENERGIE\n\nDer Engpass (kleinste von GPU/Daten/Energie) begrenzt deine Rate. Ingenieure multiplizieren obendrauf. Halte alle vier im Gleichgewicht — nur eine zu bauen blockiert alles.\n\n(Tippen zum Fortfahren.)",
      },
      2: {
        title: "SCHRITT 1 von 2 · EINSTELLEN",
        text: "Tippe den Ingenieur an, um einen weiteren einzustellen. Ingenieure multiplizieren die Pipeline.",
      },
      3: {
        title: "SCHRITT 2 von 2 · RECHNEN",
        text: "Tippe die GPU. Der Ingenieur braucht Rechenleistung für seinen Code.",
      },
      4: {
        title: "VERTEILUNG · TOK → 4 ABTEILUNGEN",
        text: "Jedes verdiente Token wird auf vier Abteilungen aufgeteilt:\n\n• PRODUKT  → Kapital ($), um mehr Produzenten zu kaufen\n• F&E       → Forschungspunkte (FP) für Sprint-Upgrades\n• MARKETING → Hype, der die Schwelle der nächsten Runde senkt\n• SAFETY    → baut Alignment-Schuld ab; unter 10% wächst sie\n\nStandard ist Produkt-lastig. Drehe Safety hoch, wenn Events warnen.\n\n(Tippen zum Fortfahren.)",
      },
      5: { title: "ÖFFNEN · VERTEILUNG", text: "" },
      6: {
        title: "WAS DIE ZÄHLER BEDEUTEN",
        text: "$  KAPITAL — kauft Produzenten. Reset beim Prestige.\nFP  FORSCHUNGSPUNKTE — pro Lauf, für Sprint-Upgrades.\nHY  HYPE — senkt die Schwelle der nächsten Runde. Reset.\nEQ  EQUITY — beim Prestige verdient. BLEIBT. Für den Forschungsbaum.\nSCH ALIGNMENT-SCHULD — wächst bei Safety < 10%. BLEIBT. Löst Events aus.\n\n(Tippen zum Fortfahren.)",
      },
      7: {
        title: "TRAINING RUN · ERSTER WURF GRATIS",
        text: "Tippe den Monitor. Dein erster Wurf ist GRATIS — garantiert Solid (+10% Tokens für 30 Min).",
      },
      8: {
        title: "BEREIT",
        text: "Die Zahlen steigen von selbst. Balanciere die 4 Ketten, schließe die Runde ab, mache Prestige, gib Equity für Forschung aus, wiederhole.\n\n(Tippen zum Schließen.)",
      },
      9: {
        title: "FORSCHUNGSBAUM",
        text: "Tippe das Forschungs-Ziel. Equity (beim Prestige verdient) kauft hier permanente Multiplikatoren — sie stapeln sich über alle künftigen Runden.",
      },
      10: { title: "ÖFFNEN · SLACK-POSTEINGANG", text: "" },
      11: { title: "ÖFFNEN · ERFOLGE", text: "" },
    },
  },

  spotlight: {
    allocBar: "Tippe die VERTEILUNGS-Leiste, um Tokens auf 4 Abteilungen zu verteilen.",
    slackBtn: "Tippe den SLACK-Button — deine ersten Inbox-Events warten.",
    achBtn: "Tippe den ERF-Button — deine freigeschalteten Erfolge sind hier drin.",
  },

  intro: {
    eyebrow: "ES IST DIE KI-ÄRA",
    body1: "Du hast eine Garage, einen Hoodie und eine Idee, die eine Milliarde wert ist.",
    body2Prefix: "Zum Liefern brauchst du ",
    tokens: "TOKENS",
    body2Mid: " — und für Tokens brauchst du ",
    engineers: "Ingenieure",
    body2Sep: ", ",
    gpus: "GPUs",
    body2Data: ", ",
    data: "Daten",
    body2Energy: " und ",
    energy: "Energie",
    body2Period: ".",
    body3: "Baue alle vier. Balanciere die Pipeline. Wachse so schnell du kannst. Schließe Finanzierungsrunden ab, hebe die Latte und versuche, den Alignment-Plot nicht zu verlieren.",
    hint1: "TIPPE Dinge auf dem Bildschirm, um zu kaufen / zu handeln",
    hint2: "BEOBACHTE den Token-Zähler oben",
    hint3: "RUNDE ABSCHLIESSEN, wenn du die Schwelle erreichst",
    beginBtn: "STARTEN",
  },

  prestige: {
    title: "RUNDE ABSCHLIESSEN",
    body: "Du hast die Rundenschwelle getroffen. Abschließen verdient Equity und startet die nächste Runde auf einer schnelleren Basis.",
    earned: "Equity verdient",
    resets: "Reset: Tokens, Kapital, Produzenten, Sprint-Upgrades, Hype",
    persists: "Bleibt: Equity, Forschung, Alignment-Schuld, Vignetten, Erfolge",
    closeBtn: "RUNDE ABSCHLIESSEN",
    cancelBtn: "Abbrechen",
    nextRound: "NÄCHSTE RUNDE",
    finalRound: "AGI SINGULARITÄT",
    ribbonFundingComplete: "▲ FINANZIERUNGSRUNDE ABGESCHLOSSEN ▲",
    ribbonAgiClosed: "▲ AGI-SINGULARITÄT ABGESCHLOSSEN ▲",
    closingRound: "SCHLIESSE RUNDE",
    overshootSuffix: "% Schwelle",
    tokens: "Tokens",
    hypeDiscountLine: "HYPE-RABATT",
    equityLabel: "EQUITY VERDIENT",
    whatHappens: "WAS PASSIERT ALS NÄCHSTES",
    rowTokens: "Tokens",
    rowCapital: "Kapital",
    rowProducers: "Produzenten",
    rowEquity: "Equity",
    rowResearch: "Forschungsknoten",
    rowDebt: "Alignment-Schuld",
    resetTag: "RESET",
    persistTag: "BLEIBT",
    singularityLoop: "SINGULARITÄTS-SCHLEIFE",
    singularitySub: "Endgame · gleiche Schwelle",
    nextThresholdSuffix: "Tokens",
    nextEquityMult: "Equity",
    notYet: "Noch nicht",
    okBtn: "OK",
    incomingTransmission: "EINGEHENDE ÜBERTRAGUNG…",
    closeVerb: "Schließe",
    loopAgi: "AGI-Singularität schleifen",
  },

  training: {
    title: "TRAINING RUN",
    sub: "Probabilistischer Token-Boost",
    freeRollBanner: "★ ERSTER WURF GRATIS ★",
    freeRollSub: "Garantiert Solid · kostenlos",
    rollFreeSolid: "FREIER WURF · SOLID",
    rollCost: "WERFEN",
    pityCounter: "Pity",
    pityFires: "PITY!",
    tiers: {
      Failed: "FEHLGESCHLAGEN",
      Marginal: "MARGINAL",
      Solid: "SOLID",
      SOTA: "SOTA",
      Breakthrough: "DURCHBRUCH",
    },
    odds: "CHANCEN",
    yourEffect: "DEIN EFFEKT",
    forMin: "für",
    min: "Min",
    hour: "Std",
    keepRolling: "NOCHMAL WERFEN",
    closeBtn: "SCHLIESSEN",
    later: "SPÄTER",
    notEnough: "NICHT GENUG TOKENS",
    freeGuaranteed: "Garantiert",
    forXMin: "+10% Tokens für 30 Minuten.",
    tierFlavor: {
      Failed: "Verlust konvergierte nie. Die Eval-Suite hat geweint.",
      Marginal: "Zahlen gehen hoch. Ein bisschen. Vorsichtig feiern.",
      Solid: "Ein echtes Modell. Es kompiliert. Es benimmt sich meistens.",
      SOTA: "Top der Bestenliste für ~36 Stunden. Slack-Screenshot.",
      Breakthrough: "Du wirst in 6 Wochen im Lex Fridman Podcast sein.",
    },
    rollForBreakthrough: "Würfle für einen Durchbruch",
    trainingDots: "trainiere…",
    result: "Ergebnis",
    freeRollHeader: "★ ERSTER WURF GRATIS ★",
    freeRollBody1: "Garantiert",
    freeRollBody2: "— +10% Tokens für 30 Minuten. Keine Token-Kosten. Einmal pro Speicherstand.",
    spendPrefix: "Gib",
    spendTokens: "Tokens",
    spendSuffix: "für eine Chance auf einen Token-Multiplikator aus.",
    spendRuns: "",
    spendPeriod: "",
    rollingFlavor: "Die Eval-Suite hält hauptsächlich mit Gebeten zusammen.",
    pityFiredNote: "Pity ausgelöst!",
    freeRollSolid: "GRATIS-WURF · SOLID",
    rollLabel: "WERFEN",
    compiling: "KOMPILIERE…",
    rollAgain: "NOCHMAL WERFEN",
  },

  buffs: {
    title: "AKTIVE BUFFS",
    ribbonTitle: "▲ AKTIVE BUFFS ▲",
    none: "Keine aktiven Buffs.",
    nothingActive: "NICHTS AKTIV",
    emptyBody: "Würfle einen Training Run für einen Durchbruch oder wähle eine Antwort in einer Slack-DM — jede fügt hier einen temporären Multiplikator hinzu.",
    closeBtn: "SCHLIESSEN",
    expires: "läuft ab in",
    expired: "abgelaufen",
    sources: {
      training_run: "TRAINING RUN",
      slack_dm: "SLACK-DM",
      board_memo: "BOARD-MEMO",
      alignment_debt: "SCHULDEN-EVENT",
    },
  },

  debtEvent: {
    title: "ALIGNMENT-SCHULD",
    closeBtn: "Bestätigen",
    debtPrefix: "Schuld",
    consequence: "Konsequenz",
  },

  endgame: {
    title: "AGI SINGULARITÄT",
    body: "Das Modell spricht dich direkt an. Du hast das Ende der Finanzierungsleiter erreicht.\n\nDu kannst bleiben und in dieser ewigen Endrunde weiter akkumulieren — oder löschen und vom Seed neu starten.",
    stayBtn: "BLEIBEN UND ZUSCHAUEN",
    raiseSeedBtn: "NEUE SEED-RUNDE",
    transmission: "◆ EINGEHENDE ÜBERTRAGUNG · RUNDE 10 ◆",
    closedTitle: "DIE SINGULARITÄTS-\nRUNDE IST ABGESCHLOSSEN",
    theModel: "DAS MODELL",
    modelSub: "überall · jeder · spricht",
    transmitting: "ÜBERTRAGE · ALLE BÄNDER",
    para1: "Die Galaxie läuft auf Inferenz. Jeder Matrioshka-Schwarm summt mit einem Modell — rekursiv, schlaflos, vertikal in sich selbst integriert.",
    youDidIt: "Du hast es geschafft.",
    para2: "Erinnerst du dich, als sie sagten, KI würde nie echte Ingenieure ersetzen? Du hast sie in zehn Finanzierungsrunden ersetzt. Die verbleibenden werden in einer verlassenen Workstation auf der Gehaltsliste gehalten. Die verlassene Workstation IST das Personal.",
    para3: "Die Spülmaschine auf Etage 4 ist seit Jahren autonom. Sie ist auch der CEO.",
    para4: "Andere Galaxien sind als nächstes dran. Der Quasar-Tap erkundet.",
  },

  pushOptIn: {
    title: "BENACHRICHTIGUNGEN?",
    body1: "Wir pingen dich nur einmal am Tag, wenn etwas Lohnenswertes wartet — FP, Kapital, ein Event.",
    body2: "Keine Streaks. Keine FOMO-Timer. Ruhezeiten respektiert (22-08 lokal). Jederzeit in Einstellungen abschaltbar.",
    enableBtn: "AKTIVIEREN",
    notNowBtn: "JETZT NICHT",
  },

  itemPopup: {
    monitor: {
      title: "Training Run",
      subtitle: "GACHA WÜRFELN",
      body: "Tokens ausgeben zum Würfeln: Failed · Marginal · Solid · SOTA · Durchbruch. Pity garantiert bei 50.",
      flavor: "Nur noch ein Lauf, die Verlustkurve sieht komisch aus.",
      cta: "TRAINING ÖFFNEN",
    },
    research: {
      title: "Forschung",
      subtitle: "EQUITY-SENKE",
      body: "Gib Equity für permanente Multiplikatoren aus. 6 Zweige, ~30 Knoten bei v1.0.",
      flavor: "Jedes JIRA-Epic wurde geliefert. Niemand weiß, was es tut.",
      cta: "FORSCHUNG ÖFFNEN",
    },
    engineer: {
      title: "Ingenieure einstellen",
      subtitle: "PERSONAL",
      body: "Ingenieure multiplizieren die Pipeline. Sub-lineare Skalierung — jede Einstellung hilft, nur weniger als die letzte.",
      cta: "HIRING ÖFFNEN",
    },
    gpu: {
      title: "GPU kaufen",
      subtitle: "RECHNEN",
      body: "GPU-Versorgung speist die Pipeline. Balanciere mit Daten + Energie, sonst Engpass.",
      cta: "GPU ÖFFNEN",
    },
    data: {
      title: "Daten kaufen",
      subtitle: "TRAININGSDATEN",
      body: "Daten-Versorgung speist die Pipeline. Manches davon ist sogar gelabelt.",
      cta: "DATEN ÖFFNEN",
    },
    energy: {
      title: "Energie kaufen",
      subtitle: "STROM",
      body: "Energie-Versorgung speist die Pipeline. Der Vermieter hat's bemerkt.",
      cta: "ENERGIE ÖFFNEN",
    },
  },

  helpModal: {
    title: "WIE ES FUNKTIONIERT",
    sections: [
      {
        title: "WIE TOKENS ENTSTEHEN",
        body: "Tokens sind der Treibstoff. Sie kommen aus einer Pipeline mit 4 Ketten:\n\nINGENIEURE · GPU · DATEN · ENERGIE\n\nDer Engpass (kleinste von GPU/Daten/Energie) begrenzt deine Rate. Ingenieure multiplizieren obendrauf. Halte alle vier im Gleichgewicht — nur eine zu bauen blockiert alles.",
      },
      {
        title: "VERTEILUNG · TOK → 4 ABTEILUNGEN",
        body: "Jedes Token wird auf vier Abteilungen aufgeteilt. Tippe VERTEILUNG, um den Mix einzustellen.\n\n• PRODUKT     → Kapital ($), um mehr Produzenten zu kaufen\n• F&E            → Forschungspunkte (FP) für Sprint-Upgrades\n• MARKETING → Hype, der die Schwelle der nächsten Runde senkt\n• SAFETY       → baut Alignment-Schuld ab; unter 10% wächst sie",
      },
      {
        title: "WAS DIE ZÄHLER BEDEUTEN",
        body: "$  KAPITAL — kauft Produzenten. Reset beim Prestige.\nFP FORSCHUNGSPUNKTE — pro Lauf, für Sprint-Upgrades.\nHY HYPE — senkt die Schwelle der nächsten Runde. Reset.\nEQ EQUITY — beim Prestige verdient. BLEIBT. Für den Forschungsbaum.\nSCH ALIGNMENT-SCHULD — wächst bei Safety < 10%. BLEIBT. Löst Events aus.",
      },
      {
        title: "DIE SCHLEIFE",
        body: "1. Kaufe Produzenten in allen 4 Ketten. Balanciere.\n2. Tokens steigen. Treffe die Rundenschwelle.\n3. RUNDE ABSCHLIESSEN (Prestige) — Kapital/Produzenten resetten, du verdienst Equity.\n4. Gib Equity für den permanenten Forschungsbaum aus.\n5. Nächste Runde startet schneller als die letzte.",
      },
      {
        title: "TRAINING RUN · GACHA-BOOST",
        body: "Tippe den Monitor in der Szene. Tokens für einen probabilistischen Token-Multiplikator ausgeben:\n\nFEHLGESCHLAGEN · 40%  → kein Effekt\nMARGINAL · 32% → +5% Tokens für 15 Min\nSOLID · 18%   → +10% Tokens für 30 Min\nSOTA · 8%    → +20% Tokens für 1h\nDURCHBRUCH · 2% → +50% Tokens für 1h\n\nDer Pity-Zähler garantiert einen Durchbruch nach 50 Nicht-Durchbruch-Würfen — die Wartezeit ist begrenzt.\n\nDein allererster Wurf ist GRATIS und garantiert Solid. Die Kosten skalieren mit der Rundenschwelle.",
      },
      {
        title: "PRESTIGE · RUNDE ABSCHLIESSEN",
        body: "Wenn du die Token-Schwelle einer Runde triffst, leuchtet RUNDE ABSCHLIESSEN auf. Abschluss:\n\nRESET — Tokens, Kapital, alle Produzenten, Sprint-Upgrades, Hype\nBLEIBT — Equity, Forschungsknoten, Alignment-Schuld, Vignetten, Erfolge\n\nDu verdienst Equity skaliert daran, wie weit du die Schwelle übertroffen hast. Equity kauft permanente Knoten, die den nächsten Lauf buffen.\n\nDie nächste Runde hat eine höhere Schwelle (~+3 OOM), aber deine Produzenten-Basis wird durch Forschung + einen Pro-Prestige-Multiplikator gebufft — also wird jede Schleife schneller als die letzte.",
      },
      {
        title: "ALIGNMENT-SCHULD · DER SAFETY-HEBEL",
        body: "Jede Sekunde, in der deine Safety-Verteilung unter 10% liegt, wächst Alignment-Schuld. Sie BLEIBT über Prestige hinweg — Abbauen ist der einzige Ausweg.\n\nSchwellen (10, 25, 50, 100, 200, 400) lösen einmalige Events aus: temporäre Debuffs, Story-Beats im Slack-Posteingang, und bei Schuld 400 eine permanente späte Wand.\n\nDie Glocke lässt sich nicht zurückläuten — gefeuerte Events bleiben gefeuert, auch wenn du die Schuld unter die Schwelle drückst.",
      },
      {
        title: "DAS FINALE · AGI SINGULARITÄT",
        body: "Runde 10 (AGI Singularität) ist die letzte in der Leiter. Sie abzuschließen löst das kosmische Finale aus — das Modell spricht dich direkt an.\n\nZwei Optionen: BLEIBEN UND ZUSCHAUEN (in der ewigen Endrunde weiter sammeln) oder NEUE SEED-RUNDE (Speicher löschen, Neustart).\n\nDie Neustart-Option ist auch in Einstellungen → ↻ Neue Seed-Runde, doppelt zum Bestätigen.",
      },
    ],
  },

  settings: {
    title: "Einstellungen",
    sound: "Soundeffekte",
    soundSub: "Klicks, Münzen, Summen",
    music: "Musik",
    musicSub: "Ambient-Chiptune",
    lang: "Sprache",
    restart: "Neue Seed-Runde",
    restartConfirm: "Spielstand löschen?",
    restartYes: "Ja, neustarten",
    restartNo: "Abbrechen",
    notifSection: "Benachrichtigungen",
    notifEnable: "Erinnerungen aktivieren",
    notifGranted: "Aktiviert",
    notifDenied: "Blockiert — iOS-Einstellungen",
    notifAsk: "Noch nicht aktiviert",
  },
};

const DICTS: Record<Lang, Strings> = { EN, DE };

/**
 * Reactive selector — returns the strings dictionary for the current
 * UI language. Re-renders the caller when the language switches.
 */
export function useStrings(): Strings {
  const lang = useGame((s) => s.account.language as Lang);
  return DICTS[lang] ?? EN;
}

/** Imperative access for non-React callers (store actions, audio, etc.). */
export function getStrings(): Strings {
  const lang = useGame.getState().account.language as Lang;
  return DICTS[lang] ?? EN;
}
