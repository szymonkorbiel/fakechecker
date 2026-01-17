#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function usage() {
  console.log("Usage: node scripts/set_deployed_endpoint.js <ENDPOINT_URL>");
  process.exit(1);
}

const endpoint = process.argv[2];
if (!endpoint) usage();

let url;
try {
  url = new URL(endpoint);
} catch (e) {
  console.error("Invalid URL:", endpoint);
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, "..");
const bgPath = path.join(projectRoot, "background.js");
const manifestPath = path.join(projectRoot, "manifest.json");

function backup(filePath) {
  const bak = filePath + ".bak";
  if (!fs.existsSync(bak)) fs.copyFileSync(filePath, bak);
}

// Update background.js
if (!fs.existsSync(bgPath)) {
  console.error("background.js not found at", bgPath);
  process.exit(1);
}
backup(bgPath);
let bg = fs.readFileSync(bgPath, "utf8");

const escaped = endpoint.replace(/\\/g, "\\\\").replace(/\"/g, '\\"');
const replacement = `const DEPLOYED_HF_ENDPOINT = "${escaped}";`;

if (/const\s+DEPLOYED_HF_ENDPOINT\s*=/.test(bg)) {
  bg = bg.replace(/const\s+DEPLOYED_HF_ENDPOINT\s*=\s*[^;]*;/, replacement);
} else {
  // fallback: insert after modelEndpoints block
  const insertAfter = "};\n\n/*";
  if (bg.includes(insertAfter)) {
    bg = bg.replace(insertAfter, `};\n\n${replacement}\n\n/*`);
  } else {
    // prepend
    bg = `${replacement}\n\n${bg}`;
  }
}
fs.writeFileSync(bgPath, bg, "utf8");
console.log("Updated background.js DEPLOYED_HF_ENDPOINT ->", endpoint);

// Update manifest.json host_permissions
if (!fs.existsSync(manifestPath)) {
  console.error("manifest.json not found at", manifestPath);
  process.exit(1);
}
backup(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.host_permissions = manifest.host_permissions || [];

const originPermission = `${url.origin}/*`;
if (!manifest.host_permissions.includes(originPermission)) {
  manifest.host_permissions.push(originPermission);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log("Added host permission to manifest.json:", originPermission);
} else {
  console.log(
    "Host permission already present in manifest.json:",
    originPermission
  );
}

console.log("Done. Remember to reload the extension in chrome://extensions.");
