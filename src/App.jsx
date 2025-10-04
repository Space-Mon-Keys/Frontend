
import { useState } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from './components/pages/home/home';
import Welcome from './components/pages/welcome/Welcome';
import './App.css';

function App() {
  const [showWelcome, setShowWelcome] = useState(true);

  return (
    showWelcome ? (
      <Welcome onStart={() => setShowWelcome(false)} />
    ) : (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    )
  );
}

export default App;
