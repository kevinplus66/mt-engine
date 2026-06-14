# Contributing

Thanks for considering a contribution to MT-Engine. Before opening a PR, please make sure your local checks match CI.

## Prerequisites

- Python 3.12+
- Node 22

## Set up your environment

Copy `.env.example` to `.env` and fill in your local config; never commit `.env` or any real credentials.

## Backend

Install dependencies:

```bash
pip install -r requirements-dev.txt
```

OpenAPI drift check:

```bash
python scripts/export-openapi.py --check
```

Tests:

```bash
python -m pytest -q
```

## Frontend

The following commands can be run from the repository root; you can also `cd frontend/` and use the equivalent commands.

Install dependencies:

```bash
npm ci --prefix frontend --legacy-peer-deps
```

API type drift check:

```bash
npm run check:api-types --prefix frontend
```

Lint:

```bash
npm run lint --prefix frontend
```

Tests:

```bash
npm run test --prefix frontend
```

Build:

```bash
npm run build --prefix frontend
```

## Commit conventions

Commit messages follow the repository's existing prefix style: `feat: / fix: / refactor: / docs: / chore:`. Make sure CI is green before opening a PR.
