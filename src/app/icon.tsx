import { ImageResponse } from "next/og";
import { PhoenixProductMark } from "@/components/branding/PhoenixProductMark";

export const size = { height: 512, width: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "transparent",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <PhoenixProductMark height={430} width={375} />
      </div>
    ),
    size,
  );
}
