# Rainhush

Hypokinoko（阿菇）的个人博客 — 基于 Go 的静态站点生成器 / 雨静 Rainhush

## Quick Start

```bash
cp _config.example.yaml _config.yaml
go run . build
go run . test
go run . push
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `go run . build` | Build the site into `public/` |
| `go run . test` | Build, serve locally, and rebuild when files under `content/`, `templates/`, or `static/` change |
| `go run . push` | Build and deploy the generated site |
| `go run . clear` | Remove `public/` |

Notes:

- `test` does file watching and rebuilds, but it does **not** inject browser live reload.
- `build` now preserves `public/.git`, so Git-based deployments keep their remote configuration and history between builds.

## Configuration

Copy `_config.example.yaml` to `_config.yaml`:

```yaml
server:
  port: 8080

site:
  url: https://example.com
  description: Your site description for SEO
  favicon: https://example.com/favicon.jpg

home:
  title: Rainhush
  subtitle: Planned, Tracked, Delivered.
  avatar: https://example.com/avatar.jpg
  owner: Hypokinoko

deploy:
  mode: git
  remote: git@github.com:username/repo.git
  branch: main
```

Field notes:

- `home.title` is used as the site title in the header, footer, page `<title>`, and RSS feed.
- `deploy.remote` is required in `git` mode. It can be either:
  - a repository URL such as `git@github.com:username/repo.git`
  - an existing remote name already configured inside `public/.git`

## Deploy Modes

### Git mode

`deploy.mode: git` pushes the built `public/` directory to Git.

- If `deploy.remote` is a Git URL, Fake Mirror configures an internal `deploy` remote automatically.
- If `deploy.remote` is a remote name, that remote must already exist in `public/.git`.

### Server mode

`deploy.mode: server` uploads `public/` to a Linux server over SSH/SFTP and swaps releases atomically.

Supported server fields:

```yaml
deploy:
  mode: server
  server:
    host: example.com
    port: 22
    user: deploy
    path: /var/www/rainhush
    identity: C:/Users/you/.ssh/id_ed25519
    known_hosts: C:/Users/you/.ssh/known_hosts
    # Optional fallback when key auth is unavailable
    password: your-password
```

## Content Structure

```text
content/
├── posts/
├── about/
│   └── about.md
└── friends/
    └── friends.md
```

### Posts

Posts live in `content/posts/` and use YAML frontmatter plus Markdown content.

```markdown
---
title: My First Post
author: Your Name
date: 2026-07-01
updated_at: 2026-07-05
location: Shanghai
avatar: https://example.com/avatar.jpg
cover: https://example.com/cover.jpg
category: technology
---

Write your post content here.

<!-- more -->

More content here.
```

Supported fields:

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Post title |
| `date` | Yes | Publication date in `YYYY-MM-DD` format |
| `author` | No | Author name |
| `updated_at` | No | Updated date in `YYYY-MM-DD` format |
| `location` | No | Geographic location |
| `avatar` | No | Author avatar URL |
| `cover` | No | Cover image URL |
| `category` | No | `technology` or `life`; affects the homepage column |

Implementation details:

- `title` and `date` are validated at build time.
- Mermaid support is enabled only when a real fenced `mermaid` code block exists.
- `<!-- more -->` defines the excerpt boundary for homepage and feed summaries.

### About and Friends

`content/about/about.md` and `content/friends/friends.md` are rendered as plain Markdown pages with optional `title` frontmatter.

Current behavior:

- There is no special card schema for friends links.
- If `title` is omitted, the page falls back to `About` or `Friends`.

## Review-Driven Fixes In This Version

- Preserved `public/.git` during rebuilds so Git deploys remain stable.
- Fixed cache headers for pretty URLs like `/articles/post-slug/`, which were previously cached like static assets.
- Removed hardcoded site branding from templates and derived it from configuration.
- Replaced fragile Mermaid detection based on rendered text matching with fenced-block detection.
- Added basic tests for build output preservation and cache policy behavior.
- Removed dead front-end assets and cleaned unused styles/listeners.
