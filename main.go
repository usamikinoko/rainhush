package main

import (
	"context"
	"fmt"
	"os"

	"rainhush/internal/builder"
	"rainhush/internal/config"
	"rainhush/internal/pusher"
	"rainhush/internal/server"
	"rainhush/internal/watcher"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
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
	fmt.Println("Rainhush - Static Site Generator")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  go run . build    Build the site from markdown files")
	fmt.Println("  go run . test     Build, serve locally, and rebuild on file changes")
	fmt.Println("  go run . push     Build and push to remote repository")
	fmt.Println("  go run . clear    Remove the public/ build directory")
}
