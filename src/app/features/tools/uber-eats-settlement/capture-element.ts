/** 把 DOM 區塊轉成 PNG（html-to-image，按需載入）。 */

export async function elementToPng(
  element: HTMLElement,
  options?: { backgroundColor?: string },
): Promise<{ dataUrl: string; blob: Blob }> {
  const { toPng } = await import('html-to-image');
  const backgroundColor =
    options?.backgroundColor ??
    getComputedStyle(document.documentElement).getPropertyValue('--surface-color').trim() ||
    '#ffffff';

  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor,
    cacheBust: true,
    width: Math.max(element.scrollWidth, element.offsetWidth),
    height: Math.max(element.scrollHeight, element.offsetHeight),
    style: { overflow: 'visible' },
    filter: (node) =>
      !(node instanceof HTMLElement && node.classList.contains('no-capture')),
  });

  const blob = await (await fetch(dataUrl)).blob();
  return { dataUrl, blob };
}

export function downloadPng(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export async function copyPngToClipboard(blob: Blob): Promise<boolean> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    return false;
  }
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
  return true;
}

export function stampFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.png`;
}
