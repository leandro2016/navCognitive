#!/usr/bin/env python3
"""
mechanical_checks.py — Fast, deterministic, free checks over the question bank.

This script does NOT judge meaning or context. It only catches things that
are checkable with code: schema violations, id problems, near-duplicate
question text, source/category mismatches, and a numeric/situational-anchor
heuristic that flags LOW-CONTEXT CANDIDATES for human/LLM review.

It never modifies naut-preguntas-master.json. It only reads and reports.

Usage:
    python3 mechanical_checks.py <path-to-master.json> [--out report.json]

Output: a JSON report consumed by the SKILL.md workflow (and readable by a
human directly — keys are in plain language).
"""
import json
import re
import sys
import argparse
import unicodedata
from collections import defaultdict, Counter

REQUIRED_FIELDS = ["id", "cat", "role", "fatigue", "q", "a", "d", "source"]
VALID_CAT = {"NAV", "MAN", "DEC", "REG", "SIT", "TRIM", "TACT", "METEO", "SEG"}
VALID_ROLE = {"ALL", "GEN", "MAY", "PRO", "TAC", "TIM", "PIT", "NAVEG", "TOD"}
VALID_FATIGUE = {1, 2, 3, 4}
VALID_TYPE = {"recall", "sequence", "invalid", "filter"}

# Headers/patterns that strongly suggest a doc-subtitle was copy-pasted as a
# question stem without rebuilding it into a self-contained scenario. These
# are the same shapes seen empirically in the bank (e.g. "X · ¿Qué produce?").
HEADER_LIKE_PATTERNS = [
    r"^[A-ZÁÉÍÓÚÑa-záéíóúñ0-9 /()]+\s*[·:]\s*¿",   # "Term · ¿Question?"
    r"^¿Qué (es|controla|produce|genera|significa)\b",
    r"^¿Cuál es el control principal\b",
    r"control principal\?$",
]

# Pure-definition / glossary recall is a LEGITIMATE question shape — it does
# not need a situational scene, because it isn't asking the model to
# diagnose anything. "¿Qué controla el outhaul?" is fine as-is.
DEFINITION_SIGNALS = [
    r"\bqué (es|mide|controla|sostiene)\b",
    r"\bcontrol principal\b",
    r"\bfunción\b",
    r"\bdefinición\b",
]

# Diagnostic-shaped language is the dangerous case: it presupposes an
# observation, a symptom, a cause, or an action recommendation. If a question
# uses this language WITHOUT also supplying the scene (a wind/angle/maneuver/
# symptom-observed detail), the reader has nothing to reason from — this is
# the exact shape of the #61 example that triggered this audit.
DIAGNOSTIC_SIGNALS = [
    r"\bsíntomas?\b", r"\bdiagnóstico\b", r"\bcausas?\s+posibles?\b",
    r"\brevisar\b", r"\bacción\b", r"\bqué hacer\b", r"\bindica\b",
    r"\bsospech", r"\bqué pasa\b", r"\bqué problema\b",
]

# A crude situational-anchor heuristic: presence of a number (wind speed,
# angle, time, distance) OR an explicit point-of-sail / maneuver phrase OR
# an explicit observed-symptom phrase suggests the question carries its own
# scene. Absence doesn't *prove* the question is bad, but it's the single
# strongest correlate found in the manual audit of this bank, so we use it
# as the primary triage signal, not a hard rule.
SITUATION_SIGNALS = [
    r"\d+\s*(kn|nudos|°|grados|mn|kg)?",
    r"\bceñida\b", r"\btravés\b", r"\blargo\b", r"\bpopa\b",
    r"\bracha\b", r"\bola\b", r"\bborneo\b",
    r"\bviento (liviano|flojo|medio|fuerte)\b",
]


def strip_accents(s):
    return "".join(
        c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)
    )


def normalize_q(s):
    s = strip_accents(s.lower())
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"[^\w \->]", "", s)
    return s


def token_set(s):
    return set(normalize_q(s).split())


def jaccard(a, b):
    if not a and not b:
        return 1.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def check_schema(data):
    issues = []
    seen_ids = {}
    for q in data:
        qid = q.get("id")
        for f in REQUIRED_FIELDS:
            if f not in q or q[f] in (None, "", []):
                issues.append({"id": qid, "issue": "missing_field", "field": f})
        if "cat" in q and q["cat"] not in VALID_CAT:
            issues.append({"id": qid, "issue": "invalid_cat", "value": q.get("cat")})
        if "role" in q and q["role"] not in VALID_ROLE:
            issues.append({"id": qid, "issue": "invalid_role", "value": q.get("role")})
        if "fatigue" in q and q["fatigue"] not in VALID_FATIGUE:
            issues.append({"id": qid, "issue": "invalid_fatigue", "value": q.get("fatigue")})
        t = q.get("type", "recall")
        if t not in VALID_TYPE:
            issues.append({"id": qid, "issue": "invalid_type", "value": t})
        if t != "recall" and "steps" not in q:
            issues.append({"id": qid, "issue": "procedural_missing_steps", "type": t})
        if t == "invalid" and "invalidIndex" not in q:
            issues.append({"id": qid, "issue": "invalid_missing_invalidIndex"})
        if t == "filter" and "validMask" not in q:
            issues.append({"id": qid, "issue": "filter_missing_validMask"})
        if qid in seen_ids:
            issues.append({"id": qid, "issue": "duplicate_id", "other": seen_ids[qid]})
        else:
            seen_ids[qid] = qid
    return issues


def check_near_duplicates(data, threshold=0.82):
    """Flag pairs whose question text is highly similar, NOT just identical.
    Two signals combined:
      - token Jaccard (bag-of-words overlap)
      - sequence ratio (order-sensitive, via difflib) to avoid false
        positives on domain content where WORD ORDER is the entire meaning
        (e.g. light-pattern questions: "Roja sobre Blanca" vs "Blanca sobre
        Roja" describe DIFFERENT vessel types in COLREG — same words,
        opposite meaning). A pair is only flagged if BOTH signals agree.
    """
    import difflib

    def seq_ratio(a, b):
        return difflib.SequenceMatcher(None, normalize_q(a), normalize_q(b)).ratio()

    pairs = []
    items = [(q["id"], q["q"], token_set(q["q"]), q["cat"]) for q in data]
    by_cat = defaultdict(list)
    for item in items:
        by_cat[item[3]].append(item)
    for cat, group in by_cat.items():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                id1, text1, t1, _ = group[i]
                id2, text2, t2, _ = group[j]
                jac = jaccard(t1, t2)
                if jac < threshold:
                    continue
                seq = seq_ratio(text1, text2)
                if seq >= threshold:
                    pairs.append({
                        "id_a": id1, "id_b": id2,
                        "jaccard": round(jac, 2), "sequence_ratio": round(seq, 2),
                        "likely_true_duplicate": seq >= 0.95,
                    })
    return pairs


def check_context_anchor(data):
    """Returns low-context CANDIDATES, not verdicts. Three buckets, ordered
    by how much trust the regex signal deserves:

    - 'high_confidence_no_scene': the question explicitly uses diagnostic
      vocabulary (síntoma, diagnóstico, causa, acción ante X, qué hacer)
      with ZERO situational anchor. Regex precision here is high — in the
      manual audit, every match in this bucket was a real instance of the
      defect (a doc-subtitle turned into a question, losing the paragraph
      that gave it meaning). Safe to batch-queue for rewrite with high
      confidence, but a human/LLM should still confirm the proposed fix
      doesn't invent facts not in the source doc.

    - 'needs_llm_review': header-shaped or short, but NOT using clearly
      diagnostic language. This is a mixed bag — some are legitimate
      atomic recall ('¿Por qué existe el twist?' is a mechanism question,
      not a diagnosis), others are vague in the same way as the strict
      bucket but phrased differently ('Twist · ¿Por qué existe?'). A regex
      cannot reliably tell these apart; this bucket exists to bound the
      LLM review's scope, not to pre-judge it.

    - 'bare_definition': clearly a definition/function question
      ('¿Qué controla el outhaul?'). Low priority, usually fine as-is.
    """
    high_confidence_no_scene = []
    needs_llm_review = []
    bare_definition = []
    for q in data:
        text = q["q"]
        has_signal = any(re.search(p, text, re.IGNORECASE) for p in SITUATION_SIGNALS)
        is_diagnostic = any(re.search(p, text, re.IGNORECASE) for p in DIAGNOSTIC_SIGNALS)
        is_definition = any(re.search(p, text, re.IGNORECASE) for p in DEFINITION_SIGNALS)
        header_like = any(re.search(p, text) for p in HEADER_LIKE_PATTERNS)
        very_short = len(text.split()) <= 8

        if has_signal:
            continue  # has its own scene, not a candidate either way

        entry = {"id": q["id"], "cat": q["cat"], "source": q.get("source"),
                  "q": text, "a": q.get("a")}

        if is_diagnostic:
            high_confidence_no_scene.append(entry)
        elif is_definition and (header_like or very_short):
            bare_definition.append({k: entry[k] for k in ("id", "cat", "source", "q")})
        elif header_like or very_short:
            needs_llm_review.append(entry)
    return {
        "high_confidence_no_scene": high_confidence_no_scene,
        "needs_llm_review": needs_llm_review,
        "bare_definition": bare_definition,
    }


def check_source_distribution(data):
    by_source = Counter(q.get("source") for q in data)
    by_cat_source = defaultdict(Counter)
    for q in data:
        by_cat_source[q.get("cat")][q.get("source")] += 1
    return {"by_source": dict(by_source), "by_cat_source": {k: dict(v) for k, v in by_cat_source.items()}}


def check_unknown_sources(data, known_sources):
    unknown = defaultdict(list)
    for q in data:
        src = q.get("source")
        if src not in known_sources:
            unknown[src].append(q["id"])
    return {k: v for k, v in unknown.items()}


KNOWN_SOURCES = {
    "15_NAVEGACION", "17_CORRIENTES", "16_METEOROLOGIA", "04_MANIOBRAS",
    "05_AERODINAMICA", "06_MAYOR", "07_GENOVA", "08_SPINNAKER",
    "01_RRS", "02_COLREG", "03_IALA", "13_LUCES", "14_PROTESTA",
    "18_SENALES_DE_REGATA", "general", "relato",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("master_json")
    ap.add_argument("--out", default=None, help="write JSON report here instead of stdout")
    ap.add_argument("--dup-threshold", type=float, default=0.82)
    args = ap.parse_args()

    with open(args.master_json, encoding="utf-8") as f:
        data = json.load(f)

    context_anchor = check_context_anchor(data)
    report = {
        "total_questions": len(data),
        "schema_issues": check_schema(data),
        "near_duplicates": check_near_duplicates(data, args.dup_threshold),
        "high_confidence_no_scene": context_anchor["high_confidence_no_scene"],
        "needs_llm_review": context_anchor["needs_llm_review"],
        "bare_definition": context_anchor["bare_definition"],
        "source_distribution": check_source_distribution(data),
        "unknown_sources": check_unknown_sources(data, KNOWN_SOURCES),
    }
    report["summary"] = {
        "schema_issues_count": len(report["schema_issues"]),
        "near_duplicate_pairs": len(report["near_duplicates"]),
        "high_confidence_no_scene_count": len(report["high_confidence_no_scene"]),
        "needs_llm_review_count": len(report["needs_llm_review"]),
        "bare_definition_count": len(report["bare_definition"]),
        "unknown_source_question_count": sum(len(v) for v in report["unknown_sources"].values()),
    }

    out = json.dumps(report, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"Report written to {args.out}")
        print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    else:
        print(out)


if __name__ == "__main__":
    main()
