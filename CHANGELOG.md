# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-07

### Added

- Initial Model Citizen release: intersection search, a blind GPT-5.6 vision pass, DataSF
  crash/311, OSM, and Legistar corroboration, a Three.js diorama, and resident letter
  generation (2026-07-21).
- Analysis requests are validated and rate-limited (2026-07-21).
- SSE analysis requests abort cleanly when the client disconnects (2026-07-21).
- CI workflow: lint, the test suite, and the Vite build run on every push (2026-09-04).
- Headless-Chromium screenshots of judge mode under `docs/`, referenced from the README
  (2026-09-07).
- HTTP-level integration tests covering input validation, rate limiting, and SSE-abort
  forwarding against the real Express routes (2026-09-07).

### Changed

- Dependabot keeps GitHub Actions workflow versions current (2026-09-04).
- README gained a CI badge (2026-09-04).
- README's "GPT-5.6 integration" section corrected to describe what Stage 4 (the letter
  and social-post generator) actually receives (2026-09-07).

### Fixed

- Client-facing error messages are sanitized to avoid leaking upstream details
  (2026-07-21).
- 311 corroboration report keyword matching narrowed to reduce false positives
  (2026-07-21).

### Security

- Patched the five npm advisories flagged by Dependabot (2026-09-06).
