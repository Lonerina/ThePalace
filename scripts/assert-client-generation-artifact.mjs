import fs from "node:fs";
import path from "node:path";

const generation = process.argv[2];
if (generation !== "LEGACY_V3" && generation !== "REGISTRY_V4") {
  throw new Error("usage: node scripts/assert-client-generation-artifact.mjs LEGACY_V3|REGISTRY_V4");
}

const assetsDir = path.resolve("dist/assets");
const jsFiles = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).filter((name) => name.endsWith(".js"))
  : [];
if (jsFiles.length === 0) throw new Error("No frontend JavaScript artifact found in dist/assets.");

const bundle = jsFiles.map((name) => fs.readFileSync(path.join(assetsDir, name), "utf8")).join("\n");
const hasLegacy = bundle.includes("/api/game/chat");
const hasV4Authority = bundle.includes("/api/v4/authority");
const hasV4Chat = bundle.includes("/api/v4/game/chat");

if (generation === "LEGACY_V3") {
  if (!hasLegacy) throw new Error("LEGACY_V3 artifact does not contain its legacy chat endpoint.");
  if (hasV4Authority || hasV4Chat) throw new Error("LEGACY_V3 artifact exposes a v4 client authority path.");
} else {
  if (!hasV4Authority || !hasV4Chat) throw new Error("REGISTRY_V4 artifact is missing required v4 endpoints.");
  if (hasLegacy) throw new Error("REGISTRY_V4 artifact exposes the legacy client chat path.");
}

console.log(`${generation} frontend artifact authority-path isolation: OK`);
