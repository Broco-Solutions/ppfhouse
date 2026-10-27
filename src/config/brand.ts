export const brandConfig = {
  productName: "Ferraro Manager",
  businessName: "Ferraro Detail",
  shortName: "Ferraro",
  /** Temporary text fallback for legacy surfaces; migrate to assets.mark. */
  mark: "F",
  location: "Rosario, Santa Fe",
  country: "Argentina",
  assets: {
    logo: "/brand/ferraro-logo-tricolor.svg",
    logoMonochrome: "/brand/ferraro-logo-black.svg",
    logoInverse: "/brand/ferraro-logo-white.svg",
    mark: "/brand/ferraro-mark-tricolor.svg",
    lockup: "/brand/ferraro-lockup-detail-tricolor.svg",
    manifest: "/brand/manifest.json",
  },
  contact: {
    phone: "",
    email: "",
    instagram: "",
  },
  pdf: {
    templateVersion: 1,
    defaultTerms:
      "Los valores se expresan en USD. La fecha de ejecución queda sujeta a disponibilidad de agenda.",
  },
  theme: {
    brandAccentToken: "--brand-yellow",
    primaryToken: "--primary",
    surfaceToken: "--surface",
    themeColor: "#171817",
  },
} as const;

export type BrandConfig = typeof brandConfig;
