// Kept under the socket payload limit (1 MB) by lowering quality/size until it fits.
const MAX_CHARS = 700_000;

export function captureBoardSnapshot(): string | null {
  const source = document.querySelector<HTMLCanvasElement>('canvas.lower-canvas');
  if (!source || source.width === 0 || source.height === 0) return null;

  for (const { scale, quality } of [
    { scale: 1, quality: 0.75 },
    { scale: 0.75, quality: 0.6 },
    { scale: 0.5, quality: 0.5 },
  ]) {
    const out = document.createElement('canvas');
    out.width = Math.round(source.width * scale);
    out.height = Math.round(source.height * scale);
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#f8fafc'; // JPEG has no alpha: match the board background
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0, out.width, out.height);
    const url = out.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_CHARS) return url;
  }
  return null;
}
