import Image from "next/image";

type BrandLogoSize = "header" | "footer" | "dashboard";

type BrandLogoProps = {
  alt: string;
  className?: string;
  priority?: boolean;
  size?: BrandLogoSize;
};

const sizeClasses: Record<BrandLogoSize, string> = {
  header: "h-14 w-auto sm:h-16",
  footer: "h-12 w-auto",
  dashboard: "h-8 w-auto",
};

export function BrandLogo({
  alt,
  className = "",
  priority = false,
  size = "header",
}: BrandLogoProps) {
  return (
    <Image
      alt={alt}
      className={`${sizeClasses[size]} object-contain ${className}`}
      height={670}
      priority={priority}
      src="/brand/Phoenix_by_EcoWash_APPROVED.png"
      width={1709}
    />
  );
}
