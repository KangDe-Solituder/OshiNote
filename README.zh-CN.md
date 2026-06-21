# OshiNote

<p align="center">
  <a href="./README.md">English</a>
  ·
  <strong>简体中文</strong>
  ·
  <a href="./README.ja.md">日本語</a>
</p>

OshiNote 是一款为推活记录设计的本地优先桌面应用。

旨在创造一个安静、温暖、可长期保存的私人空间：可以为不同的推建立档案，记录看完直播后的心情，整理值得珍藏的图像资料，把笔记、散页和手账慢慢收纳成属于自己的回忆库。

> Record memories, emotions, and stream impressions for your oshi.

## 当前状态

OshiNote 目前处于早期可用阶段。基础桌面框架、本地 SQLite 数据库、推空间、富文本笔记、图像资料、顶级手账模块、三语界面已经建立。

接下来项目主要沿三个方向继续推进：

- 巩固框架稳定性、动画流畅度、资源加载、内存占用和构建检查。
- 完善 Note、Illustration、Journal、Book、Postcard 等创作与整理体验。
- 引入更有推活特色的功能，例如模板/素材管理、印章系统和更自由的手账创作。

## 功能概览

### 推空间

- 创建和管理推的档案，包括头像、简介、主题色与相关链接。
- 在每个推空间下查看笔记、图像资料和标签。
- 主页展示最近笔记与最近图像资料，方便回看近期记录。

### 笔记

- 基于 TipTap 的富文本编辑器。
- 支持加粗、斜体、下划线、删除线、字号、字体、文字颜色、高亮和表情。
- 支持日期、分类、所属推、来源链接等元信息。
- 支持收藏、删除、保存、归档状态、标签和关键词搜索。

### 图像资料

- 支持导入本地 PNG、JPEG、WebP 图像。
- 导入后会复制到应用本地数据目录，并在数据库中保存记录。
- 支持全局图像资料页与单个推空间内的图像资料页。
- 支持卡片、密集网格、列表等多种布局。
- 点击卡片可打开右侧详情，查看元信息、收藏、编辑、删除。
- 点击详情图可进入全屏预览。
- 删除图像记录时，会同步删除应用复制保存的本地媒体文件。

### 手账

- 手账管理页以书架方式统一管理书本和散页。
- 手账创作页可直接从侧边栏进入，默认打开空白创作台。
- 支持在画布中整理笔记和图像资料。
- 右侧抽屉用于设置页面标题、日期、描述、背景、收纳位置等信息。
- 页面可以保存到 Book，也可以作为 loose page 单独保留。
- 旧的推空间手账路由会兼容跳转到新的顶级手账模块。

### 国际化

- 支持 English、简体中文、日本語。
- 默认语言为 English。
- 用户在设置中切换语言后，会保存到本地，下次打开时自动恢复。

### 外观与动效

- 支持多套界面主题。
- 支持调整界面文字大小与动画速度。
- 下拉框、抽屉、弹窗、详情面板和全屏预览使用统一的 overlay 层级与动效规范。

## 技术栈

| 方向 | 技术 |
| --- | --- |
| 桌面运行时 | Tauri v2、Rust |
| 前端 | React 19、TypeScript、Vite |
| 样式与动效 | Tailwind CSS、Framer Motion、Lucide React |
| 路由与状态 | React Router 7、Zustand |
| 富文本编辑 | TipTap 3 |
| 本地数据库 | SQLite、`@tauri-apps/plugin-sql` |
| 桌面能力 | Tauri Dialog / FS / Process / SQL / Updater plugins |
| 大列表 | TanStack React Virtual |

## 安装与运行

### 环境准备

请先安装：

- Node.js 与 pnpm
- Rust
- Tauri 对应平台的系统依赖

具体平台要求请参考 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)。

Windows 上可能还需要 Microsoft C++ Build Tools 与 WebView2 Runtime。现代 Windows 系统一般已经包含 WebView2，但仍建议以 Tauri 官方文档为准。

### 获取源码

```bash
git clone https://github.com/KangDe-Solituder/OshiNote.git
cd OshiNote
pnpm install
```

也可以使用 SSH：

```bash
git clone git@github.com:KangDe-Solituder/OshiNote.git
cd OshiNote
pnpm install
```

### 开发运行

启动完整桌面应用：

```bash
pnpm tauri dev
```

仅启动 Vite 前端：

```bash
pnpm dev
```

部分页面依赖 Tauri 的 SQLite 与文件系统能力。真实功能测试建议使用 `pnpm tauri dev`；单独的 Vite 页面更适合快速检查 UI。

### 质量检查

```bash
pnpm quality
```

该命令会依次执行：

```bash
pnpm lint
pnpm build
```

也可以单独运行：

```bash
pnpm lint
pnpm build
```

### 构建

构建桌面应用：

```bash
pnpm tauri build
```

只验证桌面程序编译，暂不生成安装包：

```bash
pnpm tauri build --no-bundle
```

仅构建前端静态资源：

```bash
pnpm build
```

桌面构建产物会生成在 `src-tauri/target/` 下，该目录属于本机构建输出，不应提交到 Git。

## 数据与隐私

- OshiNote 默认将数据保存在本机。
- 档案、笔记、标签、手账和设置等核心记录保存在本地 SQLite 数据库中。
- 上传的图像资料会被复制到应用数据目录，例如 `media/illustrations/originals/{year}` 与 `media/illustrations/thumbnails/{year}`。
- 删除图像资料时，会同步删除应用复制保存的本地媒体文件。
- 请不要提交本地数据库、个人媒体文件、临时日志或构建产物。

## 项目结构

```text
OshiNote/
|-- src/
|   |-- components/        # 通用 UI 与布局组件
|   |-- features/          # 功能模块
|   |-- i18n/              # 三语翻译与语言工具
|   |-- pages/             # 路由页面
|   |-- services/          # 数据、媒体与应用服务
|   |-- stores/            # Zustand 状态
|   `-- styles/            # 全局样式与设计 token
|-- public/                # Web 静态资源
|-- src-tauri/
|   |-- src/               # Rust / Tauri 应用入口
|   |-- capabilities/      # Tauri 权限配置
|   |-- icons/             # 桌面应用图标
|   |-- Cargo.toml
|   `-- tauri.conf.json
|-- package.json
`-- vite.config.ts
```

## 开发约定

- 推送前优先运行 `pnpm quality`。
- 涉及数据库、媒体、文件系统和桌面权限的功能，应在 Tauri runtime 中测试。
- 本地计划、临时测试日志、个人媒体、本地数据库和构建产物不要提交到 Git。
- 路由兼容很重要：旧的手账路径需要继续平滑跳转到新的顶级手账模块。
- UI 修改后需要检查不同主题、不同动画速度下的下拉框、抽屉、弹窗、详情面板和全屏预览。

## 搜索说明

当前笔记搜索匹配的是标题、富文本内容、纯文本内容和标签中实际存储的字面文本。

它暂时还不会做日语读音归一化，也不会自动展开假名/汉字读法。例如一条笔记中写了 `お疲れ様`，目前搜索 `おつ` 不会自动匹配到它。

后续可以考虑加入读音词典或自定义别名，让 `おつ` 与 `お疲れ様` 这类常见表达能够互相匹配。

## Roadmap

- 资源管理：集中管理所有笔记、图像资料、模板和可复用素材。
- 模板系统：Note 或 Journal 使用模板后保存模板快照，避免源模板删除后影响旧内容。
- 印章系统：为 Note、Illustration、Postcard 和 Journal Page 增加保存时盖章或自由盖章。
- 手账增强：更丰富的页面模板、书本/明信片收纳方式和画布编辑能力。
- 导出与备份：支持 JSON、Markdown、TXT、媒体文件导出和恢复流程。
- 性能优化：路由级代码拆分、大列表虚拟化、媒体加载检测和内存/资源占用审计。

## License

本项目使用 [MIT License](./LICENSE)。

## 致谢

感谢 Rust、Tauri、React、Vite、SQLite、TipTap 以及所有开源依赖的维护者。

OshiNote 也在一种很个人的 Vibe Coding 方式里持续生长：方向由真实的推活体验决定，实现随着使用反馈持续迭代，最终通过人工检查、构建验证和日常使用来判断它是否真的好用、好看、好保存。
