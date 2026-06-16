# Location Module — Extension Seam

This directory contains **contracts only** for a future optional Location module. Nothing here runs today and `LocationModule` is **not** registered in `AppModule`.

## How to enable (future)

1. Implement `LocationProvider` and `LocationService` from `@pacific/shared` in a new package or module.
2. Add `LocationModule.register({ provider, service })` to the `imports` array of `AppModule` (or any feature module that needs it).
3. Inject via `@Inject(LOCATION_PROVIDER)` / `@Inject(LOCATION_SERVICE)` using the tokens exported from `location.tokens.ts`.

No DB tables, no controllers, and no routes need to be added to the core — the seam is self-contained.
