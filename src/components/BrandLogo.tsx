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
  footer: "h-11 w-[6.625rem]",
  dashboard: "h-7 w-[4.25rem]",
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
      height={351}
      priority={priority}
      src="/brand/ecowash-logo.png"
      width={528}
    />
  );
}
