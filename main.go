package main

import (
	"context"
	"fmt"
	"os"

	"rash/internal/builder"
	"rash/internal/config"
	"rash/internal/pusher"
	"rash/internal/server"
	"rash/internal/watcher"
)

var (
	version = "dev"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	if os.Args[1] == "--version" || os.Args[1] == "-v" {
		fmt.Printf("rash version %s\n", version)
		return
	}
	if os.Args[1] == "--help" || os.Args[1] == "-h" {
		printUsage()
		return
	}

	if err := config.Load(); err != nil {
		fmt.Fprintf(os.Stderr, "Config error: %v\n", err)
		os.Exit(1)
	}

	switch os.Args[1] {
	case "build":
		if err := builder.Build(); err != nil {
			fmt.Fprintf(os.Stderr, "Build failed: %v\n", err)
			os.Exit(1)
		}
	case "test":
		if err := builder.Build(); err != nil {
			fmt.Fprintf(os.Stderr, "Build failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Watching for changes in content/, templates/, static/...")

		stopWatcher, err := watcher.Watch(func(name string) {
			fmt.Printf("Change detected: %s\n", name)
			if err := builder.Build(); err != nil {
				fmt.Fprintf(os.Stderr, "Rebuild failed: %v\n", err)
			} else {
				fmt.Println("Site rebuilt successfully")
			}
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Watcher failed: %v\n", err)
			os.Exit(1)
		}
		defer stopWatcher()

		if err := server.Serve(context.Background()); err != nil {
			fmt.Fprintf(os.Stderr, "Serve failed: %v\n", err)
			os.Exit(1)
		}
	case "push":
		if err := builder.Build(); err != nil {
			fmt.Fprintf(os.Stderr, "Build failed: %v\n", err)
			os.Exit(1)
		}
		if err := pusher.Push(); err != nil {
			fmt.Fprintf(os.Stderr, "Push failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Push completed.")
	case "clear":
		if err := os.RemoveAll("public"); err != nil {
			fmt.Fprintf(os.Stderr, "Clear failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("public/ directory removed.")
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Rash - Static Site Generator")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  rash build     Build the site from markdown files")
	fmt.Println("  rash test      Build, serve locally, and rebuild on file changes")
	fmt.Println("  rash push      Build and push to remote repository")
	fmt.Println("  rash clear     Remove the public/ build directory")
	fmt.Println()
	fmt.Println("Flags:")
	fmt.Println("  -v, --version  Print version")
	fmt.Println("  -h, --help     Print help")
}