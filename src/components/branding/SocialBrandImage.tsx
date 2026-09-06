import { PhoenixProductMark } from "@/components/branding/PhoenixProductMark";

export function SocialBrandImage() {
  return (
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #f7faf8 0%, #f4efe4 100%)",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "72px 88px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "62px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", height: "360px", width: "315px" }}>
          <PhoenixProductMark height={360} width={315} />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#073a30",
              display: "flex",
              fontFamily: "Arial, sans-serif",
              fontSize: "116px",
              fontWeight: 800,
              letterSpacing: "-5px",
              lineHeight: 1,
            }}
          >
            Phoenix
          </div>
          <div
            style={{
              color: "#566872",
              display: "flex",
              fontFamily: "Arial, sans-serif",
              fontSize: "48px",
              fontWeight: 400,
              marginLeft: "8px",
              marginTop: "18px",
            }}
          >
            by EcoWash
          </div>
          <div
            style={{
              color: "#a67825",
              display: "flex",
              fontFamily: "Arial, sans-serif",
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "7px",
              marginLeft: "8px",
              marginTop: "38px",
              textTransform: "uppercase",
            }}
          >
            Laundry Operations Platform
          </div>
        </div>
      </div>
    </div>
  );
}
