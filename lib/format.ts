// Identical to the prototype's price formatter.
export const fmt = (n: number): string =>
  n >= 10000000
    ? "₹" + (n / 10000000).toFixed(n % 10000000 ? 2 : 1).replace(/\.0$/, "") + " Cr"
    : n >= 100000
    ? "₹" + (n / 100000).toFixed(n % 100000 ? 1 : 0) + " Lakh"
    : "₹" + n.toLocaleString("en-IN");

// Capitalizes only the first character — dealers shouldn't have to type a
// capital letter at submission time, so this is applied wherever a title is
// displayed instead of being enforced on input.
export const capFirst = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
