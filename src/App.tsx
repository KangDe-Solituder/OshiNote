import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './components/features/themes/ThemeProvider'
import { MainLayout } from './components/layout/MainLayout'
import { HomePage } from './pages/HomePage'
import { OshiListPage } from './pages/OshiListPage'
import { OshiDetailPage } from './pages/OshiDetailPage'
import { NoteEditorPage } from './pages/NoteEditorPage'
import { TagsPage } from './pages/TagsPage'
import { TagDetailPage } from './pages/TagDetailPage'
import { AIToolsPage } from './pages/AIToolsPage'
import { ExportPage } from './pages/ExportPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="oshis" element={<OshiListPage />} />
            <Route path="oshis/:oshiId" element={<OshiDetailPage />} />
            <Route path="oshis/:oshiId/notes/new" element={<NoteEditorPage />} />
            <Route path="oshis/:oshiId/notes/:noteId" element={<NoteEditorPage />} />
            <Route path="tags" element={<TagsPage />} />
            <Route path="tags/:tagName" element={<TagDetailPage />} />
            <Route path="ai" element={<AIToolsPage />} />
            <Route path="export" element={<ExportPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
