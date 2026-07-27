import Image from "next/image";

type PhotoSlotProps = {
  alt?: string;
  className?: string;
  fill?: boolean;
  height?: number;
  objectPosition?: string;
  priority?: boolean;
  sizes?: string;
  src: string;
  width?: number;
};

export function PhotoSlot({
  alt = "",
  className = "",
  fill = false,
  height,
  objectPosition,
  priority = false,
  sizes,
  src,
  width,
}: PhotoSlotProps) {
  return (
    <Image
      alt={alt}
      className={className}
      fill={fill}
      height={fill ? undefined : height}
      priority={priority}
      sizes={sizes}
      src={src}
      style={objectPosition ? { objectPosition } : undefined}
      width={fill ? undefined : width}
    />
  );
}
