/**
 * JSON pack baked into the file:// IIFE build (Chrome/Edge block fetch under file:).
 * Only pulled in when Vite mode === "file" (see boot-data.js).
 */
import catalogue from "../public/data/catalogue.json";
import config from "../public/data/config.json";
import prices from "../public/data/prices.json";
import series from "../public/data/series-aliases.json";
import trade from "../public/data/trade-aliases.json";
import abbrevs from "../public/data/part-name-abbreviations.json";

export function loadBundledBootData() {
  return {
    catalogue,
    config,
    prices,
    series,
    trade,
    abbrevs,
  };
}
