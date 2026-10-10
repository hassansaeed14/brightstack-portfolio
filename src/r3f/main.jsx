import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Scene from './Scene.jsx'

createRoot(document.getElementById('r3f-root')).render(
  <StrictMode>
    <Scene />
  </StrictMode>,
)
