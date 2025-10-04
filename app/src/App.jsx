import { useState } from 'react'
import { BrowserRouter,Routes,Route } from "react-router-dom";
import Home from './components/pages/home/home'
import EarthApp from './components/pages/earth/earth.jsx'
import './App.css'

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/earth" element={<EarthApp />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
