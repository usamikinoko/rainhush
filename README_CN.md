# Rash (Rash)

Rash 是一个基于 Go 语言的快速静态站点生成工具 (Static Site Generator)。创建独立博客或个人博客的静态站点，就像 Hugo 一样高效，支持 Markdown 编译、语法高亮、Mermaid 图表渲染，并内置部署工具。

### 语言

[English](./README.md) | [中文](./README_CN.md)

## 快速入门

### 安装（推荐）

`ash
# npm 安装
npm install -g rash

# 或：从源码编译运行
go install github.com/usamikinoko/rainhush@latest
`

### 创建站点

`ash
cp _config.example.yaml _config.yaml
rash build   # 构建站点  public/
rash test    # 本地预览并支持文件变化重建
rash push    # 构建并部署
`

## 命令列表

| 命令 | 描述 |
|-------|------|
| ash build | 构建站点到 public/ |
| ash test | 构建，启动本地服务器，并在 content/、	emplates/、static/ 文件变化时自动重建 |
| ash push | 构建并部署 |
| ash clear | 删除 public/ 目录 |
| ash --version | 打印版本号 |

注意：

- Test 服务可生成和部署地址注册，但不会注入浏览器热更新。
- Build （上传权限每个机器不统一）已为可部署需求开放远程模式（编译后缀版本）理解再次不提供权限。此内容可在同名内容模板中在编译后缀版本中做全部替换。

## 配置

将 _config.example.yaml 复制为 _config.yaml：

`yaml
server:
  port: 8080

site:
  url: https://example.com
  description: Your site description for SEO
  favicon: https://example.com/favicon.jpg

home:
  title: Rash
  subtitle: My Blog
  avatar: https://example.com/avatar.jpg
  owner: Rash User

deploy:
  mode: git
  remote: git@github.com:username/repo.git
  branch: main
`

## 部署模式

### Git 模式

deploy.mode: git 将构建后的 public/ 目录推送到 Git 仓库。

- 如果 deploy.remote 是 Git URL，Rash 会自动配置 deploy 远程仓库。
- 如果 deploy.remote 是远程仓库名称，该名称必须已在 public/.git 中配置。

### Server 模式

deploy.mode: server 通过 SSH/SFTP 将 public/ 上传至 Linux 服务器，并原子化切换发布版本。

支持的服务器配置：

`yaml
deploy:
  mode: server
  server:
    host: example.com
    port: 22
    user: deploy
    path: /var/www/rash
    identity: C:/Users/you/.ssh/id_ed25519
    known_hosts: C:/Users/you/.ssh/known_hosts
    # 密钥不可用时可选
    password: your-password
`

## 内容结构

`	ext
content/
├── posts/
├── about/
│   └── about.md
└── friends/
    └── friends.md
`

### 文章

文章位于 content/posts/ 目录，使用 YAML 前置元数据和 Markdown 内容。

`markdown
---
title: My First Post
author: Your Name
date: 2026-07-01
updated_at: 2026-07-05
location: Shanghai
avatar: https://example.com/avatar.jpg
cover: https://example.com/cover.jpg
category: technology
---

Write your post content here.

<!-- more -->

More content here.
`

支持的字段：

| 字段 | 必需 | 描述 |
|-------|-------|------|
| 	itle | 是 | 文章标题 |
| date | 是 | 发布日期，格式为 YYYY-MM-DD |
| uthor | 否 | 作者名称 |
| updated_at | 否 | 更新日期，格式为 YYYY-MM-DD |
| location | 否 | 地理位置 |
| vatar | 否 | 作者头像 URL |
| cover | 否 | 封面图片 URL |
| category | 否 | 	echnology 或 life；影响首页分类展示 |

### About 和 Friends

content/about/about.md 和 content/friends/friends.md 会作为普通 Markdown 页面渲染，支持可选 	itle 前端元数据。
