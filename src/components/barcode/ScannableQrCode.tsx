import QRCode from "qrcode";

type Props = {
  ariaLabel: string;
  className?: string;
  payload: string;
};

const QUIET_ZONE = 4;

export function ScannableQrCode({ ariaLabel, className = "", payload }: Props) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  const viewBoxSize = size + QUIET_ZONE * 2;
  const squares: string[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (qr.modules.get(row, column)) {
        squares.push(`M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
      }
    }
  }

  return (
    <svg aria-label={ariaLabel} className={`scannable-qr ${className}`} role="img" shapeRendering="crispEdges" viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} xmlns="http://www.w3.org/2000/svg">
      <rect fill="#fff" height={viewBoxSize} width={viewBoxSize} />
      <path d={squares.join("")} fill="#000" />
    </svg>
  );
}
