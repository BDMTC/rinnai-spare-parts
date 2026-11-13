#!/usr/bin/env node
/**
 * Empty Pin2 must list every series for each scoped Pin1 class.
 * CF keeps its curated shortlist; new RSP-112 classes must not look empty.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suggestSeriesPins } from "../src/model-picker.js";
import {
  SYSTEM_TYPES,
  seriesBelongsToSystemType,
} from "../src/system-type.js";
import { listSeries } from "../src/series.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogue = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/catalogue.json"), "utf8")
);
const seriesDoc = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/series-aliases.json"), "utf8")
);

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const NEW_CLASSES = [
  "hotflo-electric-storage",
  "gas-storage-hot-water",
  "heat-pump-hot-water",
  "commercial-heat-pump",
  "demand-duo",
  "electric-continuous-flow",
  "solar-hot-water",
];

for (const id of NEW_CLASSES) {
  const type = SYSTEM_TYPES.find((t) => t.id === id);
  assert(type, `SYSTEM_TYPES missing ${id}`);
  const belonging = listSeries(seriesDoc)
    .filter((s) => seriesBelongsToSystemType(s, id))
    .map((s) => s.id)
    .sort();
  assert(belonging.length > 0, `${id}: series-aliases must tag ≥1 series`);
  const empty = suggestSeriesPins(catalogue, seriesDoc, "", {
    systemTypeId: type.value,
    limit: 50,
  })
    .map((s) => s.series?.id)
    .filter(Boolean)
    .sort();
  assert(
    empty.length === belonging.length &&
      belonging.every((sid) => empty.includes(sid)),
    `${id}: empty Pin2 expected [${belonging}] got [${empty}]`
  );
}

const cfEmpty = suggestSeriesPins(catalogue, seriesDoc, "", {
  systemTypeId: "system:continuous-flow-hot-water",
  limit: 50,
}).map((s) => s.series?.id);
assert(cfEmpty.includes("hd28e"), "CF empty Pin2 still lists hd28e");
assert(cfEmpty.includes("hd200e"), "CF empty Pin2 still lists hd200e");
assert(
  !cfEmpty.includes("demand-duo") &&
    !cfEmpty.includes("ddups") &&
    !cfEmpty.includes("ddtstat") &&
    !cfEmpty.includes("dduvc"),
  "CF empty Pin2 must not list Demand Duo accessory families"
);

const ddEmpty = suggestSeriesPins(catalogue, seriesDoc, "", {
  systemTypeId: "system:demand-duo",
  limit: 50,
}).map((s) => s.series?.id);
assert(ddEmpty.includes("ddups"), "Demand Duo Pin2 lists DDUPS");
assert(ddEmpty.includes("ddtstat"), "Demand Duo Pin2 lists DDTSTAT");
assert(ddEmpty.includes("dduvc"), "Demand Duo Pin2 lists UVC/DDUVC");

console.log("ok smoke-pin2-system-series", {
  newClasses: NEW_CLASSES.length,
  cfEmptyCount: cfEmpty.length,
  ddEmpty,
});
