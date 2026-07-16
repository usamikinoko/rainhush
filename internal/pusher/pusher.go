package pusher

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	pathpkg "path"
	"path/filepath"
	"strings"
	"time"

	"rash/internal/config"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

func Push() error {
	cfg := config.Cfg.Deploy

	if cfg.Mode == "server" {
		return pushToServer(cfg)
	}
	return pushToGit(cfg)
}

func pushToGit(cfg config.DeployConfig) error {
	if strings.TrimSpace(cfg.Remote) == "" {
		return errors.New("git deploy requires deploy.remote to be configured with a remote name or repository URL")
	}

	gitDir := "public/.git"
	if _, err := os.Stat(gitDir); os.IsNotExist(err) {
		cmd := exec.Command("git", "init")
		cmd.Dir = "public"
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("git init failed: %w", err)
		}

		cmd = exec.Command("git", "branch", "-m", cfg.Branch)
		cmd.Dir = "public"
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		_ = cmd.Run()

		fmt.Println("Initialized git repository in public/")
	}

	remoteName, err := ensureGitRemoteConfigured(cfg.Remote)
	if err != nil {
		return err
	}

	cmd := exec.Command("git", "add", "-A")
	cmd.Dir = "public"
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git add failed: %w", err)
	}

	statusCmd := exec.Command("git", "status", "--porcelain")
	statusCmd.Dir = "public"
	status, err := statusCmd.Output()
	if err != nil {
		return fmt.Errorf("git status failed: %w", err)
	}
	if len(bytes.TrimSpace(status)) == 0 {
		fmt.Println("No changes to publish.")
		return nil
	}

	cmd = exec.Command("git", "commit", "-m", "Site update")
	cmd.Dir = "public"
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git commit failed: %w", err)
	}

	cmd = exec.Command("git", "push", "-f", remoteName, cfg.Branch)
	cmd.Dir = "public"
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("git push %s %s failed: %w", remoteName, cfg.Branch, err)
	}

	fmt.Println("Git push completed.")
	return nil
}

func ensureGitRemoteConfigured(remote string) (string, error) {
	if looksLikeGitTarget(remote) {
		const remoteName = "deploy"
		getURL := exec.Command("git", "remote", "get-url", remoteName)
		getURL.Dir = "public"
		if err := getURL.Run(); err != nil {
			cmd := exec.Command("git", "remote", "add", remoteName, remote)
			cmd.Dir = "public"
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				return "", fmt.Errorf("git remote add %s failed: %w", remoteName, err)
			}
		} else {
			cmd := exec.Command("git", "remote", "set-url", remoteName, remote)
			cmd.Dir = "public"
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				return "", fmt.Errorf("git remote set-url %s failed: %w", remoteName, err)
			}
		}
		return remoteName, nil
	}

	cmd := exec.Command("git", "remote", "get-url", remote)
	cmd.Dir = "public"
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git remote %q is not configured in public/.git; set deploy.remote to a repository URL or configure that remote locally", remote)
	}
	return remote, nil
}

func looksLikeGitTarget(remote string) bool {
	return strings.Contains(remote, "://") ||
		strings.HasPrefix(remote, "git@") ||
		strings.HasSuffix(remote, ".git") ||
		(strings.Contains(remote, ":") && strings.Contains(remote, "/"))
}

func pushToServer(cfg config.DeployConfig) error {
	addr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)

	sshConfig, err := buildSSHConfig(cfg.Server)
	if err != nil {
		return err
	}

	fmt.Printf("Connecting to %s@%s ...\n", cfg.Server.User, addr)
	client, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return fmt.Errorf("ssh dial failed: %w", err)
	}
	defer client.Close()

	sftpClient, err := sftp.NewClient(client)
	if err != nil {
		return fmt.Errorf("sftp failed: %w", err)
	}
	defer sftpClient.Close()

	fmt.Printf("Uploading to %s:%s ...\n", cfg.Server.Host, cfg.Server.Path)

	count, err := deployDirectory(sftpClient, "public", cfg.Server.Path)
	if err != nil {
		return fmt.Errorf("upload failed: %w", err)
	}

	fmt.Printf("Server deployment completed (%d files uploaded).\n", count)
	return nil
}

func buildSSHConfig(cfg config.DeployServerConfig) (*ssh.ClientConfig, error) {
	authMethods, err := buildAuthMethods(cfg)
	if err != nil {
		return nil, err
	}

	knownHostsPath, err := resolveKnownHostsPath(cfg.KnownHosts)
	if err != nil {
		return nil, err
	}

	hostKeyCallback, err := knownhosts.New(knownHostsPath)
	if err != nil {
		return nil, fmt.Errorf("load known_hosts %s: %w", knownHostsPath, err)
	}

	return &ssh.ClientConfig{
		User:            cfg.User,
		Auth:            authMethods,
		HostKeyCallback: hostKeyCallback,
		Timeout:         15 * time.Second,
	}, nil
}

func buildAuthMethods(cfg config.DeployServerConfig) ([]ssh.AuthMethod, error) {
	var methods []ssh.AuthMethod
	if cfg.Password != "" {
		methods = append(methods, ssh.Password(cfg.Password))
	}

	keyPaths, err := resolveIdentityPaths(cfg.Identity)
	if err != nil {
		return nil, err
	}

	for _, keyPath := range keyPaths {
		signer, err := loadPrivateKey(keyPath)
		if err != nil {
			if cfg.Identity != "" {
				return nil, err
			}
			continue
		}
		methods = append(methods, ssh.PublicKeys(signer))
	}

	if len(methods) == 0 {
		return nil, errors.New("server deploy requires password or a readable SSH identity")
	}

	return methods, nil
}

func resolveIdentityPaths(identityPath string) ([]string, error) {
	if identityPath != "" {
		return []string{identityPath}, nil
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("resolve user home: %w", err)
	}

	candidates := []string{
		filepath.Join(homeDir, ".ssh", "id_ed25519"),
		filepath.Join(homeDir, ".ssh", "id_rsa"),
		filepath.Join(homeDir, ".ssh", "id_ecdsa"),
	}

	var paths []string
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			paths = append(paths, candidate)
		}
	}
	return paths, nil
}

func loadPrivateKey(identityPath string) (ssh.Signer, error) {
	keyData, err := os.ReadFile(identityPath)
	if err != nil {
		return nil, fmt.Errorf("read identity %s: %w", identityPath, err)
	}

	signer, err := ssh.ParsePrivateKey(keyData)
	if err != nil {
		return nil, fmt.Errorf("parse identity %s: %w", identityPath, err)
	}
	return signer, nil
}

func resolveKnownHostsPath(configuredPath string) (string, error) {
	if configuredPath != "" {
		return configuredPath, nil
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve user home: %w", err)
	}

	return filepath.Join(homeDir, ".ssh", "known_hosts"), nil
}

func deployDirectory(client *sftp.Client, localRoot, remoteRoot string) (int, error) {
	remoteRoot = pathpkg.Clean(remoteRoot)
	if remoteRoot == "." || remoteRoot == "/" || !pathpkg.IsAbs(remoteRoot) {
		return 0, fmt.Errorf("refusing to deploy to unsafe path %q", remoteRoot)
	}

	parentDir := pathpkg.Dir(remoteRoot)
	baseName := pathpkg.Base(remoteRoot)
	timestamp := time.Now().Unix()
	tempRoot := pathpkg.Join(parentDir, fmt.Sprintf(".%s.tmp.%d", baseName, timestamp))
	backupRoot := pathpkg.Join(parentDir, fmt.Sprintf(".%s.bak.%d", baseName, timestamp))

	if err := client.MkdirAll(parentDir); err != nil {
		return 0, fmt.Errorf("create remote parent %s: %w", parentDir, err)
	}
	if err := removeRemoteTree(client, tempRoot); err != nil {
		return 0, err
	}
	if err := removeRemoteTree(client, backupRoot); err != nil {
		return 0, err
	}
	if err := client.MkdirAll(tempRoot); err != nil {
		return 0, fmt.Errorf("create temp directory %s: %w", tempRoot, err)
	}

	count := 0
	err := filepath.WalkDir(localRoot, func(localPath string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(localRoot, localPath)
		if err != nil {
			return err
		}
		if relPath == "." {
			return nil
		}

		relPath = filepath.ToSlash(relPath)
		if strings.HasPrefix(relPath, ".git") {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		remotePath := pathpkg.Join(tempRoot, relPath)
		if d.IsDir() {
			return client.MkdirAll(remotePath)
		}

		info, err := d.Info()
		if err != nil {
			return err
		}

		localFile, err := os.Open(localPath)
		if err != nil {
			return err
		}

		remoteFile, err := client.Create(remotePath)
		if err != nil {
			localFile.Close()
			return fmt.Errorf("create %s: %w", remotePath, err)
		}

		if _, err := io.Copy(remoteFile, localFile); err != nil {
			remoteFile.Close()
			localFile.Close()
			return fmt.Errorf("upload %s: %w", remotePath, err)
		}
		if err := remoteFile.Close(); err != nil {
			localFile.Close()
			return fmt.Errorf("close remote file %s: %w", remotePath, err)
		}
		if err := localFile.Close(); err != nil {
			return fmt.Errorf("close local file %s: %w", localPath, err)
		}
		if err := client.Chmod(remotePath, info.Mode()); err != nil {
			return fmt.Errorf("chmod %s: %w", remotePath, err)
		}

		count++
		return nil
	})
	if err != nil {
		_ = removeRemoteTree(client, tempRoot)
		return 0, err
	}

	exists, err := remoteExists(client, remoteRoot)
	if err != nil {
		_ = removeRemoteTree(client, tempRoot)
		return 0, err
	}

	if exists {
		if err := client.Rename(remoteRoot, backupRoot); err != nil {
			_ = removeRemoteTree(client, tempRoot)
			return 0, fmt.Errorf("move current release to backup: %w", err)
		}
	}

	if err := client.Rename(tempRoot, remoteRoot); err != nil {
		if exists {
			_ = client.Rename(backupRoot, remoteRoot)
		}
		_ = removeRemoteTree(client, tempRoot)
		return 0, fmt.Errorf("activate new release: %w", err)
	}

	if exists {
		if err := removeRemoteTree(client, backupRoot); err != nil {
			return 0, fmt.Errorf("cleanup backup release: %w", err)
		}
	}

	return count, nil
}

func remoteExists(client *sftp.Client, remotePath string) (bool, error) {
	_, err := client.Stat(remotePath)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, os.ErrNotExist) || errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	return false, fmt.Errorf("stat %s: %w", remotePath, err)
}

func removeRemoteTree(client *sftp.Client, remotePath string) error {
	info, err := client.Stat(remotePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) || errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("stat %s: %w", remotePath, err)
	}

	if !info.IsDir() {
		if err := client.Remove(remotePath); err != nil {
			return fmt.Errorf("remove %s: %w", remotePath, err)
		}
		return nil
	}

	entries, err := client.ReadDir(remotePath)
	if err != nil {
		return fmt.Errorf("read remote dir %s: %w", remotePath, err)
	}
	for _, entry := range entries {
		childPath := pathpkg.Join(remotePath, entry.Name())
		if err := removeRemoteTree(client, childPath); err != nil {
			return err
		}
	}

	if err := client.RemoveDirectory(remotePath); err != nil {
		return fmt.Errorf("remove directory %s: %w", remotePath, err)
	}
	return nil
}
