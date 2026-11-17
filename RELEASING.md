# Releasing

Releases are versioned by [release-please](https://github.com/googleapis/release-please)
and deployed to Upsun by hand.

## Versioning

Release-please reads the [Conventional Commits](https://www.conventionalcommits.org/)
on `main` that touch `upsun-mcp/`, so PR titles (used as squash commit messages)
must follow it. Before 1.0, `feat!` and `BREAKING CHANGE` bump the minor
version; `feat` and `fix` bump the patch version.

On each push to `main`, the [Release Please workflow](.github/workflows/release-please.yml)
opens or updates a release PR. It bumps the version in `upsun-mcp/package.json`
and `package-lock.json`, and updates `upsun-mcp/CHANGELOG.md`.

Merging the release PR tags the commit `vX.Y.Z` and publishes a GitHub release.

## Deploying

The server runs on an Upsun project with two environments: `main` (production,
`mcp.upsun.com`) and `staging`, a child of `main` that uses manual deployments.

1. Add the project's Git remote once:

   ```bash
   git remote add upsun "$(upsun project:info -p <project-id> git)"
   ```

2. Deploy the tag to staging and smoke-test it:

   ```bash
   git fetch origin --tags
   upsun environment:resume -p <project-id> -e staging
   git push upsun vX.Y.Z^{commit}:refs/heads/staging
   upsun environment:deploy -p <project-id> -e staging
   ```

   Check the OAuth metadata at `/.well-known/oauth-authorization-server`,
   then connect an MCP client and call the tools the release changed.

3. Deploy the tag to production:

   ```bash
   git push upsun vX.Y.Z^{commit}:refs/heads/main
   ```

   Repeat the checks on `https://mcp.upsun.com/`.

4. Pause staging:

   ```bash
   upsun environment:pause -p <project-id> -e staging
   ```

Configuration comes from code defaults in `upsun-mcp/src/core/config.ts`, with
overrides in Upsun environment variables. Check those variables when a release
changes a setting.
