# Tab Clean Master

Tab Clean Master 是一款基于 Chrome Manifest V3 的浏览器清理扩展，旨在提供当前页面清理、全局清理以及通用设置等完整功能模块。本仓库遵循阶段化开发流程，目前已完成基础架构的搭建。

## 当前进度

- [x] 创建项目目录结构
- [x] 配置 Manifest V3 基础信息
- [x] 构建弹窗与选项页的 UI 框架
- [x] 实现选项卡切换与无障碍支持
- [x] 封装存储与工具模块的初始版本
- [x] 将扩展图标迁移至 `src/assets` 并在后台脚本中动态加载

## 快速开始

1. 打开 Chrome 浏览器并进入 `chrome://extensions/`。
2. 开启开发者模式，点击“加载已解压的扩展程序”。
3. 选择本仓库中的 `src` 目录即可加载插件。

## 目录结构

```
project/
├── src/
│   ├── manifest.json
│   ├── background/
│   │   └── icon-service-worker.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   └── common/
│       ├── utils.js
│       └── storage.js
├── assets/
│   └── images/
└── docs/
    └── README.md
```

## 图标资源说明

扩展图标统一存放在 `src/assets/icons` 目录。后台 Service Worker 在安装和启动时动态读取这些 PNG 文件并设置工具栏图标，避免在代码中内联 Base64 数据，同时保留原有的懒加载和缓存逻辑。

## 后续计划

- 在弹窗中实现当前页面与全局清理逻辑。
- 在选项页提供时间范围、自动清理等设置项。
- 引入统一的视觉与交互反馈系统。
- 完成文档化与自动化测试流程。
