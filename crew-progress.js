import { HOUSE_CATS } from "./challenge.js";
const count = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 999999999) : 0;
const empty = () =>
  Object.fromEntries(
    HOUSE_CATS.map((cat) => [cat.name, { flights: 0, best: 0, treats: 0 }]),
  );

export function recordCrewFlight(progress, run) {
  const next = {
    version: 1,
    cats: Object.fromEntries(
      HOUSE_CATS.map((cat) => [cat.name, { ...progress.cats[cat.name] }]),
    ),
  };
  if (
    !Object.hasOwn(next.cats, run?.cat) ||
    !Number.isSafeInteger(run.score) ||
    run.score < 0 ||
    !["classic", "daily", "practice"].includes(run.mode)
  )
    return next;
  const cat = next.cats[run.cat];
  cat.flights = count(cat.flights + 1);
  cat.treats = count(cat.treats + run.score);
  cat.best = Math.max(cat.best, count(run.score));
  return next;
}
export function readCrewProgress(value, recentFlights = []) {
  let parsed;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {}
  if (parsed?.version === 1 && parsed.cats && typeof parsed.cats === "object") {
    return {
      version: 1,
      cats: Object.fromEntries(
        HOUSE_CATS.map((cat) => [
          cat.name,
          Object.fromEntries(
            ["flights", "best", "treats"].map((key) => [
              key,
              count(parsed.cats[cat.name]?.[key]),
            ]),
          ),
        ]),
      ),
    };
  }
  let progress = { version: 1, cats: empty() };
  // Preserve earned progress visible in the existing local flight log on upgrade.
  for (const run of Array.isArray(recentFlights) ? recentFlights : [])
    progress = recordCrewFlight(progress, run);
  return progress;
}
export function crewStamps(stats) {
  return [
    {
      label: "First flight",
      earned: stats.flights >= 1,
      value: Math.min(stats.flights, 1),
      target: 1,
    },
    {
      label: "5 in one flight",
      earned: stats.best >= 5,
      value: Math.min(stats.best, 5),
      target: 5,
    },
    {
      label: "25 treats total",
      earned: stats.treats >= 25,
      value: Math.min(stats.treats, 25),
      target: 25,
    },
  ];
}
export const stampCount = (progress) =>
  Object.values(progress.cats)
    .flatMap(crewStamps)
    .filter((stamp) => stamp.earned).length;
export const SKIES = [
  {
    id: "midnight",
    name: "Midnight",
    stamps: 0,
    top: "#121b2e",
    bottom: "#0b1020",
    star: "#cfe3ff",
    glow: "#8cadd6",
  },
  {
    id: "sunset",
    name: "Peach sunset",
    stamps: 3,
    top: "#423147",
    bottom: "#1d263d",
    star: "#ffe3c9",
    glow: "#e7a586",
  },
  {
    id: "aurora",
    name: "Catnip aurora",
    stamps: 6,
    top: "#193b42",
    bottom: "#151a35",
    star: "#c7ffe2",
    glow: "#8bd9bd",
  },
];
export function availableSky(id, progress) {
  return (
    SKIES.find((sky) => sky.id === id && stampCount(progress) >= sky.stamps) ||
    SKIES[0]
  );
}
export const isCleanPass = (position, center, gap) =>
  [position, center, gap].every(Number.isFinite) &&
  gap > 0 &&
  Math.abs(position - center) <= gap * 0.15;
export function flightAdvice(reason, score) {
  if (reason === "ground")
    return "Try shorter, steady taps before you get too low. A little rhythm goes a long way.";
  if (reason === "upper")
    return "A little less lift near the top yarn. Let your cat drift toward the center before the next flap.";
  if (reason === "lower")
    return "Aim for the middle of the gap and flap a moment earlier on the approach.";
  return score >= 5
    ? "You’re finding your rhythm. Try lining up the next gap before it reaches you."
    : "Short, steady taps help. Practice gives you wider gaps to find your rhythm.";
}
