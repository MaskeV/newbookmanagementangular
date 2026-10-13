// Gives every category / title its own soft colour, always the same one for the same text.
export function tagStyle(text?: string | null): Record<string, string> {
  let hash = 0;
  for (const ch of text ?? '') hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return { background: `hsl(${hash} 80% 94%)`, color: `hsl(${hash} 55% 28%)` };
}
