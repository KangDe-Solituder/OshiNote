import { useI18n } from '../i18n/useI18n'
const zh = {
  locations: '目录配置', add: '添加配置', edit: '编辑', remove: '移除', name: '配置名称', kind: '类型', local: '本地目录', cloud: 'WebDAV', directory: '备份目录', browse: '选择目录', save: '保存', cancel: '取消',
  sync: '同步', backup: '备份', restore: '恢复', syncTarget: '同步目标', backupTarget: '默认备份位置', select: '请选择', noLocations: '添加 WebDAV 或本地目录，设置同步和备份位置。',
  locationHint: '同步目标与默认备份位置分别选择。目录配置保留在本机，恢复备份不会覆盖连接设置。',
  syncHint: '合并记录与媒体，保留各设备自己的数据库。', backupHint: '保存当前数据库、笔记、手账、媒体、素材和字体，不先执行同步。',
  restoreHint: '先在临时副本中检查并迁移，确认后替换本地数据库与媒体。',
  create: '创建完整备份', refresh: '读取备份列表', file: '选择本地备份文件', restoreSource: '备份来源', backupFile: '备份文件', inspect: '检查备份', empty: '此目录还没有备份',
  listLoaded: '已读取 {count} 个备份', ready: '备份已检查', created: '创建时间', appVersion: '应用版本', schema: '数据库结构版本', unknown: '旧版未记录', confirmRestore: '确认恢复',
  replaceWarning: '恢复将替换当前笔记、手账、图像和素材，不会合并。建议先备份当前内容。',
  validated: '完整性检查及结构迁移已通过。', migration: '旧结构将迁移到当前版本', removeConfirm: '只移除此配置，不会删除目录或已有备份。继续？',
  advanced: '高级操作', busy: '正在处理，请稍候…', saved: '备份已保存', noBackup: '请先配置并选择备份位置。', noSync: '请先选择 WebDAV 同步目标。',
  test: '测试连接', working: '正在使用', newLocation: '添加目录配置', editLocation: '编辑目录配置', verifyFailed: '检查失败，当前数据未替换。',
  oldBackup: '旧版云端备份', synced: '同步完成', switching: '切换同步目标会重建同步关联，但不会删除本地数据或远端文件。继续？',
}
type Labels = typeof zh
const en: Labels = {
  locations:'Locations',add:'Add location',edit:'Edit',remove:'Remove',name:'Name',kind:'Type',local:'Local folder',cloud:'WebDAV',directory:'Backup folder',browse:'Choose folder',save:'Save',cancel:'Cancel',
  sync:'Sync',backup:'Backup',restore:'Restore',syncTarget:'Sync destination',backupTarget:'Default backup location',select:'Choose',noLocations:'Add a WebDAV connection or a local backup folder.',
  locationHint:'Choose sync and backup destinations independently. Connection settings stay on this device when restoring.',syncHint:'Merge records and media into each device’s own database.',backupHint:'Save the current database, notes, journals, media, materials and fonts without syncing first.',restoreHint:'Validate and migrate a temporary copy before replacing local data.',
  create:'Create full backup',refresh:'Load backups',file:'Choose local backup file',restoreSource:'Backup source',backupFile:'Backup file',inspect:'Check backup',empty:'No backups in this location',listLoaded:'Loaded {count} backups',ready:'Backup checked',created:'Created',appVersion:'App version',schema:'Database schema',unknown:'Not recorded in older backups',confirmRestore:'Confirm restore',
  replaceWarning:'Restoring replaces current notes, journals, images and materials; it does not merge them. Back up current content first.',validated:'Integrity checks and schema migration passed.',migration:'Older schemas are migrated to the current version',removeConfirm:'Remove this configuration only? The folder and existing backups will remain.',
  advanced:'Advanced operations',busy:'Working, please wait…',saved:'Backup saved',noBackup:'Configure and select a backup location first.',noSync:'Select a WebDAV sync destination first.',test:'Test connection',working:'In use',newLocation:'Add location',editLocation:'Edit location',verifyFailed:'Check failed. Current data has not been replaced.',oldBackup:'Legacy cloud backup',synced:'Sync complete',switching:'Switching destinations resets the sync association without deleting local data or remote files. Continue?',
}
const ja: Labels = {
  ...en, locations:'保存先設定',add:'設定を追加',edit:'編集',remove:'削除',name:'設定名',kind:'種類',local:'ローカルフォルダー',directory:'バックアップ先',browse:'フォルダーを選択',save:'保存',cancel:'キャンセル',
  sync:'同期',backup:'バックアップ',restore:'復元',syncTarget:'同期先',backupTarget:'既定のバックアップ先',select:'選択',noLocations:'WebDAV またはローカルの保存先を追加してください。',
  locationHint:'同期先とバックアップ先は個別に選べます。接続設定は復元で変更されません。',syncHint:'各端末のデータベースに記録とメディアを統合します。',backupHint:'事前に同期せず、現在のデータベース・ノート・手帳・素材・画像・フォントを保存します。',restoreHint:'一時コピーを検証・移行してからローカルデータを置き換えます。',
  create:'完全バックアップを作成',refresh:'バックアップ一覧を取得',file:'ローカルファイルを選択',restoreSource:'復元元',backupFile:'バックアップファイル',inspect:'バックアップを検証',empty:'バックアップはありません',listLoaded:'{count} 件のバックアップを取得しました',ready:'検証済み',created:'作成日時',appVersion:'アプリのバージョン',schema:'データベース構造',unknown:'旧版では未記録',confirmRestore:'復元を確定',
  replaceWarning:'現在のノート・手帳・画像・素材を置き換えます。統合はしません。先に現在の内容をバックアップしてください。',validated:'整合性の検証と構造の移行が完了しました。',migration:'旧構造は現在のバージョンへ移行します',removeConfirm:'設定のみ削除しますか？フォルダーとバックアップは残ります。',advanced:'詳細操作',busy:'処理中…',saved:'バックアップを保存しました',noBackup:'バックアップ先を選択してください。',noSync:'WebDAV の同期先を選択してください。',test:'接続テスト',working:'使用中',newLocation:'保存先を追加',editLocation:'保存先を編集',verifyFailed:'検証に失敗しました。現在のデータは変更されていません。',oldBackup:'旧版クラウドバックアップ',synced:'同期完了',switching:'同期先の変更で同期の関連付けを再作成します。ローカルデータとリモートファイルは削除されません。続行しますか？',
}
export function useDataText(): Labels { const { locale } = useI18n(); return locale === 'zh' ? zh : locale === 'ja' ? ja : en }
