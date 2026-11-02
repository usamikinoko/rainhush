package markdown

import (
	"bytes"
	"strings"
	"testing"

	"github.com/yuin/goldmark"
)

func renderFigure(t *testing.T, source string) string {
	t.Helper()
	md := goldmark.New(goldmark.WithExtensions(Ext))
	var buf bytes.Buffer
	if err := md.Convert([]byte(source), &buf); err != nil {
		t.Fatalf("render markdown: %v", err)
	}
	return buf.String()
}

func TestLoneImageIsWrappedInRainFigure(t *testing.T) {
	html := renderFigure(t, "前文\n\n![架构图](https://example.com/arch.png)\n\n后文\n")
	if !strings.Contains(html, `<rain-figure><img src="https://example.com/arch.png"`) {
		t.Fatalf("expected lone image wrapped in <rain-figure>, got %q", html)
	}
	if !strings.Contains(html, "</rain-figure>") {
		t.Fatalf("expected closing </rain-figure>, got %q", html)
	}
	// 图片渲染器属性必须原样保留
	for _, want := range []string{`alt="架构图"`, `loading="lazy"`, `decoding="async"`} {
		if !strings.Contains(html, want) {
			t.Fatalf("expected %s preserved, got %q", want, html)
		}
	}
}

func TestBadgeImagesStayPlainParagraphs(t *testing.T) {
	html := renderFigure(t, "![Static Badge](https://img.shields.io/badge/x-green)\n")
	if strings.Contains(html, "<rain-figure>") {
		t.Fatalf("badge image must not be wrapped, got %q", html)
	}
	if !strings.Contains(html, "<p><img") {
		t.Fatalf("badge image should stay a plain <p>, got %q", html)
	}
}

func TestMultipleImagesParagraphNotWrapped(t *testing.T) {
	html := renderFigure(t, "![a](https://example.com/a.png)\n![b](https://example.com/b.png)\n")
	if strings.Contains(html, "<rain-figure>") {
		t.Fatalf("multi-image paragraph must not be wrapped, got %q", html)
	}
}

func TestTextAndImageParagraphNotWrapped(t *testing.T) {
	html := renderFigure(t, "看这张图 ![a](https://example.com/a.png)\n")
	if strings.Contains(html, "<rain-figure>") {
		t.Fatalf("mixed paragraph must not be wrapped, got %q", html)
	}
}

func TestPlainParagraphUnchanged(t *testing.T) {
	html := renderFigure(t, "普通段落\n")
	if !strings.Contains(html, "<p>普通段落</p>") {
		t.Fatalf("plain paragraph output changed, got %q", html)
	}
}
