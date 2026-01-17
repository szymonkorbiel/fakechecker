const fs = require("fs");
const path = require("path");
const p = path.resolve(__dirname, "..", "background.js");
const vm = require("vm");
const s = fs.readFileSync(p, "utf8");
try {
  new vm.Script(s, { filename: "background.js" });
  console.log("OK: parsed with vm.Script");
} catch (e) {
  console.error("PARSE ERROR", e && e.stack ? e.stack : e.toString());
}
