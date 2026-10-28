import { useI18n } from '../../i18n/useI18n'
const en = {
  materialDescription: 'Stickers, tapes, papers and decorative labels.', uploadDescription: 'Images imported from your device, with their journal usage.', records: 'Memories', tools: 'Journal tools', materials: 'Journal materials', uploads: 'Uploads',
  subtitle: 'Your memories and the materials that make them yours.', search: 'Search by name',
  usage: 'Used in', unused: 'Not used in a saved page or template', builtin: 'Included with OshiNote',
  upload: 'Imported image', dimensions: 'Dimensions', size: 'File size', created: 'Imported',
  choose: 'Select a resource to preview it and find where it is used.', empty: 'No matching resources', all: 'All',
  retained: 'Archived uploads are retained for existing pages.', unavailable: 'Could not load resources.',
  open: 'Open library', templates: 'Templates', retired: 'Archived', active: 'Available', images: 'Images', notes: 'Notes', tags: 'Tags',
}
type Labels = typeof en
const zh: Labels = {
  materialDescription: '贴纸、胶带、纸张与装饰标签。', uploadDescription: '查看导入的图像，以及使用它们的手账。', records: '推活记录', tools: '手账工具', materials: '手账素材', uploads: '上传内容',
  subtitle: '收藏推活的点滴，也整理装点回忆的素材。', search: '搜索名称',
  usage: '使用位置', unused: '尚未用于已保存的手账或模板', builtin: 'OshiNote 内置',
  upload: '导入图像', dimensions: '图像尺寸', size: '文件大小', created: '导入时间',
  choose: '选择素材，预览并查看它用在哪些手账或模板中。', empty: '没有符合条件的资源', all: '全部',
  retained: '已收起的上传内容仍为原有手账保留。', unavailable: '资源加载失败。',
  open: '打开资源库', templates: '模板', retired: '已收起', active: '可用', images: '图像', notes: '笔记', tags: '标签',
}
const ja: Labels = {
  materialDescription: 'シール、テープ、紙、装飾ラベル。', uploadDescription: '読み込んだ画像と、その使用先を確認。', records: '推し活の記録', tools: '手帳ツール', materials: '手帳素材', uploads: 'アップロード',
  subtitle: '思い出と、思い出を彩る素材をまとめて管理。', search: '名前で検索',
  usage: '使用先', unused: '保存済みの手帳・テンプレートでは未使用', builtin: 'OshiNote 標準',
  upload: '読み込んだ画像', dimensions: '画像サイズ', size: 'ファイルサイズ', created: '読み込み日時',
  choose: '素材を選択してプレビューと使用先を確認できます。', empty: '該当する素材はありません', all: 'すべて',
  retained: '非表示の画像も既存の手帳のために保持されます。', unavailable: '素材を読み込めませんでした。',
  open: 'ライブラリを開く', templates: 'テンプレート', retired: '非表示', active: '使用可能', images: '画像', notes: 'ノート', tags: 'タグ',
}
export function useResourceText(): Labels {
  const { locale } = useI18n()
  return locale === 'zh' ? zh : locale === 'ja' ? ja : en
}
