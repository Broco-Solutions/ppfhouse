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
  outline: brandConfig.assets.logoMonochrome,
};

export function BrandLogo({
  className,
  decorative = false,
  priority = false,
  variant = "tricolor",
  width = 144,
}: BrandLogoProps) {
  if (!logoSources[variant]) {
    return (
      <span
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : brandConfig.businessName}
        className={cx(
          styles.wordmark,
          variant === "inverse" ? styles.inverse : styles.dark,
          className,
        )}
        role={decorative ? undefined : "img"}
        style={{ maxWidth: "100%", width }}
      >
        {brandConfig.businessName}
      </span>
    );
  }

  return (
    <Image
      alt={decorative ? "" : brandConfig.shortName}
      aria-hidden={decorative || undefined}
      className={cx(
        styles.asset,
        styles.logo,
        variant === "inverse" && styles.lightAsset,
        className,
      )}
      height={Math.round((width * 136) / 996)}
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
  monochrome: brandConfig.assets.mark,
  outline: brandConfig.assets.mark,
} as const;

export function BrandMark({
  className,
  decorative = true,
  priority = false,
  size = 40,
  variant = "tricolor",
}: BrandMarkProps) {
  if (!markSources[variant]) {
    return (
      <span
        aria-hidden={decorative || undefined}
        aria-label={decorative ? undefined : brandConfig.businessName}
        className={cx(styles.textMark, className)}
        role={decorative ? undefined : "img"}
        style={{ fontSize: size * 0.2, width: size, height: size }}
      >
        PPF
        <br />
        HOUSE
      </span>
    );
  }

  return (
    <Image
      alt={decorative ? "" : brandConfig.shortName}
      aria-hidden={decorative || undefined}
      className={cx(styles.asset, styles.mark, className)}
      height={Math.round((size * 153) / 162)}
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
  if (!brandConfig.assets.lockup) {
    return (
      <BrandLogo
        className={className}
        decorative={decorative}
        priority={priority}
        variant={variant}
        width={width}
      />
    );
  }

  return (
    <Image
      alt={decorative ? "" : brandConfig.businessName}
      aria-hidden={decorative || undefined}
      className={cx(styles.asset, styles.lockup, className)}
      height={Math.round((width * 136) / 996)}
      priority={priority}
      src={
        variant === "tricolor"
          ? brandConfig.assets.lockup
          : brandConfig.assets.logoMonochrome
      }
      width={width}
    />
  );
}
