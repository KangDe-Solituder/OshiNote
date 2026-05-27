# OshiNote

一款为 VTuber、直播与 ASMR 爱好者设计的本地优先桌面日记应用。

OshiNote 希望成为一个安静、温暖的私人空间：你可以为不同的 `oshi` 建立专属档案，记录观看直播后的心情、值得珍藏的片段、想说却还没说出口的话，并借助 AI 完成翻译或文字润色。

> Record memories, emotions, and stream impressions for your oshi.

## 项目介绍

很多关于推的记忆并不适合散落在社交平台、便签应用或聊天记录里。OshiNote 的目标是把这些内容组织为可以长期回看的个人收藏：

- 以 `oshi` 为中心管理内容，每位推都拥有独立档案与笔记空间。
- 将数据保存于本机 SQLite 数据库，优先保护隐私与可控性。
- 提供柔和可切换的界面主题，让记录本身也具有陪伴感。
- 可选接入 AI 服务，用于日中英翻译与写作润色。

当前项目处于早期可用阶段，基础记录流程和 AI 工具已经建立，导出与更丰富的浏览能力仍在开发中。

## 技术栈

| 方向 | 技术 |
| --- | --- |
| 桌面运行时 | [Tauri v2](https://tauri.app/) + [Rust](https://www.rust-lang.org/) |
| 前端 | React 19、TypeScript、Vite |
| 样式与交互 | Tailwind CSS、Framer Motion、Lucide React |
| 路由与状态 | React Router、Zustand |
| 本地存储 | SQLite、`@tauri-apps/plugin-sql` |
| 桌面能力 | Tauri Dialog / FS plugins |
| AI 接口 | OpenAI、Claude、Gemini、兼容 OpenAI API 的本地服务 |
| 开发方式 | Vibe Coding：以创意方向和用户体验为驱动，结合 AI 协作迭代、人工验证与代码审阅 |

项目选择 Tauri 与 Rust，是希望获得比传统 Web 容器更轻量的桌面体验，同时保留本地数据库与系统能力的可靠基础。

## 功能进度

### 已完成

- [x] 桌面应用基础框架与侧边栏导航
- [x] `oshi` 档案的创建、编辑与删除
- [x] 档案头像、主题色、描述与相关活动链接
- [x] 按 `oshi` 管理多个笔记归档分类
- [x] 笔记的新建、编辑、删除、收藏与分页展示
- [x] 笔记标签录入与标签总览
- [x] 基于 SQLite FTS5 的笔记关键词搜索
- [x] 本地 SQLite 数据存储及启动时数据库迁移
- [x] 五套界面主题与快捷键切换
- [x] AI 翻译工具，支持中文、日文、英文
- [x] AI 写作润色工具，支持语气、重点与上下文提示
- [x] OpenAI、Claude、Gemini 与本地 API provider 配置

### 计划中

- [ ] 将现有 Tiptap 组件完整接入笔记编辑流程，提供富文本格式、颜色、高亮与表情插入
- [ ] 标签详情页中的实际笔记筛选与跳转
- [ ] JSON、Markdown、TXT 数据导出
- [ ] 笔记关系图或情绪可视化视图
- [ ] 自定义背景图片与更完整的外观设置入口
- [ ] 安装包发布、升级策略与数据备份恢复流程

## 安装与编译

### 准备环境

请先安装以下工具：

- [Node.js](https://nodejs.org/) 与 [pnpm](https://pnpm.io/installation)
- [Rust](https://www.rust-lang.org/tools/install)
- Tauri 对应平台的系统依赖，详见 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

在 Windows 上，Tauri 还需要 Microsoft C++ Build Tools 与 WebView2；现代 Windows 系统一般已经包含 WebView2 Runtime，但仍建议以官方 prerequisites 页面为准。

### 获取源码

```bash
git clone git@github.com:KangDe-Solituder/OshiNote.git
cd OshiNote
pnpm install
```

也可以使用 HTTPS 克隆：

```bash
git clone https://github.com/KangDe-Solituder/OshiNote.git
cd OshiNote
pnpm install
```

### 开发运行

启动完整桌面应用：

```bash
pnpm tauri dev
```

仅调试前端界面：

```bash
pnpm dev
```

### 构建

构建桌面发行包：

```bash
pnpm tauri build
```

Windows 首次生成安装包时，Tauri 可能会在线下载 WiX 等打包工具；如果下载超时，请确认可访问 GitHub 后重新执行构建命令。

只验证桌面应用程序编译、暂不生成安装包：

```bash
pnpm tauri build --no-bundle
```

仅构建前端静态资源：

```bash
pnpm build
```

桌面构建产物会生成在 `src-tauri/target/` 下，该目录属于本机构建输出，不应提交到 Git。

## 数据与隐私

- 日记、档案、主题设置与 AI provider 配置保存在本地 SQLite 数据库中。
- 配置第三方 AI 服务后，只有你主动发送给相应 provider 的文本会被请求至该服务端点。
- API Key 会保存在本地数据库中。请仅在可信设备上使用，并避免提交任何包含密钥的配置文件。

## 项目结构

```text
OshiNote/
|-- src/                    # React 界面、业务逻辑与本地数据库访问
|-- public/                 # Web 静态资源
|-- src-tauri/
|   |-- src/                # Rust / Tauri 应用入口
|   |-- capabilities/       # 桌面权限配置
|   |-- icons/              # 桌面应用图标
|   |-- Cargo.toml          # Rust 依赖配置
|   `-- tauri.conf.json     # 应用打包与窗口配置
|-- package.json
`-- vite.config.ts
```

## 致谢

感谢 [Rust](https://www.rust-lang.org/) 与 [Tauri](https://tauri.app/) 提供可靠且轻量的桌面应用基础，也感谢 React、Vite、SQLite 及所有开源依赖的维护者。

这个项目也使用 Vibe Coding 的方式持续生长：创意与情感体验由人来决定方向，AI 协助探索和实现，最终仍通过人工检查、构建验证与真实使用来判断结果。

## License

本项目使用 [MIT License](./LICENSE)。
