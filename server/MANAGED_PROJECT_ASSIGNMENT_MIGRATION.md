# Managed project assignment migration

The migration creates plan-scoped authorization records while retaining every
legacy owner-keyed assignment document. It is safe to rerun.

## Deployment order

1. Review the dry-run output:
   `npm run migrate:managed-project-assignments`
2. Apply it:
   `npm run migrate:managed-project-assignments -- --apply`
   Confirm the created, skipped, and conflict counts. Resolve unexpected
   conflicts before continuing; the script never overwrites a conflicting
   assignment or deletes a legacy document.
3. Deploy Firestore and Storage rules that accept both plan-scoped assignments
   and matching legacy owner assignments.
4. Deploy the server version that authorizes by plan ID and falls back to
   matching UID or `intendedClientAccountId` legacy assignment documents.
5. Verify existing clients and newly created multiple-plan accounts using the
   manual checklist. Keep the legacy assignment documents in place.
6. Remove legacy fallback reads from server and rules only in a later,
   separately verified change.

## Manual authorization checklist

- The owner can read each of their published plans.
- A different client and an unassigned client cannot read a plan.
- A legacy client with one existing plan retains access.
- Direct client reads of draft and assignment collections remain denied.

No Firebase emulator or rules-test setup is currently configured in this
repository, so the rules checklist must be run against the deployed rules or
an emulator added in a separate change.
