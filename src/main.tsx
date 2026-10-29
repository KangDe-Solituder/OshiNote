import { createRoot } from 'react-dom/client'
import './styles/themes/warm-paper.css'
import './styles/themes/pink-cozy.css'
import './styles/themes/dark-night.css'
import './styles/themes/soft-blue.css'
import './styles/themes/sakura.css'
import './styles/themes/rainy-cafe.css'
import './styles/themes/glass.css'
import './index.css'
import App from './App.tsx'
import { markStartup } from './services/startup'
import { initializeWindowCloseHandling } from './services/windowClose'

markStartup('javascript-ready')
void initializeWindowCloseHandling().catch(error => console.error('Could not initialize window close handling', error))

createRoot(document.getElementById('root')!).render(
  <App />,
)
