import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/features/themes/ThemeProvider'
import { MotionProvider } from './components/features/themes/MotionProvider'
import { MainLayout } from './components/layout/MainLayout'
import { HomePage } from './pages/HomePage'
import { OshiListPage } from './pages/OshiListPage'
import { OshiDetailPage } from './pages/OshiDetailPage'
import { NoteEditorPage } from './pages/NoteEditorPage'
import { TagsPage } from './pages/TagsPage'
import { TagDetailPage } from './pages/TagDetailPage'
import { ExportPage } from './pages/ExportPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotesPage } from './pages/NotesPage'

export default function App() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route index element={<HomePage />} />
              <Route path="oshis" element={<OshiListPage />} />
              <Route path="oshis/:oshiId" element={<OshiDetailPage />} />
              <Route path="oshis/:oshiId/notes/new" element={<NoteEditorPage />} />
              <Route path="oshis/:oshiId/notes/:noteId" element={<NoteEditorPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="notes/new" element={<NoteEditorPage />} />
              <Route path="notes/:noteId" element={<NoteEditorPage />} />
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
