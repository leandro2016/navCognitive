import { describe, it, expect } from "vitest";
import {
  shuffle,
  normalizeQuestion,
  getAllQuestions,
  getMaxId,
  nextCustomId,
  getOverdueCount,
  updateReviews,
  computeCategoryStats,
  categoryWeights,
  weightedShuffle,
  validateImportedQuestions,
  shuffleSteps,
  questionTimer,
  buildSession,
} from "../src/lib/session.js";

// ─── shuffle ───────────────────────────────────────────────────────────────
describe("shuffle", () => {
  it("returns a new array with the same elements", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).not.toBe(input);
    expect(out.sort()).toEqual(input);
  });

  it("handles empty arrays", () => {
    expect(shuffle([])).toEqual([]);
  });
});

// ─── normalizeQuestion ─────────────────────────────────────────────────────
describe("normalizeQuestion", () => {
  it("fills missing optional fields", () => {
    const q = normalizeQuestion({ id: 1, cat: "NAV", q: "x", a: "y" });
    expect(q.d).toBe("");
    expect(q.tags).toEqual([]);
    expect(q.difficulty).toBeNull();
  });

  it("preserves existing fields", () => {
    const q = normalizeQuestion({ id: 1, cat: "NAV", q: "x", a: "y", d: "z", tags: ["a"], difficulty: 3 });
    expect(q.d).toBe("z");
    expect(q.tags).toEqual(["a"]);
    expect(q.difficulty).toBe(3);
  });

  it("returns null for non-objects", () => {
    expect(normalizeQuestion(null)).toBeNull();
  });
});

// ─── getAllQuestions ───────────────────────────────────────────────────────
describe("getAllQuestions", () => {
  it("merges builtin and custom without duplicating builtin ids", () => {
    const custom = [{ id: -1, cat: "NAV", role: "ALL", fatigue: 1, q: "c", a: "d" }];
    const all = getAllQuestions(custom);
    const ids = all.map(q => q.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it("normalizes custom questions", () => {
    const custom = [{ id: -1, cat: "NAV", role: "ALL", fatigue: 1, q: "c", a: "d" }];
    const all = getAllQuestions(custom);
    const c = all.find(q => q.id === -1);
    expect(c.tags).toEqual([]);
    expect(c.d).toBe("");
  });
});

// ─── getMaxId / nextCustomId ───────────────────────────────────────────────
describe("getMaxId", () => {
  it("returns the max id", () => {
    expect(getMaxId([{ id: 5 }, { id: 12 }, { id: 3 }])).toBe(12);
  });
  it("returns 0 for empty", () => {
    expect(getMaxId([])).toBe(0);
  });
});

describe("nextCustomId", () => {
  it("returns -1 when no custom ids exist", () => {
    expect(nextCustomId([{ id: 1 }, { id: 2 }])).toBe(-1);
  });
  it("decrements from the most negative custom id", () => {
    expect(nextCustomId([{ id: 1 }, { id: -1 }, { id: -3 }])).toBe(-4);
  });
});

// ─── spaced repetition ─────────────────────────────────────────────────────
describe("getOverdueCount", () => {
  it("counts due reviews", () => {
    const now = 1000;
    const reviews = { 1: { due: 500 }, 2: { due: 2000 }, 3: { due: 1000 } };
    expect(getOverdueCount(reviews, now)).toBe(2); // 500 and 1000 <= 1000
  });
  it("returns 0 for empty", () => {
    expect(getOverdueCount(null)).toBe(0);
  });
});

describe("updateReviews", () => {
  it("resets interval to 1 on wrong answer", () => {
    const reviews = { 1: { interval: 7, ease: 2.2, due: 0 } };
    const results = [{ q: { id: 1 }, correct: false }];
    const next = updateReviews(reviews, results, 1000);
    expect(next[1].interval).toBe(1);
    expect(next[1].ease).toBeCloseTo(2.0, 1);
  });

  it("increases interval on correct answer", () => {
    const reviews = { 1: { interval: 2, ease: 2.2, due: 0 } };
    const results = [{ q: { id: 1 }, correct: true }];
    const next = updateReviews(reviews, results, 1000);
    expect(next[1].interval).toBeGreaterThanOrEqual(4);
    expect(next[1].ease).toBeCloseTo(2.3, 1);
  });

  it("caps ease at 2.5", () => {
    const reviews = { 1: { interval: 1, ease: 2.45, due: 0 } };
    const results = [{ q: { id: 1 }, correct: true }];
    const next = updateReviews(reviews, results, 1000);
    expect(next[1].ease).toBe(2.5);
  });

  it("floors ease at 1.3", () => {
    const reviews = { 1: { interval: 1, ease: 1.4, due: 0 } };
    const results = [{ q: { id: 1 }, correct: false }];
    const next = updateReviews(reviews, results, 1000);
    expect(next[1].ease).toBe(1.3);
  });
});

// ─── adaptive weighting ───────────────────────────────────────────────────
describe("computeCategoryStats", () => {
  it("aggregates correct/total per category", () => {
    const history = [{
      results: [[{ q: { id: 1, cat: "NAV" }, correct: true }],
                [{ q: { id: 2, cat: "NAV" }, correct: false }],
                [{ q: { id: 3, cat: "MAN" }, correct: true }]],
    }];
    const stats = computeCategoryStats(history);
    expect(stats.NAV).toEqual({ correct: 1, total: 2 });
    expect(stats.MAN).toEqual({ correct: 1, total: 1 });
  });

  it("returns empty for no history", () => {
    expect(computeCategoryStats(null)).toEqual({});
  });
});

describe("categoryWeights", () => {
  it("returns 1.0 for categories with <5 answers", () => {
    const stats = { NAV: { correct: 1, total: 3 } };
    const w = categoryWeights(stats);
    expect(w.NAV).toBe(1.0);
  });

  it("gives higher weight to weaker categories", () => {
    const stats = {
      NAV: { correct: 9, total: 10 }, // 90% → low weight
      REG: { correct: 2, total: 10 }, // 20% → high weight
    };
    const w = categoryWeights(stats);
    expect(w.REG).toBeGreaterThan(w.NAV);
  });

  it("caps weight at 2.0", () => {
    const stats = { REG: { correct: 0, total: 10 } }; // 0% → max
    const w = categoryWeights(stats);
    expect(w.REG).toBe(2.0);
  });
});

describe("weightedShuffle", () => {
  it("returns all unique questions", () => {
    const qs = [
      { id: 1, cat: "NAV" },
      { id: 2, cat: "NAV" },
      { id: 3, cat: "REG" },
    ];
    const weights = { NAV: 1.0, REG: 2.0 };
    const out = weightedShuffle(qs, weights);
    expect(out.length).toBe(3);
    expect(new Set(out.map(q => q.id)).size).toBe(3);
  });
});

// ─── validateImportedQuestions ─────────────────────────────────────────────
describe("validateImportedQuestions", () => {
  it("validates a correct array", () => {
    const raw = [{ cat: "NAV", role: "ALL", fatigue: 2, q: "q", a: "a", d: "d" }];
    const out = validateImportedQuestions(raw);
    expect(out[0].q).toBe("q");
    expect(out[0].tags).toEqual([]);
  });

  it("throws on non-array", () => {
    expect(() => validateImportedQuestions({})).toThrow();
  });

  it("throws on invalid cat", () => {
    expect(() => validateImportedQuestions([{ cat: "XXX", q: "q", a: "a" }])).toThrow();
  });

  it("throws on missing question text", () => {
    expect(() => validateImportedQuestions([{ cat: "NAV", q: "", a: "a" }])).toThrow();
  });

  it("defaults invalid role to ALL", () => {
    const out = validateImportedQuestions([{ cat: "NAV", role: "ZZZ", q: "q", a: "a" }]);
    expect(out[0].role).toBe("ALL");
  });

  it("defaults invalid fatigue to 1", () => {
    const out = validateImportedQuestions([{ cat: "NAV", q: "q", a: "a", fatigue: 99 }]);
    expect(out[0].fatigue).toBe(1);
  });
});

// ─── procedural question types (type/steps) ────────────────────────────────
describe("normalizeQuestion — type/steps", () => {
  it("defaults type to recall and steps to []", () => {
    const q = normalizeQuestion({ id: 1, cat: "NAV", q: "x", a: "y" });
    expect(q.type).toBe("recall");
    expect(q.steps).toEqual([]);
  });

  it("preserves valid type and steps", () => {
    const q = normalizeQuestion({ id: 1, cat: "MAN", q: "x", a: "y", type: "sequence", steps: ["a", "b"] });
    expect(q.type).toBe("sequence");
    expect(q.steps).toEqual(["a", "b"]);
  });

  it("falls back invalid type to recall", () => {
    const q = normalizeQuestion({ id: 1, cat: "MAN", q: "x", a: "y", type: "bogus" });
    expect(q.type).toBe("recall");
  });
});

describe("validateImportedQuestions — procedural fields", () => {
  it("accepts type sequence with steps", () => {
    const out = validateImportedQuestions([{ cat: "MAN", q: "q", a: "a", type: "sequence", steps: ["x", "y"] }]);
    expect(out[0].type).toBe("sequence");
    expect(out[0].steps).toEqual(["x", "y"]);
  });

  it("accepts type invalid with invalidIndex", () => {
    const out = validateImportedQuestions([{ cat: "MAN", q: "q", a: "a", type: "invalid", steps: ["a", "b", "c"], invalidIndex: 1 }]);
    expect(out[0].type).toBe("invalid");
    expect(out[0].invalidIndex).toBe(1);
  });

  it("accepts type filter with validMask", () => {
    const out = validateImportedQuestions([{ cat: "MAN", q: "q", a: "a", type: "filter", steps: ["a", "b"], validMask: [true, false] }]);
    expect(out[0].type).toBe("filter");
    expect(out[0].validMask).toEqual([true, false]);
  });

  it("defaults unknown type to recall", () => {
    const out = validateImportedQuestions([{ cat: "NAV", q: "q", a: "a", type: "bogus" }]);
    expect(out[0].type).toBe("recall");
  });

  it("rejects invalidIndex out of range", () => {
    const out = validateImportedQuestions([{ cat: "MAN", q: "q", a: "a", type: "invalid", steps: ["a"], invalidIndex: 5 }]);
    expect(out[0].invalidIndex).toBeNull();
  });

  it("accepts new cats (TRIM/TACT/METEO/SEG)", () => {
    const out = validateImportedQuestions([{ cat: "TRIM", q: "q", a: "a" }]);
    expect(out[0].cat).toBe("TRIM");
  });

  it("accepts new roles (TAC/TIM/PIT/NAVEG)", () => {
    const out = validateImportedQuestions([{ cat: "NAV", q: "q", a: "a", role: "TAC" }]);
    expect(out[0].role).toBe("TAC");
  });
});

// ─── shuffleSteps ──────────────────────────────────────────────────────────
describe("shuffleSteps", () => {
  it("returns same elements in possibly different order", () => {
    const steps = ["a", "b", "c", "d"];
    const out = shuffleSteps(steps, 42);
    expect(out.sort()).toEqual(steps);
  });

  it("is deterministic for same seed", () => {
    const steps = ["a", "b", "c", "d", "e"];
    expect(shuffleSteps(steps, 7)).toEqual(shuffleSteps(steps, 7));
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffleSteps([], 1)).toEqual([]);
    expect(shuffleSteps(["x"], 1)).toEqual(["x"]);
  });
});

// ─── questionTimer ─────────────────────────────────────────────────────────
describe("questionTimer", () => {
  it("returns base for recall", () => {
    expect(questionTimer(10, { type: "recall" })).toBe(10);
  });

  it("multiplies by type (sequence x1.5)", () => {
    expect(questionTimer(10, { type: "sequence" })).toBe(15);
  });

  it("multiplies by type (invalid x1.3)", () => {
    expect(questionTimer(10, { type: "invalid" })).toBe(13);
  });

  it("honors explicit timeLimit override", () => {
    expect(questionTimer(10, { type: "sequence", timeLimit: 40 })).toBe(40);
  });

  it("defaults to base for unknown type", () => {
    expect(questionTimer(10, { type: "bogus" })).toBe(10);
  });
});

// ─── buildSession ──────────────────────────────────────────────────────────
describe("buildSession", () => {
  const allQ = [
    { id: 1, cat: "NAV", role: "ALL", fatigue: 1, q: "q1", a: "a1", type: "recall" },
    { id: 2, cat: "MAN", role: "ALL", fatigue: 2, q: "q2", a: "a2", type: "sequence", steps: ["x", "y"] },
    { id: 3, cat: "DEC", role: "ALL", fatigue: 1, q: "q3", a: "a3", type: "recall" },
  ];

  it("builds a custom sprint round with questionTimers array", () => {
    const rounds = buildSession("custom", "ALL", "hard", allQ, { cats: ["NAV", "MAN", "DEC"], count: 3 });
    expect(rounds.length).toBe(1);
    expect(rounds[0].type).toBe("sprint");
    expect(Array.isArray(rounds[0].questionTimers)).toBe(true);
    expect(rounds[0].questionTimers.length).toBe(rounds[0].questions.length);
  });

  it("applies timer multiplier for sequence questions", () => {
    const rounds = buildSession("custom", "ALL", "hard", allQ, { cats: ["MAN"], count: 1 });
    const seqTimer = rounds[0].questionTimers[0];
    const base = rounds[0].questionTimer;
    expect(seqTimer).toBe(Math.round(base * 1.5));
  });
});