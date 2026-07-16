# Changelog

## v0.1.7 (2026-07-16)

- Add GitHub Actions workflow: auto-publish to npm on tag push
- Add CHANGELOG.md for release note management

## v0.1.6 (2026-07-16)

- Fix: add bin field back to package.json so npm install -g creates the rainhush command
- Include prebuilt Windows binary in npm package tarball

## v0.1.5 (2026-07-16)

- Add rainhush help command
- Add rainhush init [dir] command (scaffolds a new site with templates)
- Embed scaffold files (templates, static, config) into binary via go:embed
- Strip CI binary builds (GitHub auto-generates source archives)

## v0.1.3 (2026-07-16)

- Rename tool from rash to rainhush (npm package name conflict)
- Configure npm 2FA automation token

## v0.1.0 (2026-07-11)

- Initial release
- Markdown to static HTML with Goldmark
- Syntax highlighting via Chroma
- Mermaid diagram support
- Git and SFTP/SSH deployment modes
- File watching and live rebuild
- RSS feed and sitemap generation
- npm distribution support
