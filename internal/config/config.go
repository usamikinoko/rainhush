package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type SiteConfig struct {
	URL         string `yaml:"url"`
	Description string `yaml:"description"`
	Favicon     string `yaml:"favicon"`
}

type ServerConfig struct {
	Port int `yaml:"port"`
}

type HomeConfig struct {
	Title    string `yaml:"title"`
	SubTitle string `yaml:"subtitle"`
	Avatar   string `yaml:"avatar"`
	Owner    string `yaml:"owner"`
}

type DeployServerConfig struct {
	Host       string `yaml:"host"`
	User       string `yaml:"user"`
	Password   string `yaml:"password"`
	Port       int    `yaml:"port"`
	Path       string `yaml:"path"`
	Identity   string `yaml:"identity"`
	KnownHosts string `yaml:"known_hosts"`
}

type DeployConfig struct {
	Mode   string             `yaml:"mode"`
	Remote string             `yaml:"remote"`
	Branch string             `yaml:"branch"`
	Server DeployServerConfig `yaml:"server"`
}

type Config struct {
	Server ServerConfig `yaml:"server"`
	Site   SiteConfig   `yaml:"site"`
	Home   HomeConfig   `yaml:"home"`
	Deploy DeployConfig `yaml:"deploy"`
}

var Cfg *Config

func Load() error {
	data, err := os.ReadFile("_config.yaml")
	if err != nil {
		return err
	}

	Cfg = &Config{}
	if err := yaml.Unmarshal(data, Cfg); err != nil {
		return err
	}

	if Cfg.Server.Port == 0 {
		Cfg.Server.Port = 8080
	}
	if Cfg.Deploy.Mode == "" {
		Cfg.Deploy.Mode = "git"
	}
	if Cfg.Deploy.Branch == "" {
		Cfg.Deploy.Branch = "main"
	}
	if Cfg.Deploy.Server.Port == 0 {
		Cfg.Deploy.Server.Port = 22
	}
	if Cfg.Deploy.Server.Path == "" {
	Cfg.Deploy.Server.Path = "/var/www/rash"
	}

	return nil
}
