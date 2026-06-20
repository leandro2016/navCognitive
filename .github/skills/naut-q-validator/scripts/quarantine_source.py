#!/usr/bin/env python3
"""
quarantine_source.py — Move all questions from a given `source` value out of
the master JSON into a separate quarantine file. NEVER runs automatically;
always invoked explicitly with a named source and always writes to a NEW
master file (never overwrites in place) so the user can diff before
replacing the original.

Usage:
    python3 quarantine_source.py <master.json> --source charla-genoa-manzoli \
        --quarantine-out quarantine_charla-genoa-manzoli.json \
        --master-out naut-preguntas-master.NEW.json

The user must explicitly rename/replace the original master file themselves
after reviewing the diff. This script will not touch the original.
"""
import json
import argparse
from datetime import datetime, timezone


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("master_json")
    ap.add_argument("--source", required=True, help="value of the 'source' field to quarantine")
    ap.add_argument("--reason", default="", help="short note on why this source is quarantined")
    ap.add_argument("--quarantine-out", required=True)
    ap.add_argument("--master-out", required=True)
    args = ap.parse_args()

    with open(args.master_json, encoding="utf-8") as f:
        data = json.load(f)

    quarantined = [q for q in data if q.get("source") == args.source]
    remaining = [q for q in data if q.get("source") != args.source]

    if not quarantined:
        print(f"No questions found with source='{args.source}'. Nothing to do.")
        return

    quarantine_payload = {
        "_meta": {
            "quarantined_from": args.master_json,
            "source": args.source,
            "reason": args.reason,
            "quarantined_at": datetime.now(timezone.utc).isoformat(),
            "count": len(quarantined),
            "restore_note": (
                "To restore: review/reconcile the vocabulary conflict per "
                "references/contradiction-detection.md, then append these "
                "question objects back into the master JSON array (keep "
                "original ids, do not renumber)."
            ),
        },
        "questions": quarantined,
    }

    with open(args.quarantine_out, "w", encoding="utf-8") as f:
        json.dump(quarantine_payload, f, ensure_ascii=False, indent=2)

    with open(args.master_out, "w", encoding="utf-8") as f:
        json.dump(remaining, f, ensure_ascii=False, indent=2)

    print(f"Quarantined {len(quarantined)} questions (source='{args.source}') "
          f"-> {args.quarantine_out}")
    print(f"Remaining {len(remaining)} questions written to NEW file -> {args.master_out}")
    print("Original master file was NOT modified. Review the new file, then "
          "replace the original yourself once satisfied.")


if __name__ == "__main__":
    main()
