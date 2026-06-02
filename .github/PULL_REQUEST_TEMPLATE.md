<!-- Thanks for contributing to dscan! Keep PRs focused and small. -->

## What & why

<!-- What does this change and why? Link any related issue: Closes #123 -->

## Type

- [ ] feat
- [ ] fix
- [ ] docs
- [ ] test / refactor / chore

## Checklist

- [ ] `gofmt -l .` prints nothing
- [ ] `go vet ./...` is clean
- [ ] `go test ./...` passes
- [ ] Builds on both OSes (`GOOS=linux go build ./...` and `GOOS=darwin go build ./...`)
- [ ] Added/updated tests for the change
- [ ] If this touches deletion/cleaning: no `KEEP` item became selectable, user data routes to Trash (not `rm`), and a test covers the path
- [ ] Commit messages follow Conventional Commits

## Notes for reviewers

<!-- Anything that needs extra attention, screenshots of the TUI, etc. -->
