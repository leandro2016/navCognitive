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