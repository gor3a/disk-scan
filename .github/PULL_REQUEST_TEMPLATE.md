<!-- 
IMPORTANT: This repo uses squash-merge with your PR title as the commit message.
Your PR title MUST be a Conventional Commit (e.g., "feat: add smart caching" or "fix: prevent race condition on Linux").
See https://www.conventionalcommits.org/
-->

## Summary

<!-- What does this change and why? Link any related issue with "Closes #123" if applicable. Keep to 1-3 sentences. -->

## Type of change

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] docs — documentation
- [ ] refactor — code refactoring (no feature change)
- [ ] test — adding/updating tests
- [ ] chore — build, CI, dependencies

## Test plan

### CLI/Core tests
- [ ] `go test ./...` passes
- [ ] `gofmt -l .` prints nothing
- [ ] `go vet ./...` is clean
- [ ] Builds on macOS: `GOOS=darwin go build ./...`
- [ ] Builds on Linux: `GOOS=linux go build ./...`

### Desktop app tests (if changed)
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Manual smoke test on macOS
- [ ] Manual smoke test on Linux (if applicable)

### Safety tests (if touches deletion/cleaning)
- [ ] No `KEEP` items became selectable
- [ ] User data is routed to Trash, not deleted with `rm`
- [ ] Test coverage added for the deletion path

## Checklist

- [ ] PR title is a Conventional Commit (feat/fix/docs/refactor/test/chore)
- [ ] Tested on macOS AND Linux (or documented why not applicable)
- [ ] No secrets, tokens, or credentials in code/commits
- [ ] Tests added or updated for the change
- [ ] If this closes an issue, added `Closes #...` in the Summary

## Notes for reviewers

<!-- Anything that needs extra attention, screenshots of the TUI, benchmarks, etc. -->
