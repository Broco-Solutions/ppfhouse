import Image from "next/image";

import { brandConfig } from "@/config/brand";
import { cx } from "@/design-system/cx";

import styles from "./brand.module.css";

type BrandVariant = "tricolor" | "monochrome" | "inverse" | "outline";

interface BrandAssetProps {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
}

interface BrandLogoProps extends BrandAssetProps {
  variant?: BrandVariant;
  width?: number;
}

const logoSources: Record<BrandVariant, string> = {
  tricolor: brandConfig.assets.logo,
  monochrome: brandConfig.assets.logoMonochrome,
  inverse: brandConfig.assets.logoInverse,
  outline: "/brand/ferraro-logo-outline.svg",
};

export function BrandLogo({
  className,
  decorative = false,
  priority = false,
  variant = "tricolor",
  width = 144,
}: BrandLogoProps) {
  return (
    <Image
      alt={decorative ? "" : brandConfig.shortName}
      aria-hidden={decorative || undefined}
      className={cx(styles.asset, styles.logo, className)}
      height={Math.round(width * 0.36)}
      priority={priority}
      src={logoSources[variant]}
      width={width}
    />
  );
}

interface BrandMarkProps extends BrandAssetProps {
  variant?: Exclude<BrandVariant, "inverse">;
  size?: number;
}

const markSources = {
  tricolor: brandConfig.assets.mark,
  monochrome: "/brand/ferraro-mark-outline.svg",
  outline: "/brand/ferraro-mark-outline.svg",
} as const;

export function BrandMark({
  className,
  decorative = true,
  priority = false,
  size = 40,
  variant = "tricolor",
}: BrandMarkProps) {
  return (
    <Image
      alt={decorative ? "" : brandConfig.shortName}
      aria-hidden={decorative || undefined}
      className={cx(styles.asset, styles.mark, className)}
      height={size}
      priority={priority}
      src={markSources[variant]}
      width={size}
    />
  );
}

interface BrandLockupProps extends BrandAssetProps {
  variant?: "tricolor" | "monochrome";
  width?: number;
}

export function BrandLockup({
  className,
  decorative = false,
  priority = false,
  variant = "tricolor",
  width = 192,
}: BrandLockupProps) {
  return (
    <Image
      alt={decorative ? "" : brandConfig.businessName}
      aria-hidden={decorative || undefined}
      className={cx(styles.asset, styles.lockup, className)}
      height={Math.round(width * 0.43)}
      priority={priority}
      src={
        variant === "tricolor"
          ? brandConfig.assets.lockup
          : "/brand/ferraro-lockup-detail-black.svg"
      }
      width={width}
    />
  );
}
