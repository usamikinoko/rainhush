package server

import "testing"

func TestCacheControlForPath(t *testing.T) {
	tests := []struct {
		name string
		path string
		want string
	}{
		{
			name: "pretty article routes are revalidated",
			path: "/articles/example-post/",
			want: "public, max-age=0, must-revalidate",
		},
		{
			name: "hashed bundles are immutable",
			path: "/static/bundle.1234abcd.css",
			want: "public, max-age=31536000, immutable",
		},
		{
			name: "other static assets use shorter cache",
			path: "/images/avatar.png",
			want: "public, max-age=2592000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cacheControlForPath(tt.path); got != tt.want {
				t.Fatalf("cacheControlForPath(%q) = %q, want %q", tt.path, got, tt.want)
			}
		})
	}
}
