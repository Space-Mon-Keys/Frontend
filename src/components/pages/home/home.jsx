import { motion, AnimatePresence } from 'framer-motion'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import EarthApp from '../earth/earth.jsx'
import './home.css'
function home() {
  return (
    <motion.div 
      className="cosmo-crush-screen"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ 
        duration: 0.8,
        ease: "easeInOut"
      }}
    >
      <motion.div
        className="cosmo-crush-container"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8, y: -50 }}
        transition={{ 
          duration: 2.5,
          ease: "easeOut"
        }}
      >
        <motion.h1 
          className="cosmo-crush-title"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ 
            delay: 0.5,
            duration: 1.8,
            ease: "easeOut"
          }}
        >
          CosmoCrush
        </motion.h1>
        
        <motion.div
          className="navigation-links"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ 
            delay: 2,
            duration: 1.5,
            ease: "easeOut"
          }}
        >
          <Link to="/earth" className="earth-link">
            Enter the Cosmos
          </Link>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export default home