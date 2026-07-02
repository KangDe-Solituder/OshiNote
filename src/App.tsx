import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './components/features/themes/ThemeProvider'
import { MotionProvider } from './components/features/themes/MotionProvider'
import { MainLayout } from './components/layout/MainLayout'
import { HomePage } from './pages/HomePage'
import { OshiListPage } from './pages/OshiListPage'
import { OshiDetailPage } from './pages/OshiDetailPage'
import { OshiOverviewPage } from './pages/OshiOverviewPage'
import { JournalHomePage } from './pages/JournalHomePage'
import { JournalEditorPage } from './pages/JournalEditorPage'
import { OshiTagsPage } from './pages/OshiTagsPage'
import { NoteEditorPage } from './pages/NoteEditorPage'
import { TagsPage } from './pages/TagsPage'
import { TagDetailPage } from './pages/TagDetailPage'
import { ExportPage } from './pages/ExportPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotesPage } from './pages/NotesPage'
import { OshiIllustrationsPage } from './pages/OshiIllustrationsPage'
import { IllustrationsPage } from './pages/IllustrationsPage'
import { ResourcesPage } from './pages/ResourcesPage'
import { ResourceTemplatesPage } from './pages/ResourceTemplatesPage'
import { ResourceMaterialsPage } from './pages/ResourceMaterialsPage'
import { UpdateNotifier } from './components/features/update/UpdateNotifier'

export default function App() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <BrowserRouter>
          <UpdateNotifier />
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
        </BrowserRouter>
      </MotionProvider>
    </ThemeProvider>
  )
}
