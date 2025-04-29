# Redbook Collect - 小红书笔记采集助手

![Redbook Collect Logo](images/icon128.png)

Redbook Collect 是一款Chrome浏览器扩展，帮助用户一键提取小红书笔记信息并自动保存到飞书多维表格中。

## 功能特点

- **一键采集**：快速提取小红书笔记的标题、作者、正文内容、标签和互动数据（点赞、收藏、评论数）
- **自动整理**：将提取的数据自动整理并提交到指定的飞书多维表格
- **简洁界面**：符合小红书风格的UI设计，操作简单直观
- **独立配置**：专门的配置页面，轻松管理飞书连接设置
- **隐私保护**：完全本地处理数据，保护用户隐私安全

## 安装方法

### 从Chrome应用商店安装
// 审核中
1. 访问[Chrome网上应用店](https://chrome.google.com/webstore/category/extensions)
2. 搜索"Redbook Collect"
3. 点击"添加至Chrome"按钮

### 手动安装开发版本

1. 下载本仓库代码或克隆到本地
```
git clone https://github.com/comeonzhj/redbook-collect.git
```

2. 打开Chrome浏览器，输入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择下载的代码文件夹

## 使用指南

### 初始配置

首次使用时，需要配置飞书多维表格的相关信息：

1. 点击插件图标，然后点击"选项页面"链接（或右键点击插件图标，选择"选项"）
2. 填写以下信息：
   - **表格URL**：飞书多维表格的URL地址
   - **app_token**：飞书应用的app_token
   - **app_secret**：飞书应用的app_secret
3. 点击"保存配置"按钮

### 采集笔记

1. 打开任意小红书笔记页面
2. 点击浏览器工具栏中的Redbook Collect图标
3. 点击"采集笔记"按钮
4. 等待数据采集完成，成功后会显示提示信息

## 飞书多维表格设置

为了正确接收数据，你的飞书多维表格需要包含以下字段：

- **url**：笔记URL
- **标题**：笔记标题
- **作者**：笔记作者
- **正文**：笔记正文内容
- **标签**：笔记标签（多选）
- **点赞**：点赞数（数字）
- **收藏**：收藏数（数字）
- **评论**：评论数（数字）

## 开发说明

### 项目结构

```
redbook-collect/
├── manifest.json        # 扩展配置文件
├── popup.html           # 弹出窗口HTML
├── popup.css            # 弹出窗口样式
├── popup.js             # 弹出窗口脚本
├── options.html         # 选项页面HTML
├── options.css          # 选项页面样式
├── options.js           # 选项页面脚本
├── content.js           # 内容脚本（提取页面数据）
├── background.js        # 后台脚本（处理API请求）
└── images/              # 图标和图片资源
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 技术实现

- 使用Chrome扩展API进行浏览器交互
- 通过DOM操作提取小红书页面数据
- 使用飞书开放平台API提交数据到多维表格
- 采用消息传递机制实现组件间通信

## 常见问题

**Q: 为什么无法提取笔记数据？**
A: 请确保你已经打开了小红书笔记详情页，而不是首页或其他页面。

**Q: 提交数据时报错"FieldNameNotFound"？**
A: 请检查你的飞书多维表格是否包含了所有必要的字段，字段名称需要与插件中的完全一致。

**Q: 如何获取飞书应用的app_token和app_secret？**
A: 请前往[飞书开放平台](https://open.feishu.cn/app)创建一个应用，然后在应用凭证页面获取相关信息。

## 隐私说明

本插件仅在用户主动点击"采集笔记"按钮时提取当前页面信息，不会收集任何其他浏览数据。所有配置信息仅存储在用户本地，不会上传至任何第三方服务器（除了用户自己配置的飞书API）。

## 贡献指南

欢迎贡献代码、报告问题或提出新功能建议！请遵循以下步骤：

1. Fork本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个Pull Request


**Redbook Collect** - 让内容收集更高效、更有条理！
