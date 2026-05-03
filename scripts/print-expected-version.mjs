#!/usr/bin/env node
/**
 * Prints the SSOT API version to stdout (no newline-control logic; trim on
 * the consumer side if needed). Used by Netlify and GitHub Actions to export
 * EXPECTED_OPENAPI_VERSION dynamically.
 *
 * Usage: EXPECTED_OPENAPI_VERSION=$(node scripts/print-expected-version.mjs)
 */
import { readExpectedVersion } from './lib/read-expected-version.mjs';
process.stdout.write(readExpectedVersion());
