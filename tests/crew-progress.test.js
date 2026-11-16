import test from "node:test";
import assert from "node:assert/strict";
import {
  readCrewProgress,
  recordCrewFlight,
  crewStamps,
  stampCount,
  availableSky,
  isCleanPass,
  flightAdvice,
} from "../crew-progress.js";
test("crew upgrade preserves visible flight history, isolates cats, and rejects corrupt values", () => {
  const initial = readCrewProgress(null, [
    { cat: "Hubert", score: 7, mode: "classic" },
    { cat: "Mia", score: 3, mode: "practice" },
    { cat: "Mystery cat", score: 100, mode: "classic" },
  ]);
  assert.deepEqual(initial.cats.Hubert, { flights: 1, best: 7, treats: 7 });
  assert.equal(initial.cats.Mia.treats, 3);
  assert.equal(initial.cats.Mack.flights, 0);
  assert.equal(stampCount(initial), 3);
  const reloaded = readCrewProgress(JSON.stringify(initial), [
    { cat: "Hubert", score: 100, mode: "classic" },
  ]);
  assert.deepEqual(reloaded, initial);
  const broken = readCrewProgress("{broken");
  assert.equal(stampCount(broken), 0);
  const invalid = readCrewProgress({
    version: 1,
    cats: { Mia: { flights: -4, best: "Infinity", treats: null } },
  });
  assert.equal(stampCount(invalid), 0);
});
test("stamps and skies unlock only when earned, including Practice, without altering input progress", () => {
  let progress = readCrewProgress(null);
  const original = JSON.stringify(progress);
  assert.equal(availableSky("aurora", progress).id, "midnight");
  progress = recordCrewFlight(progress, {
    cat: "Hubert",
    score: 25,
    mode: "practice",
  });
  assert.equal(stampCount(progress), 3);
  assert.equal(availableSky("sunset", progress).id, "sunset");
  assert.equal(availableSky("aurora", progress).id, "midnight");
  progress = recordCrewFlight(progress, {
    cat: "Mack",
    score: 25,
    mode: "daily",
  });
  assert.equal(stampCount(progress), 6);
  assert.equal(availableSky("aurora", progress).id, "aurora");
  assert.equal(stampCount(JSON.parse(original)), 0);
  assert.ok(crewStamps(progress.cats.Hubert).every((stamp) => stamp.earned));
  assert.deepEqual(
    recordCrewFlight(progress, {
      cat: "__proto__",
      score: 99,
      mode: "classic",
    }),
    progress,
  );
  assert.deepEqual(
    recordCrewFlight(progress, { cat: "Mia", score: NaN, mode: "classic" }),
    progress,
  );
});
test("clean-pass feedback uses the center of the gap, independently of score rules", () => {
  assert.equal(isCleanPass(300, 300, 150), true);
  assert.equal(isCleanPass(323, 300, 150), false);
  assert.equal(isCleanPass(323, 300, 200), true);
  assert.equal(isCleanPass(NaN, 300, 150), false);
  assert.match(flightAdvice("ground", 0), /too low/);
  assert.match(flightAdvice("upper", 3), /less lift/);
  assert.match(flightAdvice("lower", 3), /earlier/);
});
