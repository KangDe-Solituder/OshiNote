import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './components/features/themes/ThemeProvider'
import { MotionProvider } from './components/features/themes/MotionProvider'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { PageLoadingState } from './components/ui/PageLoadingState'
import { MainLayout } from './components/layout/MainLayout'
import { UpdateNotifier } from './components/features/update/UpdateNotifier'

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const OshiListPage = lazy(() => import('./pages/OshiListPage').then((module) => ({ default: module.OshiListPage })))
const OshiDetailPage = lazy(() => import('./pages/OshiDetailPage').then((module) => ({ default: module.OshiDetailPage })))
const OshiOverviewPage = lazy(() => import('./pages/OshiOverviewPage').then((module) => ({ default: module.OshiOverviewPage })))
const JournalHomePage = lazy(() => import('./pages/JournalHomePage').then((module) => ({ default: module.JournalHomePage })))
const JournalEditorPage = lazy(() => import('./pages/JournalEditorPage').then((module) => ({ default: module.JournalEditorPage })))
const OshiTagsPage = lazy(() => import('./pages/OshiTagsPage').then((module) => ({ default: module.OshiTagsPage })))
const NoteEditorPage = lazy(() => import('./pages/NoteEditorPage').then((module) => ({ default: module.NoteEditorPage })))
const TagsPage = lazy(() => import('./pages/TagsPage').then((module) => ({ default: module.TagsPage })))
const TagDetailPage = lazy(() => import('./pages/TagDetailPage').then((module) => ({ default: module.TagDetailPage })))
const ExportPage = lazy(() => import('./pages/ExportPage').then((module) => ({ default: module.ExportPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const NotesPage = lazy(() => import('./pages/NotesPage').then((module) => ({ default: module.NotesPage })))
const OshiIllustrationsPage = lazy(() => import('./pages/OshiIllustrationsPage').then((module) => ({ default: module.OshiIllustrationsPage })))
const IllustrationsPage = lazy(() => import('./pages/IllustrationsPage').then((module) => ({ default: module.IllustrationsPage })))
const ResourcesPage = lazy(() => import('./pages/ResourcesPage').then((module) => ({ default: module.ResourcesPage })))
const ResourceTemplatesPage = lazy(() => import('./pages/ResourceTemplatesPage').then((module) => ({ default: module.ResourceTemplatesPage })))
const ResourceMaterialsPage = lazy(() => import('./pages/ResourceMaterialsPage').then((module) => ({ default: module.ResourceMaterialsPage })))

export default function App() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <BrowserRouter>
          <UpdateNotifier />
          <ErrorBoundary>
            <Suspense fallback={<PageLoadingState label="Loading page" layout="detail" className="p-6" />}>
            <Routes>
              <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="oshis" element={<OshiListPage />} />
              <Route path="oshis/:oshiId" element={<OshiOverviewPage />} />
              <Route path="oshis/:oshiId/notes" element={<OshiDetailPage />} />
              <Route path="oshis/:oshiId/journal" element={<Navigate to="/journal" replace />} />
              <Route path="oshis/:oshiId/journal/pages/:pageId/edit" element={<JournalEditorPage />} />
              <Route path="oshis/:oshiId/illustrations" element={<OshiIllustrationsPage />} />
              <Route path="oshis/:oshiId/tags" element={<OshiTagsPage />} />
              <Route path="oshis/:oshiId/notes/new" element={<NoteEditorPage />} />
              <Route path="oshis/:oshiId/notes/:noteId" element={<NoteEditorPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="notes/new" element={<NoteEditorPage />} />
              <Route path="notes/:noteId" element={<NoteEditorPage />} />
              <Route path="journal" element={<JournalHomePage />} />
              <Route path="journal/create" element={<JournalEditorPage />} />
              <Route path="journal/pages/:pageId/edit" element={<JournalEditorPage />} />
              <Route path="resources" element={<ResourcesPage />} />
              <Route path="resources/templates" element={<ResourceTemplatesPage />} />
              <Route path="resources/materials" element={<ResourceMaterialsPage />} />
              <Route path="illustrations" element={<IllustrationsPage />} />
              <Route path="tags" element={<TagsPage />} />
              <Route path="tags/:tagName" element={<TagDetailPage />} />
              <Route path="export" element={<ExportPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </MotionProvider>
    </ThemeProvider>
  )
}
