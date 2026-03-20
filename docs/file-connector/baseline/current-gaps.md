# Current Gaps — Resolved by File-Based Bank Connector

## Previously Missing (Now Implemented)
1. ✅ File upload registry with SHA256 dedupe and row-level traceability
2. ✅ CSV schema mapping profiles (bank-specific field mapping with transforms)
3. ✅ Batch payment instruction file generator (CSV + ISO20022 pain.001)
4. ✅ Status file ingestion pipeline with reconciliation
5. ✅ AISP endpoints backed by bank-sourced (file-imported) data
6. ✅ File upload UI in AdminBankDirectory
7. ✅ Sandbox file generation for testing

## Remaining Future Enhancements
- SFTP server/daemon for automated file pickup (currently portal upload)
- PGP encryption for file-at-rest
- camt.053/camt.054 ISO statement parsing
- Ledger holds/releases on batch payment lifecycle
- Automated reconciliation cron job
