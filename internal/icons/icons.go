// Package icons is the single icon source for the site: a small,
// curated set of Lucide glyphs (24x24 stroke icons, ISC licensed)
// embedded at build time and served through one template function.
//
// Every icon ships as the untouched lucide-static SVG file under
// assets/icons/. At init the outer <svg> wrapper is stripped and only
// the inner shapes are kept, so the wrapper — and therefore the
// sizing — is owned by exactly one place: the template function below
// and the .icon rule in the stylesheet (width/height: 1em, so an icon
// always matches the font-size of the text it sits beside).
package icons

import (
	"embed"
	"fmt"
	"html/template"
	"strings"
)

//go:embed assets/icons/*.svg
var files embed.FS

// shapes maps an icon name (the lucide-static file name, without the
// extension) to the inner SVG markup.
var shapes = map[string]string{}

func init() {
	entries, err := files.ReadDir("assets/icons")
	if err != nil {
		panic(fmt.Sprintf("icons: read embedded dir: %v", err))
	}
	for _, e := range entries {
		name := strings.TrimSuffix(e.Name(), ".svg")
		raw, err := files.ReadFile("assets/icons/" + e.Name())
		if err != nil {
			panic(fmt.Sprintf("icons: read %s: %v", e.Name(), err))
		}
		inner, err := stripSVGWrapper(string(raw))
		if err != nil {
			panic(fmt.Sprintf("icons: %s: %v", name, err))
		}
		shapes[name] = inner
	}
}

// stripSVGWrapper removes the license comment and the outer <svg>
// element, returning only the inner shape markup.
func stripSVGWrapper(raw string) (string, error) {
	s := raw
	start := strings.Index(s, "<svg")
	if start < 0 {
		return "", fmt.Errorf("no <svg> element found")
	}
	// End of the opening tag, then the closing </svg>: keep only
	// what is drawn between them.
	open := strings.Index(s[start:], ">")
	close := strings.LastIndex(s, "</svg>")
	if open < 0 || close < start+open {
		return "", fmt.Errorf("malformed <svg> element")
	}
	inner := strings.TrimSpace(s[start+open+1 : close])
	if !strings.Contains(inner, "<") {
		return "", fmt.Errorf("no inner shapes found")
	}
	return inner, nil
}

// Names returns the available icon names in sorted order.
func Names() []string {
	out := make([]string, 0, len(shapes))
	for name := range shapes {
		out = append(out, name)
	}
	// Small set; insertion sort keeps this dependency-free.
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j] < out[j-1]; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

// Has reports whether an icon with the given name exists.
func Has(name string) bool { _, ok := shapes[name]; return ok }

// Func returns the template function. Usage:
//
//	{{icon "cpu"}}                     — bare icon, class "icon"
//	{{icon "sun" "icon-sun"}}          — extra classes appended
func Func() func(string, ...string) (template.HTML, error) {
	return func(name string, class ...string) (template.HTML, error) {
		shape, ok := shapes[name]
		if !ok {
			return "", fmt.Errorf("icon %q not found (see internal/icons/assets/icons)", name)
		}
		cls := "icon"
		for _, c := range class {
			if c != "" {
				cls += " " + c
			}
		}
		return template.HTML(fmt.Sprintf(
			`<svg class="%s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>`,
			cls, shape,
		)), nil
	}
}
