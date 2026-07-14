import QRCode from 'qrcode'

/**
 * Build a shareable URL that opens this app with the room code pre-filled,
 * so a scanned QR code lands the recipient directly into the join screen
 * with the room code ready.
 */
export function buildShareUrl(room: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('room', room)
  return url.toString()
}

/** Render a QR code (encoding the given text) to a canvas element. */
export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  size = 256,
): Promise<void> {
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#09090b', light: '#ffffff' },
  })
}

/** Generate a QR code as a PNG data URL (useful for downloads). */
export async function renderQrDataUrl(text: string, size = 256): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#09090b', light: '#ffffff' },
  })
}
