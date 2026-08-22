/** 把 DOM 區塊轉成 PNG blob（html-to-image，按需載入）。 */

function backgroundColor(): string {
  const fromTheme = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface-color')
    .trim();
  return fromTheme || '#ffffff';
}

function visualBox(element: HTMLElement): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(Math.round(rect.width), element.clientWidth, element.offsetWidth, 1),
    height: Math.max(Math.round(rect.height), element.clientHeight, element.offsetHeight, 1),
  };
}

function captureBox(element: HTMLElement): { width: number; height: number } {
  if (element.classList.contains('look-canvas')) return visualBox(element);
  return {
    width: Math.max(element.scrollWidth, element.offsetWidth, 1),
    height: Math.max(element.scrollHeight, element.offsetHeight, 1),
  };
}

function pixelRatioFor(box: { width: number; height: number }): number {
  const maxPixels = 12_000_000;
  const ideal = Math.min(2, window.devicePixelRatio || 2);
  if (box.width * box.height * ideal * ideal <= maxPixels) return ideal;
  return Math.max(1, Math.sqrt(maxPixels / (box.width * box.height)));
}

function shouldCaptureNode(node: Node): boolean {
  if (!(node instanceof Element)) return true;
  if (node.classList.contains('no-capture')) return false;
  const tag = node.tagName;
  return tag !== 'SCRIPT' && tag !== 'IFRAME' && tag !== 'MAT-TOOLTIP-COMPONENT';
}

function captureOptions(element: HTMLElement, box: { width: number; height: number }) {
  const look = element.classList.contains('look-canvas');
  return {
    pixelRatio: pixelRatioFor(box),
    backgroundColor: backgroundColor(),
    width: box.width,
    height: box.height,
    cacheBust: false,
    skipFonts: true,
    fontEmbedCSS: '',
    skipAutoScale: true,
    style: {
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      overflow: look ? 'hidden' : 'visible',
      ...(look
        ? {
            width: `${box.width}px`,
            height: `${box.height}px`,
            maxWidth: `${box.width}px`,
            maxHeight: `${box.height}px`,
            margin: '0',
          }
        : {}),
    },
    filter: (domNode: HTMLElement) => shouldCaptureNode(domNode),
  };
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function relativeBox(node: HTMLElement, root: HTMLElement): { x: number; y: number; w: number; h: number } {
  const a = node.getBoundingClientRect();
  const b = root.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
}

/** canvas drawImage 會拉滿 element box；object-fit: contain 且比例不同時才畫內容區。 */
function containBox(
  box: { x: number; y: number; w: number; h: number },
  naturalW: number,
  naturalH: number,
): { x: number; y: number; w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0 || box.w <= 0 || box.h <= 0) return box;
  const imgAspect = naturalW / naturalH;
  const boxAspect = box.w / box.h;
  if (Math.abs(imgAspect - boxAspect) < 0.01) return box;
  if (imgAspect > boxAspect) {
    const h = box.w / imgAspect;
    return { x: box.x, y: box.y + (box.h - h) / 2, w: box.w, h };
  }
  const w = box.h * imgAspect;
  return { x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h };
}

function resolveCaptureRoot(element: HTMLElement): HTMLElement {
  if (element.classList.contains('look-canvas')) return element;
  const look = element.querySelector('.look-canvas');
  return look instanceof HTMLElement ? look : element;
}

function imageDest(
  img: HTMLImageElement,
  root: HTMLElement,
): { x: number; y: number; w: number; h: number } {
  const box = relativeBox(img, root);
  if (img.classList.contains('look-photo')) return box;
  if (getComputedStyle(img).objectFit !== 'contain') return box;
  return containBox(box, img.naturalWidth, img.naturalHeight);
}

function drawLiveImages(
  ctx: CanvasRenderingContext2D,
  root: HTMLElement,
  imgs: HTMLImageElement[],
  scaleX: number,
  scaleY: number,
): void {
  for (const img of imgs) {
    if (!img.naturalWidth || !img.naturalHeight) continue;
    const dest = imageDest(img, root);
    if (dest.w <= 0 || dest.h <= 0) continue;
    ctx.drawImage(img, dest.x * scaleX, dest.y * scaleY, dest.w * scaleX, dest.h * scaleY);
  }
}

type StyleUndo = () => void;

function restoreAttr(el: Element, name: string, prev: string | null): void {
  if (prev == null) el.removeAttribute(name);
  else el.setAttribute(name, prev);
}

/** 凍結 look-canvas 為畫面像素盒，避免 clone 帶入置中 margin / 原圖尺寸。 */
function pinLookLayout(root: HTMLElement): StyleUndo {
  if (!root.classList.contains('look-canvas')) return () => {};
  const box = visualBox(root);
  const photo = root.querySelector('img.look-photo');
  const prevRoot = root.getAttribute('style');
  const prevPhoto = photo instanceof HTMLImageElement ? photo.getAttribute('style') : null;
  const photoBox = photo instanceof HTMLImageElement ? photo.getBoundingClientRect() : null;
  root.style.width = `${box.width}px`;
  root.style.height = `${box.height}px`;
  root.style.maxWidth = 'none';
  root.style.maxHeight = 'none';
  root.style.margin = '0';
  if (photo instanceof HTMLImageElement && photoBox) {
    photo.style.width = `${Math.max(photoBox.width, 1)}px`;
    photo.style.height = `${Math.max(photoBox.height, 1)}px`;
    photo.style.maxWidth = 'none';
    photo.style.maxHeight = 'none';
    photo.style.objectFit = 'fill';
  }
  return () => {
    restoreAttr(root, 'style', prevRoot);
    if (photo instanceof HTMLImageElement) restoreAttr(photo, 'style', prevPhoto);
  };
}

async function toPngBlobOnce(element: HTMLElement): Promise<Blob> {
  const { toCanvas } = await import('html-to-image');
  const box = captureBox(element);
  const opts = captureOptions(element, box);
  const imgs = [...element.querySelectorAll('img')];
  const lookCanvas = element.classList.contains('look-canvas')
    ? element
    : (element.querySelector('.look-canvas') as HTMLElement | null);
  const prevVis = imgs.map((img) => img.style.visibility);
  const prevBg = lookCanvas?.style.background ?? '';
  let overlay: HTMLCanvasElement;
  try {
    for (const img of imgs) img.style.visibility = 'hidden';
    if (lookCanvas) lookCanvas.style.background = 'transparent';
    overlay = await toCanvas(element, { ...opts, backgroundColor: undefined });
  } finally {
    imgs.forEach((img, index) => {
      img.style.visibility = prevVis[index];
    });
    if (lookCanvas) lookCanvas.style.background = prevBg;
  }

  const canvas = document.createElement('canvas');
  canvas.width = overlay.width;
  canvas.height = overlay.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('empty png');
  ctx.fillStyle = opts.backgroundColor || backgroundColor();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rootRect = element.getBoundingClientRect();
  const scaleX = overlay.width / Math.max(rootRect.width, 1);
  const scaleY = overlay.height / Math.max(rootRect.height, 1);
  drawLiveImages(ctx, element, imgs, scaleX, scaleY);
  ctx.drawImage(overlay, 0, 0);
  overlay.width = 0;
  overlay.height = 0;

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
  const target = resolveCaptureRoot(element);
  let unpin: StyleUndo = () => {};
  try {
    (document.activeElement as HTMLElement | null)?.blur?.();
    target.classList.add('is-capturing');
    await Promise.all(
      [...target.querySelectorAll('img')].map((img) =>
        img.decode().catch(() => undefined),
      ),
    );
    unpin = pinLookLayout(target);
    await nextPaint();
    return await toPngBlobOnce(target);
  } finally {
    unpin();
    target.classList.remove('is-capturing');
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
