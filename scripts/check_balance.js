const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "background.js");
const s = fs.readFileSync(p, "utf8");
let pc = 0,
  bc = 0,
  brc = 0;
let line = 1,
  col = 0;
for (let i = 0; i < s.length; i++) {
  const c = s[i];
  if (c === "\n") {
    line++;
    col = 0;
  } else col++;
  if (c === "(") pc++;
  if (c === ")") pc--;
  if (c === "{") bc++;
  if (c === "}") bc--;
  if (c === "[") brc++;
  if (c === "]") brc--;
  if (pc < 0 || bc < 0 || brc < 0) {
    const start = Math.max(0, i - 60);
    const ctx = s.slice(start, i + 60).replace(/\n/g, "\\n");
    console.log(
      "FIRST_NEG at index",
      i,
      "line",
      line,
      "col",
      col,
      "context:\n",
      ctx
    );
    break;
  }
}
console.log("FINAL_COUNTS parens", pc, "braces", bc, "brackets", brc);
