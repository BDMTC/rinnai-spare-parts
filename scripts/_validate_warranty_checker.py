import json
from pathlib import Path

d = json.loads(
    Path("public/data/rinnai-process.json").read_text(encoding="utf-8")
)
t = next(x for x in d["topics"] if x["id"] == "warranty")
qs = t["checker"]["questions"]
outs = set(t["checker"]["outcomes"])
errs = []
chase = []
for qid, q in qs.items():
    for c in q.get("choices", []):
        if "next" in c and c["next"] not in qs:
            errs.append(f"{qid} -> missing next {c['next']}")
        if "outcome" in c and c["outcome"] not in outs:
            errs.append(f"{qid} -> bad outcome {c['outcome']}")
        if "next" not in c and "outcome" not in c:
            errs.append(f"{qid} choice missing next/outcome: {c}")
        oc = str(c.get("outcome") or "")
        lab = str(c.get("label") or "").lower()
        if oc.startswith("chase") or "chase booklet" in lab or "chase rinnai" in lab:
            chase.append(f"{qid}: {c.get('label')} -> {oc}")
if "chase_rinnai" in outs or "chase_booklet" in outs:
    errs.append("outcomes still include chase_*")
print("ok" if not errs and not chase else "\n".join((errs + chase)[:40]))
print("start_ok", t["checker"]["startId"] in qs)
print("q_count", len(qs), "tables", len(t["tables"]))
print(
    "escalate",
    sum(
        1
        for q in qs.values()
        for c in q.get("choices", [])
        if c.get("outcome") == "escalate_rinnai"
    ),
)
print("has_escalation_block", isinstance(t["checker"].get("escalation"), dict))
