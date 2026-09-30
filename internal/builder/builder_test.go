package builder

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPrepareOutputDirPreservesGitDirectory(t *testing.T) {
	root := filepath.Join(t.TempDir(), "public")
	gitDir := filepath.Join(root, ".git")

	if err := os.MkdirAll(gitDir, 0755); err != nil {
		t.Fatalf("create git dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(gitDir, "config"), []byte("gitdir"), 0644); err != nil {
		t.Fatalf("write git config: %v", err)
	}
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("stale"), 0644); err != nil {
		t.Fatalf("write stale artifact: %v", err)
	}

	if err := prepareOutputDir(root); err != nil {
		t.Fatalf("prepare output dir: %v", err)
	}

	if _, err := os.Stat(filepath.Join(root, ".git", "config")); err != nil {
		t.Fatalf("expected preserved git metadata: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "index.html")); !os.IsNotExist(err) {
		t.Fatalf("expected stale build artifact to be removed, got err=%v", err)
	}
}

func TestParseFriendLinks(t *testing.T) {
	body := strings.Join([]string{
		"欢迎交换友链：",
		"",
		"- ek1ng: [https://ek1ng.com/](https://ek1ng.com/)",
		"- ch405：[主页](https://sd0ric4.github.io/)",
		"- 没有链接的条目",
		"- bad: [x](javascript:alert(1))",
	}, "\n")

	links, rest := parseFriendLinks(body)

	if len(links) != 2 {
		t.Fatalf("expected 2 links, got %d (%+v)", len(links), links)
	}
	if links[0].Nick != "ek1ng" || links[0].URL != "https://ek1ng.com/" || links[0].Host != "ek1ng.com" {
		t.Fatalf("unexpected first link: %+v", links[0])
	}
	if links[1].Nick != "ch405" || links[1].Host != "sd0ric4.github.io" {
		t.Fatalf("unexpected second link: %+v", links[1])
	}
	if !strings.Contains(rest, "欢迎交换友链") || strings.Contains(rest, "ek1ng") {
		t.Fatalf("expected only the non-link lines to survive, got %q", rest)
	}
	if !strings.Contains(rest, "javascript") {
		t.Fatalf("expected the unsafe link to be left as markdown, got %q", rest)
	}
}

func TestParseFriendLinksWithoutBullets(t *testing.T) {
	links, rest := parseFriendLinks("这里只有一段说明文字。")
	if links != nil {
		t.Fatalf("expected no links, got %+v", links)
	}
	if !strings.Contains(rest, "说明文字") {
		t.Fatalf("expected the body to be kept as-is, got %q", rest)
	}
}

func TestRenderMarkdownPreservesTrustedHTML(t *testing.T) {
	rendered, err := renderMarkdown("<table><tr><td>ok</td></tr></table>")
	if err != nil {
		t.Fatalf("render markdown: %v", err)
	}
	if !strings.Contains(rendered.html, "<table>") || !strings.Contains(rendered.html, "<td>ok</td>") {
		t.Fatalf("expected raw HTML in output, got %q", rendered.html)
	}
}

func TestRenderMarkdownPageMissingFileFallsBackToEmptyPage(t *testing.T) {
	fm, rendered, err := renderMarkdownPage(filepath.Join(t.TempDir(), "missing.md"), "About")
	if err != nil {
		t.Fatalf("renderMarkdownPage returned error: %v", err)
	}
	if fm.Title != "About" {
		t.Fatalf("expected fallback title, got %q", fm.Title)
	}
	if rendered.html != "" {
		t.Fatalf("expected empty rendered content, got %q", rendered.html)
	}
}
