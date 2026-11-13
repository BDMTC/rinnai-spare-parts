/**
 * Pin1 series id → promo unit shot URL (Vite-bundled, file:// safe relative).
 * Inventory: docs/series-unit-shots.md (Project store).
 */
import hd28e from "./assets/series-unit-shots/hd28e__HD28e.png";
import hd28i from "./assets/series-unit-shots/hd28i__HD28i.png";
import infinity28 from "./assets/series-unit-shots/infinity28__Infinity-28.png";
import solar28 from "./assets/series-unit-shots/solar28__Solar-28.png";
import hd200e from "./assets/series-unit-shots/hd200e__HD200e.jpg";
import hd200i from "./assets/series-unit-shots/hd200i__HD200i.jpg";
import infinity26 from "./assets/series-unit-shots/infinity26__Infinity-26.png";
import infinity26Internal from "./assets/series-unit-shots/infinity26-internal__Infinity-26-internal.jpg";
import infinity26Plus from "./assets/series-unit-shots/infinity26-plus__Infinity-26-Plus.jpg";
import infinity26Smartstart from "./assets/series-unit-shots/infinity26-smartstart__Infinity-26-Smartstart.jpg";
import infinity32Enviro from "./assets/series-unit-shots/infinity32-enviro__Infinity-32-Enviro.png";
import hd210e from "./assets/series-unit-shots/hd210e__HD210e.png";
import hd210i from "./assets/series-unit-shots/hd210i__HD210i.png";
import infinity32EnviroPlusN from "./assets/series-unit-shots/infinity32-enviro-plus-n__Infinity-32-Enviro-Plus.png";
import hd32 from "./assets/series-unit-shots/hd32__HD32e.png";
import hdc32e from "./assets/series-unit-shots/hdc32e__HDC32e.png";
import hdc32i from "./assets/series-unit-shots/hdc32i__HDC32i.png";
import hdc211e from "./assets/series-unit-shots/hdc211e__HDC211e.png";
import hdc211i from "./assets/series-unit-shots/hdc211i__HDC211i.png";
import hd250e from "./assets/series-unit-shots/hd250e__HD250e.jpg";

/** @type {Record<string, string>} */
export const SERIES_UNIT_SHOTS = {
  hd28e,
  hd28i,
  infinity28,
  solar28,
  hd200e,
  hd200i,
  infinity26,
  "infinity26-internal": infinity26Internal,
  "infinity26-plus": infinity26Plus,
  "infinity26-smartstart": infinity26Smartstart,
  "infinity32-enviro": infinity32Enviro,
  hd210e,
  hd210i,
  "infinity32-enviro-plus-n": infinity32EnviroPlusN,
  hd32,
  hdc32e,
  hdc32i,
  hdc211e,
  hdc211i,
  hd250e,
};

/**
 * @param {string|null|undefined} seriesId
 * @returns {string|null}
 */
export function seriesUnitShotUrl(seriesId) {
  if (!seriesId) return null;
  const key = String(seriesId).trim().toLowerCase();
  return SERIES_UNIT_SHOTS[key] || null;
}
