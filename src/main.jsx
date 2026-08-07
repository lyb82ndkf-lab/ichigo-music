import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { installRuntimeLogging } from './utils/runtimeLog'

installRuntimeLogging()
const rootElement = document.getElementById('root')
const root = ReactDOM.createRoot(rootElement)

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Wait until the app stylesheet has actually been applied before revealing
// the React tree. Two animation frames are not sufficient on a cold start:
// the CSS chunk can still be downloading when React has already rendered.
const revealWhenStyled = () => {
  const cssReady = getComputedStyle(document.documentElement)
    .getPropertyValue('--primary')
    .trim()
  const appearanceReady = document.body.dataset.appearanceReady === 'true'
  if (cssReady && appearanceReady) {
    requestAnimationFrame(() => rootElement?.classList.remove('app-booting'))
    return
  }
  requestAnimationFrame(revealWhenStyled)
}

revealWhenStyled()
// A broken stylesheet must not leave the window permanently hidden.
window.setTimeout(() => rootElement?.classList.remove('app-booting'), 8000)
