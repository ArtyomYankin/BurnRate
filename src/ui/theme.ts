// GDD §13 palette, expanded with tonal shades from the Claude Design mock.
// Naming convention: base = mid value, `_hi` = lightest, `_2`/`_3`/`_4` =
// darkening steps. Used by PixelScene to fake light/shadow without gradients.
export const colors = {
  cream:       "#F5EFE2",
  cream_hi:    "#FBF7EC",
  cream_2:     "#E8DCC0",
  cream_3:     "#D8C8A8",
  cream_4:     "#A89878",
  sage:        "#7E9A85",
  sage_hi:     "#A4BDA9",
  sage_2:      "#5C7560",
  sage_3:      "#3F5142",
  terracotta:  "#C97B5B",
  terracotta_hi:"#E0A07F",
  terracotta_2:"#8B5639",
  terracotta_3:"#5C3924",
  ink:         "#2A2A2A",
  ink_2:       "#1A1A1A",
  ink_hi:      "#4A4A4A",
  tensionRed:  "#B23A48",
  tension_2:   "#7A1F2A",
  tension_hi:  "#D45A68",
  gold:        "#D4A24C",
  gold_hi:     "#EBBE6E",
  gold_2:      "#B68838",
  muted:       "#7C7C7C",
  muted_2:     "#5C5C5C",
  sky:         "#B8C9CC",
  sky_2:       "#94A8AB",
  sky_3:       "#D8E0D6",
  cloud:       "#F0EAD8",
  cloud_2:     "#D8CDB6",
  // helpers
  hairline:    "rgba(42,42,42,0.10)",
  cardBg:      "#FBF7EC",
  disabled:    "#CFC9BD",
} as const;

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
} as const;

// Pixel-art: sharp corners by default; `soft` is the escape hatch for any
// surface that still wants a softened edge (e.g. the Slack DM body, which
// the GDD explicitly wants to look like real Slack — non-pixel).
export const radii = { sm: 0, md: 0, lg: 0, soft: 6 } as const;

// One-pixel grid unit. Pixel components size everything in multiples of this.
export const PIXEL = 2;

export const shadow = {
  // Hard ink-offset block — used for pressable surfaces. Crisp, no blur.
  pixel: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
} as const;

export const gradient = {
  hero:        ["#FBF7EC", colors.cream] as [string, string],
  terracotta:  ["#D78A6B", "#B36443"] as [string, string],
  sage:        ["#94B19B", "#6A8470"] as [string, string],
  gold:        ["#E0B259", "#B68838"] as [string, string],
  tensionRed:  ["#C44A57", "#931F2D"] as [string, string],
  progress:    [colors.sage, "#5E7A65"] as [string, string],
} as const;

// Three pixel fonts, each with a distinct job:
//   - display  → Silkscreen (uppercase chrome: BURN·RATE, section headers, buttons)
//   - body     → Pixelify Sans (general copy, big numbers, weight-aware)
//   - mono     → VT323 (digits/code/clock — the "terminal" feel, used in HUD rates)
export const fonts = {
  display: "Silkscreen_700Bold",
  displayRegular: "Silkscreen_400Regular",
  body: "PixelifySans_400Regular",
  bodyMedium: "PixelifySans_500Medium",
  bodySemi: "PixelifySans_600SemiBold",
  bodyBold: "PixelifySans_700Bold",
  mono: "VT323_400Regular",
} as const;

// Numeric `fontWeight` is intentionally absent — pixel fonts ship one bitmap
// per weight, and adding fontWeight on top reflows to a synthetic bold that
// breaks the pixel grid.
export const type = {
  display:    { fontFamily: fonts.bodyBold,    fontSize: 48, color: colors.ink, letterSpacing: 0 },
  h1:         { fontFamily: fonts.display,     fontSize: 16, color: colors.ink, letterSpacing: 1 },
  h2:         { fontFamily: fonts.display,     fontSize: 13, color: colors.ink, letterSpacing: 1 },
  body:       { fontFamily: fonts.body,        fontSize: 14, color: colors.ink },
  bodySemi:   { fontFamily: fonts.bodySemi,    fontSize: 14, color: colors.ink },
  caption:    { fontFamily: fonts.displayRegular, fontSize: 10, color: colors.muted, letterSpacing: 1 },
  mono:       { fontFamily: fonts.mono,        fontSize: 14, color: colors.ink, letterSpacing: 0.5 },
} as const;
