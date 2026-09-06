import { ImageResponse } from "next/og";
import { PhoenixProductMark } from "@/components/branding/PhoenixProductMark";

export const size = { height: 180, width: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f7faf8",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <PhoenixProductMark height={148} width={129} />
      </div>
    ),
    size,
  );
}
