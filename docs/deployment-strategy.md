# Deployment Strategy

The frontend follows BidMart's staging-first progressive promotion strategy through Vercel.

## Environment Mapping

| Branch | Environment | Platform |
| --- | --- | --- |
| `staging` and pull requests | Preview/Staging | Vercel preview deployment |
| `main` | Production | Vercel production deployment |

## Gate

Vercel should require GitHub checks before production promotion. The repository CI runs lint, unit tests, build, and scheduled/manual Playwright E2E against the deployed stack.

## Promotion Flow

1. Merge frontend changes into `staging` or open a pull request.
2. CI validates lint, tests, and build.
3. Vercel creates a preview/staging deployment.
4. Validate UI flow against the staging gateway.
5. Promote the same change to `main`.
6. Vercel deploys production after required checks pass.

## Rollback

Rollback uses Vercel's instant rollback to a previous deployment for urgent incidents, or a Git revert on `main` followed by a normal CI-gated production deployment.
