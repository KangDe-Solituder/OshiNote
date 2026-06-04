import { createRoot } from 'react-dom/client'
import './styles/themes/pink-cozy.css'
import './styles/themes/dark-night.css'
import './styles/themes/soft-blue.css'
import './styles/themes/sakura.css'
import './styles/themes/rainy-cafe.css'
import './styles/themes/glass.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <App />,
)
