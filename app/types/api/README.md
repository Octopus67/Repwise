# Auto-Generated API Types

TypeScript types auto-generated from the backend's OpenAPI spec.

## Generate

```bash
npm run generate
```

This runs `scripts/export-openapi.py` to extract the spec from FastAPI, then `openapi-typescript` to produce `generated.ts`.

## Migration

The files in `types/training.ts`, `types/exercise.ts`, etc. are manually maintained and may drift from the backend. Prefer importing from `@/types/api/generated` for API response types.

UI-only types (ActiveSet, ActiveWorkoutState, etc.) should stay in manual type files since they have no backend equivalent.
