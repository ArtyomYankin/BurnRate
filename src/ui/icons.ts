import {
  Banknote,
  Beaker,
  Coins,
  Cpu,
  Database,
  LucideIcon,
  Megaphone,
  Shield,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react-native";
import { ChainId } from "../core/types";
import { colors } from "./theme";

// GDD §13 mentions Lucide icons for the UI chassis. The chain set deliberately
// avoids cartoony imagery (no robots, no money bags) — these read as a
// product-management dashboard, which is the joke.
export const CHAIN_ICON: Record<ChainId, LucideIcon> = {
  engineers: Users,
  gpu: Cpu,
  data: Database,
  energy: Zap,
};

export const CHAIN_COLOR: Record<ChainId, string> = {
  engineers: colors.sage,
  gpu: colors.terracotta,
  data: colors.gold,
  energy: colors.tensionRed,
};

// Currency icons — one per currency, semantic where possible.
export const ICON = {
  tokens: Coins,
  capital: Banknote,
  hype: Megaphone,
  research: Beaker,
  equity: Trophy,
  sparkle: Sparkles,
  trend: TrendingUp,
  shield: Shield,
} as const;

export type IconKey = keyof typeof ICON;
