import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/features/themes/ThemeProvider'
import { MotionProvider } from './components/features/themes/MotionProvider'
import { MainLayout } from './components/layout/MainLayout'
import { HomePage } from './pages/HomePage'
import { OshiListPage } from './pages/OshiListPage'
import { OshiDetailPage } from './pages/OshiDetailPage'
import { OshiOverviewPage } from './pages/OshiOverviewPage'
import { OshiJournalPage } from './pages/OshiJournalPage'
import { OshiTagsPage } from './pages/OshiTagsPage'
import { NoteEditorPage } from './pages/NoteEditorPage'
import { TagsPage } from './pages/TagsPage'
import { TagDetailPage } from './pages/TagDetailPage'
import { ExportPage } from './pages/ExportPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotesPage } from './pages/NotesPage'
import { OshiIllustrationsPage } from './pages/OshiIllustrationsPage'
import { IllustrationsPage } from './pages/IllustrationsPage'
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
              <Route path="oshis/:oshiId/journal" element={<OshiJournalPage />} />
              <Route path="oshis/:oshiId/illustrations" element={<OshiIllustrationsPage />} />
              <Route path="oshis/:oshiId/tags" element={<OshiTagsPage />} />
              <Route path="oshis/:oshiId/notes/new" element={<NoteEditorPage />} />
              <Route path="oshis/:oshiId/notes/:noteId" element={<NoteEditorPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="notes/new" element={<NoteEditorPage />} />
              <Route path="notes/:noteId" element={<NoteEditorPage />} />
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
