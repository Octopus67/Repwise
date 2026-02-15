export function incrementGlasses(n: number, max: number): number {
  return n < max ? n + 1 : n;
}

export function decrementGlasses(n: number): number {
  return n > 0 ? n - 1 : 0;
}
