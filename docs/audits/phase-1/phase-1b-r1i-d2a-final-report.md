# Phase 1B — R1I-d.2A — Final Report (superseded by R1I-d.2A-DB1)

The R1I-d.2A slice previously recorded PASS (LOCAL/TEST) at the packaging
layer only. Subsequent verification (R1I-d.2A-V, R1I-d.2A-V2) established
that:

1. The canonical migration as originally written used `CREATE INDEX
   CONCURRENTLY`, which the Supabase migration runner cannot execute inside
   its transactional wrapper. Predecessor gate:
   `PHASE 1B-R1I-d.2A BLOCKED — CONCURRENT INDEX MIGRATION RUNNER INCOMPATIBLE`.
2. Executable evidence for §§7–14 / §17 / §19 of the R1I-d.2A-DB1
   authorisation has not been produced in this sandbox.

The controlling final report is now
[`phase-1b-r1i-d2a-db1-final-report.md`](./phase-1b-r1i-d2a-db1-final-report.md).
This file is retained as history only.
