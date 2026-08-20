/** 把 DOM 區塊轉成 PNG blob（html-to-image，按需載入）。 */

function backgroundColor(): string {
  const fromTheme = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface-color')
    .trim();
  return fromTheme || '#ffffff';
}

function pixelRatioFor(element: HTMLElement): number {
  const width = Math.max(element.scrollWidth, element.offsetWidth, 1);
  const height = Math.max(element.scrollHeight, element.offsetHeight, 1);
  const maxPixels = 12_000_000;
  const ideal = Math.min(2, window.devicePixelRatio || 2);
  if (width * height * ideal * ideal <= maxPixels) return ideal;
  return Math.max(1, Math.sqrt(maxPixels / (width * height)));
}

function shouldCaptureNode(node: Node): boolean {
  if (!(node instanceof Element)) return true;
  if (node.classList.contains('no-capture')) return false;
  const tag = node.tagName;
  return tag !== 'SCRIPT' && tag !== 'IFRAME' && tag !== 'MAT-TOOLTIP-COMPONENT';
}

function captureOptions(element: HTMLElement) {
  const width = Math.max(element.scrollWidth, element.offsetWidth, 1);
  const height = Math.max(element.scrollHeight, element.offsetHeight, 1);
  return {
    pixelRatio: pixelRatioFor(element),
    backgroundColor: backgroundColor(),
    width,
    height,
    cacheBust: false,
    skipFonts: true,
    fontEmbedCSS: '',
    skipAutoScale: true,
    style: {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      overflow: 'visible',
    },
    filter: (domNode: HTMLElement) => shouldCaptureNode(domNode),
  };
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function toPngBlobOnce(element: HTMLElement): Promise<Blob> {
  const { toCanvas } = await import('html-to-image');
  const canvas = await toCanvas(element, captureOptions(element));
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('empty png'))),
        'image/png',
      );
    });
    if (blob.size < 32) {
      throw new Error('empty png');
    }
    return blob;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

let captureLock: Promise<void> = Promise.resolve();

export async function elementToPngBlob(element: HTMLElement): Promise<Blob> {
  let release!: () => void;
  const previous = captureLock;
  captureLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    (document.activeElement as HTMLElement | null)?.blur?.();
    element.classList.add('is-capturing');
    await nextPaint();
    try {
      return await toPngBlobOnce(element);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return await toPngBlobOnce(element);
    }
  } finally {
    element.classList.remove('is-capturing');
    release();
  }
}

/** 在 click handler 裡同步呼叫，才能保留使用者手勢給剪貼簿。 */
export function copyElementPngToClipboard(element: HTMLElement): Promise<boolean> {
  const blobPromise = elementToPngBlob(element);
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return blobPromise.then(() => false);
  }

  return navigator.clipboard
    .write([new ClipboardItem({ 'image/png': blobPromise })])
    .then(() => true)
    .catch(async () => {
      try {
        const blob = await blobPromise;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return true;
      } catch {
        return false;
      }
    });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function stampFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.png`;
}
