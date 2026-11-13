#!/usr/bin/env node
/**
 * RSP-115 / RSP-123: Demand Duo accessory families → part cards; Pin3 commercial
 * names; accessory Pin3 = sole SKU card; DDUPS trailing N = brass body (not NG).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  suggestSeriesPins,
  suggestItemNumberPins,
} from "../src/model-picker.js";
import {
  resolveModelPin,
  isAccessoryFamilySeries,
  accessorySkuPartsForSeries,
  listSeries,
} from "../src/series.js";
import { searchParts } from "../src/search.js";
import {
  getModelCommercialName,
  getModelFuelKind,
} from "../src/model-commercial-name.js";
import { buildPin3ChassisPartAllowSet } from "../src/pin3-chassis-allow.js";
import { seriesBelongsToSystemType } from "../src/system-type.js";

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

const ddSeries = listSeries(seriesDoc).filter((s) =>
  seriesBelongsToSystemType(s, "demand-duo")
);
assert(ddSeries.length === 3, `expected 3 DD families, got ${ddSeries.length}`);
for (const id of ["ddups", "ddtstat", "dduvc"]) {
  assert(
    ddSeries.some((s) => s.id === id && isAccessoryFamilySeries(s)),
    `missing accessory family ${id}`
  );
}
assert(
  !ddSeries.some((s) => s.id === "demand-duo"),
  "umbrella demand-duo series must be gone"
);

const pin2 = suggestSeriesPins(catalogue, seriesDoc, "", {
  systemTypeId: "system:demand-duo",
  limit: 60,
});
assert(pin2.length === 3, `Pin2 Demand Duo expected 3, got ${pin2.length}`);
assert(
  pin2.every((s) => /accessory family/i.test(s.subtitle || "")),
  "Pin2 subtitles should mark accessory family"
);
assert(
  pin2.some((s) => /Grundfos circulation pumps/i.test(s.label || "")),
  "DDUPS Pin2 label should include commercial name"
);

const ddupsPin = resolveModelPin(catalogue, seriesDoc, "series:ddups");
assert(ddupsPin.kind === "series", "ddups series pin");
const skuParts = accessorySkuPartsForSeries(catalogue, ddupsPin.series);
assert(skuParts.length >= 2, "DDUPS accessory SKU parts");
assert(
  skuParts.every((p) => /Grundfos|Circulation Pump/i.test(p.name)),
  "accessory part cards use commercial names"
);

const cards = searchParts(catalogue, "", null, {
  pin: ddupsPin,
  modelIds: ddupsPin.modelIds,
});
const codes = cards.map((r) => r.part.code);
assert(codes.includes("DDUPS2580N"), "DDUPS2580N card on Pin2 select");
assert(codes.includes("DDUPS32100N"), "DDUPS32100N card on Pin2 select");

const tstatPin = resolveModelPin(catalogue, seriesDoc, "series:ddtstat");
const tstatCards = searchParts(catalogue, "", null, {
  pin: tstatPin,
  modelIds: tstatPin.modelIds,
}).map((r) => r.part.code);
assert(tstatCards.includes("DD56TSTAT"), "DD56TSTAT card");
assert(tstatCards.includes("DD1TSTAT"), "DD1TSTAT card");

const uvcPin = resolveModelPin(catalogue, seriesDoc, "series:dduvc");
const uvcCards = searchParts(catalogue, "", null, {
  pin: uvcPin,
  modelIds: uvcPin.modelIds,
}).map((r) => r.part.code);
assert(uvcCards.includes("DDUVC1200"), "DDUVC1200 card");
assert(uvcCards.includes("DDUVC1700"), "DDUVC1700 card");

// Pin3 commercial names — CF unchanged quality + non-CF not bare series-only
const hd = suggestItemNumberPins(catalogue, seriesDoc, "hd200e", "", {
  limit: 4,
})[0];
assert(
  /Heavy Duty 200 External/i.test(hd.subtitle || ""),
  `CF Pin3 still commercial: ${hd.subtitle}`
);

const ehfa = suggestItemNumberPins(catalogue, seriesDoc, "ehfa160", "", {
  limit: 3,
})[0];
assert(
  /Hotflo EHFA160 Vitreous Enamel S\d+/i.test(ehfa.subtitle || ""),
  `Hotflo Pin3 commercial: ${ehfa.subtitle}`
);

const ecf = suggestItemNumberPins(catalogue, seriesDoc, "efinity-ecf", "", {
  limit: 3,
})[0];
assert(
  /Efinity ECF .* Degree/i.test(ecf.subtitle || ""),
  `Efinity Pin3 commercial: ${ecf.subtitle}`
);

const ddItem = suggestItemNumberPins(catalogue, seriesDoc, "ddups", "", {
  limit: 3,
})[0];
assert(
  /Demand Duo Grundfos Circulation Pump/i.test(ddItem.subtitle || ""),
  `DD Pin3 commercial: ${ddItem.subtitle}`
);

// Accessory model pin must not hard-fence to empty PL/ED set
const modelPin = resolveModelPin(catalogue, seriesDoc, "ddups2580n");
assert(modelPin.kind === "model", "ddups2580n model pin");
assert(
  isAccessoryFamilySeries(modelPin.series),
  "model resolves to accessory family"
);
assert(
  buildPin3ChassisPartAllowSet(modelPin, null) === null,
  "accessory Pin3 must skip chassis hard fence"
);

// Pin3 accessory Item Number → only that SKU card (not family dump / other parts)
const pin3Cards = searchParts(catalogue, "", null, {
  pin: modelPin,
  modelIds: modelPin.modelIds,
});
assert(
  pin3Cards.length === 1 && pin3Cards[0].part.code === "DDUPS2580N",
  `Pin3 DDUPS2580N must be sole card, got ${pin3Cards.map((r) => r.part.code).join(",")}`
);
const pin3PumpQ = searchParts(catalogue, "pump", null, {
  pin: modelPin,
  modelIds: modelPin.modelIds,
});
assert(
  pin3PumpQ.length === 1 && pin3PumpQ[0].part.code === "DDUPS2580N",
  "Pin3 accessory search must stay on the pinned SKU only"
);

const tstatModel = resolveModelPin(catalogue, seriesDoc, "dd56tstat");
const tstatOnly = searchParts(catalogue, "", null, {
  pin: tstatModel,
  modelIds: tstatModel.modelIds,
}).map((r) => r.part.code);
assert(
  tstatOnly.length === 1 && tstatOnly[0] === "DD56TSTAT",
  `Pin3 DD56TSTAT sole card, got ${tstatOnly.join(",")}`
);

// DDUPS trailing N = brass body, never Nat Gas fuel colouring
assert(
  /Brass Body/i.test(getModelCommercialName(modelPin.model, modelPin.series)),
  "DDUPS2580N commercial must say Brass Body"
);
assert(
  !/Nat Gas/i.test(getModelCommercialName(modelPin.model, modelPin.series)),
  "DDUPS2580N must not say Nat Gas"
);
assert(
  getModelFuelKind(modelPin.model, modelPin.series) === "",
  "DDUPS2580N fuelKind must be empty (not nat-gas)"
);

// Sanity: commercial helper on a few SKUs
assert(
  /Pump Controller DD56/i.test(
    getModelCommercialName(
      catalogue.models.find((m) => m.id === "dd56tstat"),
      tstatPin.series
    )
  ),
  "DD56TSTAT commercial"
);

console.log("ok smoke-rsp-115-dd-accessories", {
  pin2: pin2.map((s) => s.series?.id),
  ddupsCards: codes.filter((c) => /^DDUPS/i.test(c)),
  pin3Only: pin3Cards[0].part.code,
  hotfloSub: ehfa.subtitle,
  ddSub: ddItem.subtitle,
});
