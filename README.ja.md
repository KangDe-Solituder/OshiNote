# OshiNote

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <strong>日本語</strong>
</p>

OshiNote は、推しに関する記憶を保存し、整理し、あとから見返すためのローカル優先デスクトップアプリです。

汎用ノートアプリでも、SNS 投稿ツールでもありません。中心にあるのは、自分だけの記憶スタジオです。推しごとのスペースを作り、配信や作品やイベントのあとに感じたことを書き残し、画像を集め、Journal ページに並べながら、散らばった気持ちを少しずつ自分のアーカイブにしていきます。

> 目標：推し活の記憶を、探しやすく、美しく、長く残したくなる形にすること。

## OshiNote が目指すもの

- 配信の感想、イベントの記憶、作品の印象、日々の推し活の断片を記録する。
- ノート、画像、タグ、アーカイブ、Journal ページを推しごとに結びつける。
- ページの雰囲気を選び、ノート、画像、組み込み素材、スタンプをドラッグして手帳風の Journal を作る。
- データは基本的にローカル保存し、プライバシーと長期的な所有を重視する。
- English、簡体中文、日本語を主要 UI 言語として扱う。

## 現在の段階

OshiNote は、まだ初期段階ですが、基本的に使えるデスクトップアプリになっています。

デスクトップシェル、ローカル SQLite、推しスペース、ノートエディタ、画像ライブラリ、Journal モジュール、Resources の骨組み、スタンプの流れ、テーマ、三言語 UI は実装済みです。Journal は、単純なキャンバス試作から、ページ設定、リソースドロワー、キャンバス配置、詳細編集を持つ構成型フローへ進みました。次の段階では、この基盤を安定させ、大きなコンポーネントを分割し、その上でテンプレートと組み込み素材を広げていきます。

## 実装済み

### App Shell

- Tauri によるデスクトップシェル。
- 独自のトップウィンドウバー。
- My Oshis 用の幅調整可能なサイドバー。
- サイドバー下部に Home、Export、Settings。
- Journal と Resources のトップレベル入口。
- 複数テーマ、ガラス効果、UI フォントサイズ、アニメーション速度設定。

### 三言語対応

- English、簡体中文、日本語に対応。
- 選択した言語はローカルに保存。
- 新機能は三言語の文言をそろえる方針。

### 推しスペース

- 推しプロフィールの作成と管理。
- アバター、説明、テーマカラー、関連リンクを保存。
- 各推しに概要、ノート、画像、タグのページ。
- 推しホームで最近のノート、最近の画像、基本統計を表示。

### ノート

- TipTap ベースのリッチテキストエディタ。
- 太字、斜体、下線、取り消し線、サイズ、フォント、文字色、ハイライト、絵文字に対応。
- 日付、アーカイブ、推し、ソース URL、タグ、添付画像を管理。
- 文字数と語数をリアルタイム表示。
- タグ入力時に過去タグから候補を表示。
- 推し別ノートページでアーカイブ tabs とアーカイブ管理に対応。
- 検索、グリッド / リスト表示、お気に入り、保存、削除、画像添付に対応。

### 画像

- PNG、JPEG、WebP の取り込み。
- 取り込んだ画像はローカル app data にコピー。
- 全体画像ページと推し別画像ページ。
- すべて / 公式 / ファンアート / お気に入りでフィルタ。
- カード、グリッド、リスト表示。
- 詳細パネルと fullscreen プレビュー。
- 画像記録を削除すると、コピーされたローカルメディアも削除。

### Journal

- Journal はトップレベルモジュール。
- Books と loose pages に対応。
- 新規ページ作成は、ページ設定、ノート、画像、装飾素材、スタンプ、確認の流れ。
- キャンバス編集でノート、画像、組み込み素材、スタンプを配置。
- 通常表示はじっくり確認と軽い調整用で、「編集ページ」から詳細編集へ入る。
- ページ設定でタイトル、日付ラベル、説明、背景 preset、推し、収納先、縦横方向を設定。
- テープ、ステッカー、メモ紙、ラベルの組み込み素材プロトタイプ。
- note card、image frame、material の style payload は共有ロジック化され、保存後の再表示が安定。
- 古い推し内 Journal ルートは新しいトップレベル Journal へリダイレクト。

### Resources / Templates

- Resources 関連ルートを実装済み：
  - `/resources`
  - `/resources/templates`
  - `/resources/materials`
- 読み取り専用の組み込みテンプレートカードを表示。
- 非破壊的な `templates` テーブルを追加済み。
- Materials はまだ方向性のプレースホルダーで、完全な素材ライブラリではありません。

### スタンプシステム

- Note、Illustration、Journal Page に、対象ごとに 1 つのスタンプを保存。
- スタンプ設定は独立モーダル。
- 丸印、日付印、ワックスシール、紙ラベル、篆書印、飾り枠印、書字フォント系素材などに対応。
- 自由配置フロー：設定、Stamp ボタン、ghost 表示、左クリックで配置。
- サイズ、角度、透明度、色、文字を調整可能。
- モーダル内プレビューあり。
- 保存、削除、再読み込みに対応。
- 任意スタンプフォントは Settings から app data へ自動ダウンロード可能。
- PNG スタンプ取り込みは計画済みですが、未実装です。

## 未実装

- 完全な素材ライブラリ管理。
- ユーザーアップロードのステッカーとカスタム素材。
- より豊富な素材パック、テンプレートパック。
- ポストカードテンプレートとポストカードガチャ。
- LLM による tag pool 理解と引用抽出。
- ユーザー PNG スタンプ取り込み。
- slot 固定型の高度な Journal / Postcard テンプレート。
- 完全な export / backup / restore フロー。
- 日本語読み正規化、別名、かな / 漢字展開検索。
- ルート単位のコード分割と詳細なパフォーマンス監査。

## 次の方向

### 1. Journal の安定化とコンポーネント境界

Journal はすでに表現力が出てきたため、次は素材を増やす前に構造を安定させる段階です。

推奨順：

1. `JournalCreationFlow` を setup、step rail、edge drawer、resource drawer、review に分割。
2. `JournalDraftCanvas` を item frame、renderer、detail panel、interaction hook に分割。
3. 表示モードと詳細編集モードで visual renderer をさらに共有。
4. layout、style payload、draft adapter、popover positioning のテストを増やす。

これにより、手作り感の方向を保ちながら、エディタを壊れにくくできます。

### 2. ポストカードテンプレート基盤

ポストカードガチャは、最初からランダムコラージュとして作るべきではありません。先に固定テンプレートが必要です。

テンプレートは slot を定義します。

- 画像
- Note の抜粋
- 日付
- タグ
- 装飾
- 余白

このレイアウトルールがあってから、ノート、画像、タグ、アーカイブ、お気に入り、期間などからランダムに内容を入れるのが自然です。

### 3. ポストカードガチャ

将来的な流れ：

- テンプレートを選ぶ
- カードプールを選ぶ
- テンプレートにランダムで内容を入れる
- プレビューする
- 引き直す
- Journal ページに保存する

### 4. LLM Pool Understanding

LLM は v1 の必須要素ではなく、後続の強化として扱うのがよいです。

向いているタスク：

- 意味の近いタグをテーマ別カードプールにまとめる。
- 長い Note からポストカード向きの一文を抽出する。
- 内容に合うテンプレートを推薦する。
- 短いタイトルを生成する。
- 記念日、癒し、配信振り返り、映画の記憶、月次まとめなどのテーマを判断する。

## 技術スタック

| 領域 | 技術 |
| --- | --- |
| デスクトップ runtime | Tauri v2, Rust |
| フロントエンド | React 19, TypeScript, Vite |
| スタイルと motion | Tailwind CSS, Framer Motion, Lucide React |
| ルーティングと状態 | React Router 7, Zustand |
| リッチテキスト | TipTap 3 |
| ローカル DB | SQLite, `@tauri-apps/plugin-sql` |
| デスクトップ機能 | Tauri Dialog / FS / Process / SQL / Updater plugins |
| 大規模リスト | TanStack React Virtual |

## 開発

依存関係のインストール：

```bash
pnpm install
```

デスクトップアプリを起動：

```bash
pnpm tauri dev
```

フロントエンドのみ起動：

```bash
pnpm dev
```

一部の機能は Tauri の SQLite、ファイルシステム、ウィンドウ API に依存します。実機能の確認には `pnpm tauri dev` を使ってください。

品質チェック：

```bash
pnpm lint
pnpm test
pnpm build
```

または：

```bash
pnpm quality
```

デスクトップアプリのビルド：

```bash
pnpm tauri build
```

## データとプライバシー

- データは基本的にローカル保存です。
- 推しプロフィール、ノート、タグ、Journal、テンプレート、スタンプ、設定は SQLite またはローカル設定に保存されます。
- 取り込んだ画像はローカル app data にコピーされます。
- 任意スタンプフォントは app data に保存されます。
- ローカル DB、個人メディア、ログ、ビルド出力は Git に含めないでください。

## プロジェクト構成

```text
OshiNote/
|-- src/
|   |-- components/        # UI、layout、editor、Journal、Stamp components
|   |-- features/          # Feature services and domain logic
|   |-- hooks/             # Shared React hooks
|   |-- i18n/              # English / Chinese / Japanese translations
|   |-- pages/             # Route pages
|   |-- services/          # Media, export, update, AI services
|   |-- stores/            # Zustand stores
|   |-- utils/             # Safe parsing and local storage helpers
|   `-- styles/            # Themes and global styles
|-- docs/                  # Architecture and stabilization notes
|-- public/                # Static assets and optional font placeholders
|-- src-tauri/             # Rust / Tauri app
|-- local-dev-plan/        # Local planning notes, not release docs
|-- package.json
`-- vite.config.ts
```

## License

This project is released under the [MIT License](./LICENSE).

## Thanks

Rust、Tauri、React、Vite、SQLite、TipTap、そしてこのプロジェクトを支えるすべての OSS メンテナーに感謝します。

OshiNote は実際の推し活の中で形を変えていくアプリです。少し作り、使ってみて、足りないところを感じ取り、次の一歩をもっと便利で、もっと美しく、もっと自分のものらしくしていきます。
