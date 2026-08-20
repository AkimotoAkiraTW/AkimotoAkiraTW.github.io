import { marked } from 'marked';

export interface MarkdownPreview {
  html: string;
  mermaid: Map<string, string>;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 把 Markdown 轉成預覽 HTML；Mermaid 原始碼不進 innerHTML，只留 slot id。 */
export function buildMarkdownPreview(source: string): MarkdownPreview {
  const mermaid = new Map<string, string>();
  let index = 0;

  const renderer = new marked.Renderer();
  renderer.html = () => '';
  renderer.code = ({ text, lang, escaped }) => {
    if (lang === 'mermaid') {
      const id = `m${++index}`;
      mermaid.set(id, text);
      return `<div class="md-mermaid-slot" data-mid="${id}"></div>`;
    }

    const body = escaped ? text : escapeHtml(text);
    const language = lang ? escapeHtml(lang) : '';
    const classAttr = language ? ` class="language-${language}"` : '';
    return `<pre><code${classAttr}>${body}</code></pre>`;
  };

  const html = marked.parse(source, { renderer, async: false }) as string;
  return { html, mermaid };
}
