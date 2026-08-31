"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

type PortalMediaProps = {
  alt?: string;
  children?: ReactNode;
  className?: string;
  fit?: "contain" | "cover";
  imageClassName?: string;
  objectPosition?: string;
  overlayClassName?: string;
  priority?: boolean;
  sizes: string;
  src?: string | null;
};

export function PortalMedia({
  alt = "",
  children,
  className = "",
  fit = "cover",
  imageClassName = "",
  objectPosition = "center",
  overlayClassName,
  priority = false,
  sizes,
  src,
}: PortalMediaProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  return (
    <div
      className={`relative isolate overflow-hidden bg-[radial-gradient(circle_at_top_right,#dcebe4,transparent_58%),linear-gradient(145deg,var(--color-primary-soft),#fbfcfb)] ${className}`}
      data-portal-media-slot
    >
      {src && failedSrc !== src ? (
        <Image
          alt={alt}
          className={`${fit === "contain" ? "object-contain" : "object-cover"} ${imageClassName}`}
          fill
          onError={() => setFailedSrc(src)}
          priority={priority}
          sizes={sizes}
          src={src}
          style={{ objectPosition }}
          unoptimized={/^https?:\/\//.test(src)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-primary/70">
          <svg aria-hidden="true" className="h-12 w-12" fill="none" viewBox="0 0 24 24">
            <path d="M7 5h10l2 5-2 9H7l-2-9 2-5Zm-2 5h14M9 5V3m6 2V3m-6 11c2 1 4 1 6 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          </svg>
        </div>
      )}
      {overlayClassName ? <span aria-hidden="true" className={`absolute inset-0 ${overlayClassName}`} /> : null}
      {children}
    </div>
  );
}
