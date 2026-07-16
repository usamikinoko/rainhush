# Rash

Rash is a fast, lightweight static site generator built with Go. It transforms Markdown content into a fully-rendered static site with syntax highlighting, Mermaid diagram support, and built-in deployment tooling.

### Language

[English](./README.md) | [中文](./README_CN.md)

## Quick Start

#### Install

```bash
# npm (recommended)
npm install -g rash

# or: build from source
go install github.com/usamikinoko/rainhush@latest
```

#### Create a site

```bash
cp _config.example.yaml _config.yaml
rash build   # Build the site into public/
rash test    # Build, serve locally, and rebuild on file changes
rash push    # Build and deploy
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `rash build` | Build the site into `public/` |
| `rash test` | Build, serve locally, and rebuild when files under `content/`, `templates/`, or `static/` change |
| `rash push` | Build and deploy the generated site |
| `rash clear` | Remove `public/` |
| `rash --version` | Print version |

Notes:

- `Test` does file watching and rebuilds, but it does **not** inject browser live reload.
- `Build` preserves `public/.git`, so Git-based deployments keep their remote configuration and history between builds.

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
  title: Rash
  subtitle: My Blog
  avatar: https://example.com/avatar.jpg
  owner: Rash User

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

#### Git mode

`deploy.mode: git` pushes the built `public/` directory to Git.

- If `deploy.remote` is a Git URL, Rash configures an internal `deploy` remote automatically.
- If `deploy.remote` is a remote name, that remote must already exist in `public/.git`.

#### Server mode

`deploy.mode: server` uploads `public/` to a Linux server over SSH/SFTP and swaps releases atomically.

Supported server fields:

```yaml
deploy:
  mode: server
  server:
    host: example.com
    port: 22
    user: deploy
    path: /var/www/rash
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

#### Posts

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
|-------|--------|------------|
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