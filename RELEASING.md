# Releasing

Releases are tagged `vX.Y.Z`, published as GitHub releases, and deployed to
Upsun by hand. These steps are written for a maintainer or a coding agent to
follow.

## 1. Choose the version

List the changes since the last release:

```bash
git fetch origin --tags
PREV=$(git describe --tags --abbrev=0 origin/main)
git log --no-merges --format='%h %s' "$PREV..origin/main" -- upsun-mcp/
```

Before 1.0, breaking changes and new features bump the minor version, and fixes
bump the patch version. Changes outside `upsun-mcp/` don't need a release.

## 2. Open the release PR

From a branch off `origin/main`:

```bash
cd upsun-mcp && npm version X.Y.Z --no-git-tag-version
```

This updates `package.json` and `package-lock.json`. Commit them as
`chore: release vX.Y.Z` and open a PR with that title. The PR description holds
the draft release notes:

- Sections, in order and only when non-empty: **Breaking changes**, **Features**,
  **Fixes**, **Configuration**.
- One line per user-visible change, linking its PR or commit. Merge similar
  changes, and leave out internal refactors, tests, CI and dependency bumps
  unless users notice them.
- Under **Breaking changes**, say what users must do.
- Under **Configuration**, list new, removed or changed environment variables
  and defaults.

## 3. Tag and publish

After the release PR merges, save the release notes from its description to
`notes.md`, then tag the merge commit and publish:

```bash
git fetch origin
git tag -a vX.Y.Z -m vX.Y.Z <merge-commit>
git push origin vX.Y.Z
gh release create vX.Y.Z --title vX.Y.Z --notes-file notes.md
```

## 4. Deploy

The server runs on an Upsun project with two environments:

- `main`: production at `https://mcp.upsun.com/`, with Upsun Auth at
  `auth.upsun.com`. It uses manual deployments: a push builds the release, and
  `upsun environment:deploy` makes it live. It deploys with the rolling
  strategy, which needs the project's maintenance window to be set.
- `staging`: a child of `main` at `https://mcp.upsun.plat.farm/`, with the
  staging Auth at `auth.upsun.plat.farm`. It uses automatic deployments. The
  `Deploy staging` workflow pushes each commit of `main` to it after CI passes,
  with the `UPSUN_CLI_TOKEN` repository secret. Staging is never paused.

1. Make sure that staging runs the release: the staging commit must be the
   release PR's merge commit or contain it. A `Deploy staging` run can be
   cancelled or skip its push when a newer commit reaches staging first, so
   check the staging commit, not the run:

   ```bash
   git fetch origin
   git merge-base --is-ancestor <merge-commit> \
     "$(upsun environment:info -p <project-id> -e staging head_commit)" \
     && echo "staging runs the release"
   ```

2. Smoke-test staging: check the OAuth metadata at
   `/.well-known/oauth-authorization-server`, then connect an MCP client and
   call the tools the release changed.

3. Add the project's Git remote once:

   ```bash
   git remote add upsun "$(upsun project:info -p <project-id> git)"
   ```

4. Deploy the tag to production without downtime:

   ```bash
   git fetch origin --tags
   git push upsun vX.Y.Z^{commit}:refs/heads/main
   upsun environment:deploy -p <project-id> -e main --strategy=rolling
   ```

   Repeat the checks on `https://mcp.upsun.com/`.

Configuration comes from code defaults in `upsun-mcp/src/core/config.ts`, with
overrides in Upsun environment variables. Check those variables when a release
changes a setting.
