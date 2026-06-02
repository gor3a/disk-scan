# Security Policy

## Supported versions

`dscan` is pre-1.0; security fixes are applied to the latest `main`.

## Reporting a vulnerability

Because `dscan` deletes files, security issues are taken seriously — especially
anything that could cause it to delete, trash, or expose data outside the user's
explicit selection.

**Please do not open a public issue for a vulnerability.** Instead, report it
privately:

- Use GitHub's **"Report a vulnerability"** (Security → Advisories) on the
  repository, or
- Email **mina.sameh.lameh@gmail.com** with the details.

Include:

- A description of the issue and its impact.
- Steps to reproduce (a minimal case is ideal).
- The OS and `dscan --version`.

We'll acknowledge your report, investigate, and coordinate a fix and disclosure
timeline with you. Thank you for helping keep users safe.

## Scope examples

In scope: a path that should be `KEEP` becoming deletable; `--dry-run`
performing a deletion; the cleaner removing a path outside the selected item;
trash overwriting an unrelated trashed item; classification that routes user
data to hard-delete instead of Trash.
