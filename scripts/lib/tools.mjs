import fs from 'fs';
import { PATHS, resolveFromRoot } from './paths.mjs';

const TOOLS_PATH = resolveFromRoot(PATHS.toolsJson);

/** @typedef {{ id: string; name: string; description: string; icon: string; route: string; category?: 'work' | 'life' }} ToolEntry */

export function loadTools() {
  const raw = fs.readFileSync(TOOLS_PATH, 'utf-8');
  const tools = JSON.parse(raw);
  if (!Array.isArray(tools)) {
    throw new Error(`${PATHS.toolsJson} 必須為陣列`);
  }
  return /** @type {ToolEntry[]} */ (tools);
}

export function saveTools(tools) {
  fs.writeFileSync(TOOLS_PATH, `${JSON.stringify(tools, null, 2)}\n`, 'utf-8');
}

export function kebabToPascal(kebab) {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function componentClassName(route) {
  return `${kebabToPascal(route)}Component`;
}
