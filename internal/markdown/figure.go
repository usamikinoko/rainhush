package markdown

import (
	"strings"

	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/renderer"
	goldmarkhtml "github.com/yuin/goldmark/renderer/html"
	"github.com/yuin/goldmark/util"
)

type paragraphRenderer struct{}

func (r *paragraphRenderer) RegisterFuncs(reg renderer.NodeRendererFuncRegisterer) {
	reg.Register(ast.KindParagraph, r.renderParagraph)
}

// renderParagraph 覆盖 goldmark 默认段落渲染：当段落唯一内容是一张图片
// 时，输出 <rain-figure> 而不是 <p>——前端把这类「独段图」升级为可折叠
// 图版（题栏 FIG 01 · alt · ＋/－，grid-rows 折叠动画）。其余段落保持
// goldmark 默认行为（含 attributes 分支，虽然本项目未启用）。
func (r *paragraphRenderer) renderParagraph(w util.BufWriter, source []byte, node ast.Node, entering bool) (ast.WalkStatus, error) {
	n := node.(*ast.Paragraph)
	figure := isFoldableFigure(n)
	if entering {
		if figure {
			w.WriteString(`<rain-figure>`)
		} else if n.Attributes() != nil {
			w.WriteString("<p")
			goldmarkhtml.RenderAttributes(w, n, paragraphAttributeFilter)
			w.WriteString(">")
		} else {
			w.WriteString("<p>")
		}
		return ast.WalkContinue, nil
	}
	if figure {
		w.WriteString("</rain-figure>\n")
	} else {
		w.WriteString("</p>\n")
	}
	return ast.WalkContinue, nil
}

// paragraphAttributeFilter 与 goldmark html 渲染器的默认过滤器一致；
// 本项目未开启 WithAttribute，此分支仅为行为对齐兜底。
var paragraphAttributeFilter = goldmarkhtml.GlobalAttributeFilter

func isFoldableFigure(n *ast.Paragraph) bool {
	child := n.FirstChild()
	if child == nil || child.NextSibling() != nil {
		return false
	}
	img, ok := child.(*ast.Image)
	if !ok {
		return false
	}
	// 徽章类小图（shields.io / 任意 badge 服务）是行内装饰，不折叠。
	dest := strings.ToLower(string(img.Destination))
	return !strings.Contains(dest, "shields.io") && !strings.Contains(dest, "badge")
}
