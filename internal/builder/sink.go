package builder

import (
	"fmt"
	"html/template"
	"path/filepath"
	"strings"
	"time"

	"rainhush/internal/config"
	"rainhush/internal/icons"
)

// The kitchen sink (dev/components.html) renders every component in
// templates/components/ with sample data, so style drift and broken
// contracts show up on one page instead of scattered across the site.
// It is not indexed, listed in the sitemap, or in the feed.

func (ctx *buildContext) renderKitchenSink() error {
	tmpl, err := ctx.cloneTmpl()
	if err != nil {
		return err
	}
	if _, err := tmpl.ParseFiles("templates/pages/components.html"); err != nil {
		return err
	}

	posts := samplePosts()
	cells, dayLabels, months, total := computeHeatmap(posts)
	sample := posts[0]

	demo, err := renderMarkdown(sampleCodeMarkdown)
	if err != nil {
		return fmt.Errorf("render sink code demo: %w", err)
	}

	figureDemo, err := renderMarkdown(sampleFigureMarkdown)
	if err != nil {
		return fmt.Errorf("render sink figure demo: %w", err)
	}

	pageItems := []pageItem{
		{Number: 1, URL: "#"},
		{Number: 2, URL: "#", Current: true},
		{Number: 3, URL: "#"},
	}

	data := map[string]interface{}{
		"Title":            "Components",
		"NoIndex":          true,
		"Nav":              navState(""),
		"CanonicalURL":     strings.TrimRight(config.Cfg.Site.URL, "/") + "/dev/components.html",
		"SamplePost":       sample,
		"Posts":            posts,
		"Friends":          sampleFriends(),
		"PageItems":        pageItems,
		"HasPrev":          true,
		"PrevURL":          "#",
		"HasNext":          true,
		"NextURL":          "#",
		"HeatmapCells":     cells,
		"HeatmapDayLabels": dayLabels,
		"HeatmapMonths":    months,
		"HeatmapTotal":     total,
		"SinkArticles":     42,
		"SinkWords":        "128K",
		"CodeDemo":         template.HTML(demo.html),
		"FigureDemo":       template.HTML(figureDemo.html),
		// c/post-meta reads the page data directly, same as a post page.
		"Author":         sample.Author,
		"Date":           sample.Date,
		"UpdatedAt":      sample.UpdatedAt,
		"Location":       sample.Location,
		"WordCount":      sample.WordCount,
		"ReadingMinutes": sample.ReadingMinutes,
		// The icon set: every embedded Lucide glyph, one per row, so
		// new or missing marks are reviewed here like everything else.
		"IconNames": icons.Names(),
	}

	return ctx.writeHTML(tmpl, filepath.Join("public", "dev", "components.html"), ctx.pageData(data))
}

// samplePosts fabricates a few posts spread over the past year so the
// heatmap, lists and meta strips have believable data.
func samplePosts() []*Post {
	dates := []int{2, 9, 26, 47, 74, 103, 131, 160, 188, 224, 253, 300, 340}
	titles := []string{
		"Sample post — rain on the drafting sheet",
		"Sample post — wire frames and hairlines",
		"Sample post — the component ledger",
		"Sample post — tokens in both themes",
		"Sample post — a margin note",
		"Sample post — hatching as texture",
		"Sample post — the figcap voice",
		"Sample post — grids, real gutters",
		"Sample post — the mono overline",
		"Sample post — cursive as the soft hand",
		"Sample post — sticky rails",
		"Sample post — the heat ledger",
		"Sample post — an old entry",
	}
	posts := make([]*Post, 0, len(dates))
	for i, daysAgo := range dates {
		day := time.Now().AddDate(0, 0, -daysAgo)
		date := day.Format("2006-01-02")
		published, _ := parseISODate(date)
		posts = append(posts, &Post{
			Frontmatter: Frontmatter{
				Title:     titles[i%len(titles)],
				Author:    "Hypokinoko",
				Date:      date,
				UpdatedAt: date,
				Location:  "Sample",
				Category:  "tech",
			},
			Filename:       "sample-post-" + date,
			Excerpt:        "A fabricated entry that only exists on the kitchen sink page, so components have something to render.",
			PublishedAt:    published,
			WordCount:      1024 + i*128,
			ReadingMinutes: 1 + i%5,
		})
	}
	return posts
}

func sampleFriends() []friendLink {
	return []friendLink{
		{Nick: "Example", URL: "https://example.com", Host: "example.com"},
		{Nick: "Placeholder", URL: "https://example.org", Host: "example.org"},
		{Nick: "Sample", URL: "https://example.net", Host: "example.net"},
	}
}

const sampleCodeMarkdown = "```go\npackage main\n\n// The code-block component, rendered through the ordinary markdown\n// pipeline: Chroma highlight on the left, rain-code-copy on the right.\nfunc main() {\n\tprintln(\"hello, rainhush\")\n}\n```\n"

// A lone-image paragraph — the Go paragraph renderer wraps it in
// <rain-figure>, which the front-end upgrades to the folding plate.
const sampleFigureMarkdown = "![Demo plate — the foldable figure](/static/imgs/figure-demo.svg)\n"
