export const brandConfig = {
  productName: "PPF HOUSE",
  businessName: "PPF HOUSE",
  shortName: "PPF HOUSE",
  /** Institutional name; artwork is supplied separately by the user. */
  mark: "PPF HOUSE",
  location: "Rosario, Santa Fe",
  country: "Argentina",
  // User-supplied artwork, confirmed for use in the application.
  assets: {
    logo: "/brand/logoPPF_nombre.png",
    logoMonochrome: "/brand/logoPPF_nombre.png",
    logoInverse: "/brand/logoPPF_nombre.png",
    mark: "/brand/logoPPF_transparente.png",
    lockup: "/brand/logoPPF_nombre.png",
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
    brandAccentToken: "--brand-petroleum",
    primaryToken: "--primary",
    surfaceToken: "--surface",
    themeColor: "#151A1E",
  },
} as const;

export type BrandConfig = typeof brandConfig;
