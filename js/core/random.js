/** Serializable xorshift PRNG: the same seed and choices produce the same world. */
export function random(s) {
  let x = s.rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
export function normal(s) {
  return (
    Math.sqrt(-2 * Math.log(Math.max(1e-10, random(s)))) *
    Math.cos(2 * Math.PI * random(s))
  );
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const uid = (s) => s.nextId++;
export function hashSeed(text) {
  let h = 2166136261;
  for (const c of text) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1987;
}
