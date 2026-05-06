import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BLOG_DIR = join(process.cwd(), 'src/assets/blog');
const OUTPUT_FILE = join(BLOG_DIR, 'index.json');

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  match[1].split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      let value = rest.join(':').trim();
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
      }
      frontmatter[key.trim()] = value;
    }
  });

  return frontmatter;
}

function generateIndex() {
  const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const content = readFileSync(join(BLOG_DIR, file), 'utf-8');
    const frontmatter = parseFrontmatter(content);
    const slug = file.replace('.md', '');

    if (frontmatter) {
      posts.push({
        slug,
        title: frontmatter.title || slug,
        date: frontmatter.date || new Date().toISOString().split('T')[0],
        tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
        summary: frontmatter.summary || '',
      });
    } else {
      const titleMatch = content.match(/^#\s+(.+)/m);
      posts.push({
        slug,
        title: titleMatch ? titleMatch[1] : slug,
        date: new Date().toISOString().split('T')[0],
        tags: [],
        summary: '',
      });
    }
  }

  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2));
  console.log(`Generated blog index with ${posts.length} posts.`);
}

generateIndex();
