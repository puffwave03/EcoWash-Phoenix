import Image from "next/image";

type BrandLogoSize = "header" | "footer" | "dashboard";

type BrandLogoProps = {
  alt: string;
  priority?: boolean;
  size?: BrandLogoSize;
};

const sizeClasses: Record<BrandLogoSize, string> = {
  header: "h-11 w-[6.625rem] sm:h-12 sm:w-[7.25rem]",
  footer: "h-11 w-[6.625rem]",
  dashboard: "h-7 w-[4.25rem]",
};

export function BrandLogo({
  alt,
  priority = false,
  size = "header",
}: BrandLogoProps) {
  return (
    <Image
      alt={alt}
      className={`${sizeClasses[size]} object-contain`}
      height={351}
      priority={priority}
      src="/brand/ecowash-logo.png"
      width={528}
    />
  );
}
