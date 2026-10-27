export const brandConfig = {
  productName: "PPF HOUSE",
  businessName: "PPF HOUSE",
  shortName: "PPF HOUSE",
  /** Text-only identification until the official shield source is supplied. */
  mark: "PPF HOUSE",
  location: "", // Awaiting PPF HOUSE location confirmation.
  country: "Argentina",
  // Empty paths deliberately avoid displaying inherited or invented artwork.
  assets: {
    logo: "",
    logoMonochrome: "",
    logoInverse: "",
    mark: "",
    lockup: "",
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
    brandAccentToken: "--brand-blue",
    primaryToken: "--primary",
    surfaceToken: "--surface",
    themeColor: "#0F1115",
  },
} as const;

export type BrandConfig = typeof brandConfig;
