// GDD §13 color palette.
export const colors = {
  cream: "#F5EFE2",
  sage: "#7E9A85",
  terracotta: "#C97B5B",
  ink: "#2A2A2A",
  tensionRed: "#B23A48",
  gold: "#D4A24C",
  muted: "#7C7C7C",
  // helpers
  hairline: "rgba(42,42,42,0.10)",
  cardBg: "#FBF7EC",
  disabled: "#CFC9BD",
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = { sm: 6, md: 10, lg: 16 } as const;

// Three depth presets. Use sparingly — every card shouldn't pop equally.
// On RN-Web these compile to box-shadow; on iOS to shadow props; Android elevation.
export const shadow = {
  // sm — flat cards lifted barely off the page (stat cards, allocation pills)
  sm: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  // md — interactive elements that should read as clickable (producer cards, allocation card)
  md: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  // lg — important moments (prestige modal sheet, CTAs ready to fire)
  lg: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
} as const;

// Gradient pairs — use with expo-linear-gradient.
// First color = top/start, second = bottom/end. Direction set at call site.
export const gradient = {
  hero:        ["#FBF7EC", colors.cream] as [string, string],
  terracotta:  ["#D78A6B", "#B36443"] as [string, string],
  sage:        ["#94B19B", "#6A8470"] as [string, string],
  gold:        ["#E0B259", "#B68838"] as [string, string],
  tensionRed:  ["#C44A57", "#931F2D"] as [string, string],
  progress:    [colors.sage, "#5E7A65"] as [string, string],
} as const;

export const type = {
  display: { fontSize: 40, fontWeight: "700" as const, color: colors.ink },
  h1:      { fontSize: 22, fontWeight: "700" as const, color: colors.ink },
  h2:      { fontSize: 18, fontWeight: "600" as const, color: colors.ink },
  body:    { fontSize: 14, fontWeight: "400" as const, color: colors.ink },
  caption: { fontSize: 12, fontWeight: "400" as const, color: colors.muted },
  mono:    { fontSize: 12, fontFamily: "Courier", color: colors.ink },
} as const;
