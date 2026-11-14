import json
from pathlib import Path

d = json.loads(
    Path("public/data/rinnai-process.json").read_text(encoding="utf-8")
)
t = next(x for x in d["topics"] if x["id"] == "warranty")
qs = t["checker"]["questions"]
outs = set(t["checker"]["outcomes"])
errs = []
for qid, q in qs.items():
    for c in q.get("choices", []):
        if "next" in c and c["next"] not in qs:
            errs.append(f"{qid} -> missing next {c['next']}")
        if "outcome" in c and c["outcome"] not in outs:
            errs.append(f"{qid} -> bad outcome {c['outcome']}")
        if "next" not in c and "outcome" not in c:
            errs.append(f"{qid} choice missing next/outcome: {c}")
print("ok" if not errs else "\n".join(errs[:40]))
print("start_ok", t["checker"]["startId"] in qs)
print("q_count", len(qs), "tables", len(t["tables"]))
