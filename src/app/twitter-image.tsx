import { ImageResponse } from "next/og";
import { SocialBrandImage } from "@/components/branding/SocialBrandImage";

export const alt = "Phoenix by EcoWash laundry operations platform";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(<SocialBrandImage />, size);
}
