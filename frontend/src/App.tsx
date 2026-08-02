import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Chat from './pages/Chat'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/:slug?" element={<Chat />} />
      </Routes>
    </Router>
  )
}

export default App
