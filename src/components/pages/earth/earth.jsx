import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import "./earth.css";


// --- Texture URLs (put your files in /public/textures and point these there) ---
// Example filenames you might download (Blue Marble / NASA / Natural Earth variants):
//   /textures/earth_daymap_4k.jpg
//   /textures/earth_specular_2k.jpg
//   /textures/earth_normal_2k.jpg    (optional)
//   /textures/earth_clouds_2k.png    (transparent PNG)
const TEX = {
  day: "/textures/earth_daymap_4k.jpg",        // set to "" to use a plain material fallback
  spec: "/textures/earth_specular_2k.jpg",     // optional
  normal: "/textures/earth_normal_2k.jpg",     // optional
  clouds: "/textures/earth_clouds_2k.png",     // optional (transparent)
  moon: "/textures/moon.jpg",               // optional moon texture
};

export default function EarthApp() {
  return (
    <motion.div 
      className="cosmo-earth-screen"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ 
        duration: 0.8,
        ease: "easeInOut"
      }}
    >
      <motion.header 
        className="cosmo-header"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          delay: 0.2,
          duration: 0.6,
          ease: "easeOut"
        }}
      >
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="cosmo-back-link"
          >
            ← Back to CosmoCrush
          </Link>
        </div>
      </motion.header>

      <motion.div 
        className="cosmo-content-wrapper"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          delay: 0.4,
          duration: 0.8,
          ease: "easeOut"
        }}
      >
        <motion.div 
          className="cosmo-title-section"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ 
            delay: 0.6,
            duration: 0.7,
            ease: "easeOut"
          }}
        >
          <h1 className="cosmo-earth-title">🌍 Asteroid Impact — 3D Earth</h1>
          <div className="cosmo-subtitle">Interactive Cosmic Simulation</div>
        </motion.div>

        <motion.main 
          className="cosmo-main"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            delay: 0.8,
            duration: 0.8,
            ease: "easeOut"
          }}
        >
          <motion.div 
            className="cosmo-canvas-container"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              delay: 1.0,
              duration: 0.6,
              ease: "easeOut"
            }}
          >
            <EarthCanvas />
          </motion.div>
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ 
              delay: 1.2,
              duration: 0.6,
              ease: "easeOut"
            }}
          >
            <ControlsPanel />
          </motion.div>
        </motion.main>
      </motion.div>
    </motion.div>
  );
}

function ControlsPanel() {
  const [tipsOpen, setTipsOpen] = useState(true);
  return (
    <aside className="cosmo-controls-panel">
      <h2 className="cosmo-panel-title">🎛️ Mission Control</h2>
      <ul className="cosmo-controls-list">
        <li>🌌 Drag to orbit, scroll to zoom, right-drag to pan</li>
        <li>⚡ Use controls to pause rotation, reset camera, or toggle stars</li>
        <li>🚀 Watch for collision effects between duck and Earth</li>
      </ul>
      <button
        onClick={() => setTipsOpen((v) => !v)}
        className="cosmo-tips-button"
      >
        {tipsOpen ? "Hide" : "Show"} space tips
      </button>
      {tipsOpen && (
        <div className="cosmo-tips-content">
          <p>
            🌤️ <strong>Atmospheric Effects:</strong> Cloud layers and specular mapping enhance Earth's realism.
          </p>
          <p>
            💥 <strong>Impact System:</strong> Collision detection triggers explosive visual and audio effects.
          </p>
          <p>
            ⭐ <strong>Cosmic Elements:</strong> Toggle stars, adjust orbits, and explore space dynamics.
          </p>
        </div>
      )}
    </aside>
  );
}

function EarthCanvas() {
  const containerRef = useRef(null);
  const cleanupRef = useRef(() => {});
  const updateOrbitLineRef = useRef(() => {});
  // Removed unused UI states (angle/orbit/line) and rely on guiRef
  const [semiMajorAxis, setSemiMajorAxis] = useState(3.5);
  const [semiMinorAxis, setSemiMinorAxis] = useState(3.0);
  const [orbitSpeed, setOrbitSpeed] = useState(0.3);
  const [collisionDetected, setCollisionDetected] = useState(false);
  // One-time collision flag (persists for the session)
  const hasCollidedOnceRef = useRef(false);
  // Track current collision state inside effect without adding hook deps
  const collisionActiveRef = useRef(false);

  const guiRef = useRef({
    autorotate: true,
    showStars: true,
    moonOrbit: true,
    showOrbitLine: false,
    moonAngle: 0, // Manual moon angle control
    // Elliptical orbit properties
    semiMajorAxis: 3.5,    // Semi-major axis (a) - furthest distance
    semiMinorAxis: 3.0,    // Semi-minor axis (b) - closest distance  
    eccentricity: 0.14,    // Eccentricity (0 = circle, closer to 1 = more elliptical)
    orbitSpeed: 0.3,       // Orbital speed multiplier
    orbitOffset: { x: 0, z: 0 }, // Orbit center offset from Earth
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = Math.max(420, Math.min(720, Math.floor((window.innerHeight * 0.7))));

  const scene = new THREE.Scene();
  scene.background = THREE.CubeTexture; // transparent, let CSS show through

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 200);
    camera.position.set(0, 0, 3.2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 3, 5);
    scene.add(dir);

    // Earth
    const radius = 1.0;
    const segments = 128;
    const earthGeo = new THREE.SphereGeometry(radius, segments, segments);

    const loader = new THREE.TextureLoader();


    // Earth materials
    const maps = {
      day: TEX.day ? loader.load(TEX.day) : null,
      spec: TEX.spec ? loader.load(TEX.spec) : null,
      normal: TEX.normal ? loader.load(TEX.normal) : null,
      moon: TEX.moon ? loader.load(TEX.moon) : null,
    };

    const earthMat = new THREE.MeshPhongMaterial({
      color: TEX.day ? 0xffffff : 0x4aa0ff, // fallback bluish if no texture
      map: maps.day || null,
      specularMap: maps.spec || null,
      normalMap: maps.normal || null,
      shininess: maps.spec ? 18 : 8,
    });

    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Optional clouds layer
    let clouds = null;
    if (TEX.clouds) {
      const cloudsTex = loader.load(TEX.clouds);
      const cloudsGeo = new THREE.SphereGeometry(radius * 1.01, segments, segments);
      const cloudsMat = new THREE.MeshPhongMaterial({
        map: cloudsTex,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
      });
      clouds = new THREE.Mesh(cloudsGeo, cloudsMat);
      scene.add(clouds);
    }

    // Rubber Duck (Moon replacement)
    let moon; // Will be set when model loads
    const gltfLoader = new GLTFLoader();
    
    // Option 1: Load a GLTF rubber duck model
    let textureURL= "models/Duck.glb"
    let objectSize = 0.15; // Scale factor for the duck model
    gltfLoader.load(
      textureURL, // Put your rubber duck model in /public/models/
      (gltf) => {
        moon = gltf.scene;        
        moon.scale.setScalar(objectSize); // Adjust size to match moon scale
        scene.add(moon);
        // Start duck at apogee (furthest point)
        moon.position.set(guiRef.current.semiMajorAxis, 0, 0);
      },
      (progress) => {
        console.log('Loading rubber duck:', (progress.loaded / progress.total * 100) + '% loaded');
      },
      (error) => {
        console.error('Error loading rubber duck:', error);
        // Fallback to a simple duck-colored sphere if model fails to load
        const moonRadius = 0.27;
        const moonGeo = new THREE.SphereGeometry(moonRadius, 32, 32);
        const moonMat = new THREE.MeshPhongMaterial({ 
          color: 0xffffff, // Duck yellow!
          shininess: 100 
        });
        moon = new THREE.Mesh(moonGeo, moonMat);
        scene.add(moon);
        moon.position.set(guiRef.current.semiMajorAxis, 0, 0);
      }
    );

    // Create orbit line (ellipse)
    const orbitPoints = [];
    const orbitSegments = 100;
    for (let i = 0; i <= orbitSegments; i++) {
      const t = (i / orbitSegments) * Math.PI * 2;
      const x = guiRef.current.semiMajorAxis * Math.cos(t);
      const z = guiRef.current.semiMinorAxis * Math.sin(t);
      orbitPoints.push(new THREE.Vector3(x, 0, z));
    }
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff, 
      opacity: 0.5, 
      transparent: true 
    });
    const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    orbitLine.visible = false; // Initially hidden
    scene.add(orbitLine);

    // Function to update orbit line when parameters change
    const updateOrbitLine = () => {
      const newOrbitPoints = [];
      const orbitSegments = 100;
      const offset = guiRef.current.orbitOffset || { x: 0, z: 0 };
      for (let i = 0; i <= orbitSegments; i++) {
        const t = (i / orbitSegments) * Math.PI * 2;
        const x = guiRef.current.semiMajorAxis * Math.cos(t) + offset.x;
        const z = guiRef.current.semiMinorAxis * Math.sin(t) + offset.z;
        newOrbitPoints.push(new THREE.Vector3(x, 0, z));
      }
      orbitLine.geometry.dispose();
      orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(newOrbitPoints);
    };
    
    // Store function in ref for UI access
    updateOrbitLineRef.current = updateOrbitLine;

    // Explosion effects
    const explosions = [];
    const explosionSize = 0.5;  // Change to 5000 for 5-second cooldown
    const createExplosion = (position) => {
      // Create explosion sprite with GIF texture
      const explosionTexture = loader.load('/effects/explosion.gif'); // Put your explosion GIF here
      const explosionMaterial = new THREE.SpriteMaterial({ 
        map: explosionTexture,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending // Makes it glow
      });
      const explosionSprite = new THREE.Sprite(explosionMaterial);
      explosionSprite.position.copy(position);
      explosionSprite.scale.setScalar(explosionSize); // Adjust size
      scene.add(explosionSprite);
      
      // Store explosion with timestamp for cleanup
      explosions.push({
        sprite: explosionSprite,
        startTime: Date.now(),
        duration: 1700 // 1.7 seconds to match GIF
      });
      
      console.log('💥 Explosion sprite created (will last 1.7 seconds)');
    };
    
    const playExplosionSound = () => {
      try {
        // Play explosion sound
        const audio = new Audio('/sounds/explosion.mp3'); // Put your sound file here
        audio.volume = 0.5; // Adjust volume (0.0 to 1.0)
        audio.loop = false; // Prevent looping!
        audio.currentTime = 0; // Start from beginning
        
        // Additional safeguards to prevent looping
        audio.addEventListener('ended', () => {
          console.log('💥 Explosion sound finished (3 seconds)');
          audio.pause();
          audio.currentTime = 0;
          audio.src = ''; // Clear the source to stop playback completely
        });
        
        // Force stop after 3 seconds as additional safety
        setTimeout(() => {
          if (!audio.paused) {
            console.log('🔇 Force stopping audio after 3 seconds');
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
          }
        }, 3000);
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('💥 Explosion sound started (will play for 3 seconds)');
            })
            .catch(e => {
              console.log('Audio play failed:', e);
            });
        }
        
        // Optional: Add screen shake effect
        const originalPosition = camera.position.clone();
        const shakeIntensity = 0.1;
        const shakeDuration = 1700; // 1.7 seconds to match explosion GIF
        let shakeInterval;
        
        const startShake = () => {
          const shakeStart = Date.now();
          
          shakeInterval = setInterval(() => {
            const elapsed = Date.now() - shakeStart;
            
            if (elapsed >= shakeDuration) {
              // Stop shaking and restore original position
              clearInterval(shakeInterval);
              camera.position.copy(originalPosition);
              console.log('📳 Screen shake finished (1.7 seconds)');
            } else {
              // Apply shake with diminishing intensity
              const progress = elapsed / shakeDuration;
              const intensity = shakeIntensity * (1 - progress); // Fade out
              camera.position.x = originalPosition.x + (Math.random() - 0.5) * intensity;
              camera.position.y = originalPosition.y + (Math.random() - 0.5) * intensity;
              camera.position.z = originalPosition.z + (Math.random() - 0.5) * intensity;
            }
          }, 16); // ~60fps
        };
        
        startShake();
      } catch (error) {
        console.log('Sound effect failed:', error);
      }
    };

    // Mouse interaction setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isDraggingMoon = false;
    let dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let dragPoint = new THREE.Vector3();

    const onMouseDown = (event) => {
      if (guiRef.current.moonOrbit) return; // Only allow dragging when orbit is off
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = moon ? raycaster.intersectObject(moon) : [];
      
      if (intersects.length > 0) {
  isDraggingMoon = true;
        controls.enabled = false; // Disable orbit controls while dragging
        // Note: We do NOT reset hasCollidedOnceRef here to keep it one-time-only
        
        // Calculate intersection with drag plane
        raycaster.ray.intersectPlane(dragPlane, dragPoint);
      }
    };

    const onMouseMove = (event) => {
      if (!isDraggingMoon || guiRef.current.moonOrbit) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      const newDragPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, newDragPoint)) {
        // Calculate new orbit center offset
        const newOffset = {
          x: newDragPoint.x,
          z: newDragPoint.z
        };
        
        guiRef.current.orbitOffset = newOffset;
        
        // Update orbit line to show new path
        updateOrbitLineRef.current();
        
        // Update moon position with new orbit parameters
        if (moon) {
          const a = guiRef.current.semiMajorAxis;
          const b = guiRef.current.semiMinorAxis;
          const angle = guiRef.current.moonAngle;
          const offset = guiRef.current.orbitOffset || { x: 0, z: 0 };
          moon.position.x = a * Math.cos(angle) + offset.x;
          moon.position.z = b * Math.sin(angle) + offset.z;
          moon.position.y = 0;
        }
      }
    };

    

    // Stars background group
    const starGroup = new THREE.Group();
    starGroup.visible = guiRef.current.showStars;
    scene.add(starGroup);

    function makeStars(count = 2000, spread = 60) {
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const r = spread * (0.6 + Math.random() * 0.4);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ size: 0.05, sizeAttenuation: true });
      const points = new THREE.Points(geo, mat);
      return points;
    }

    let stars = makeStars();
    starGroup.add(stars);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = true;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;

    // Simple UI hooks via DOM (buttons live outside, so we use events)
    const onToggleRotate = () => (guiRef.current.autorotate = !guiRef.current.autorotate);
    const onToggleOrbit = () => (guiRef.current.moonOrbit = !guiRef.current.moonOrbit);
    const onToggleStars = () => {
      guiRef.current.showStars = !guiRef.current.showStars;
      starGroup.visible = guiRef.current.showStars;
    };
    const onToggleOrbitLine = () => {
      guiRef.current.showOrbitLine = !guiRef.current.showOrbitLine;
      orbitLine.visible = guiRef.current.showOrbitLine;
    };
    const onReset = () => {
      camera.position.set(0, 0, 3.2);
      controls.target.set(0, 0, 0);
      controls.update();
    };

    document.addEventListener("earth-toggle-rotate", onToggleRotate);
    document.addEventListener("moon-toggle-orbit", onToggleOrbit);
    document.addEventListener("earth-toggle-stars", onToggleStars);
    document.addEventListener("moon-toggle-orbit-line", onToggleOrbitLine);
    document.addEventListener("earth-reset-camera", onReset);

    // Mouse events for dragging the duck
    const onMouseUp = () => {
      if (isDraggingMoon) {
        isDraggingMoon = false;
        controls.enabled = true;
        hasCollidedOnceRef.current = false; // Reset collision flag for next drag

        
      }
    };
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Resize handler
    const onResize = () => {
      const w = container.clientWidth;
      const h = Math.max(420, Math.min(720, Math.floor((window.innerHeight * 0.7))));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Animation loop
    let raf = 0;
    const clock = new THREE.Clock();

    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      if(guiRef.current.moonOrbit) {
        // Elliptical orbit calculation
        const angleIncrement = dt * guiRef.current.orbitSpeed;
        guiRef.current.moonAngle += angleIncrement;
        
        // Ellipse parameters
        const a = guiRef.current.semiMajorAxis;  // Semi-major axis
        const b = guiRef.current.semiMinorAxis;  // Semi-minor axis
        const angle = guiRef.current.moonAngle;
        
        // Parametric ellipse equations with offset
        // x = a * cos(t), z = b * sin(t)
        if (moon) {
          const offset = guiRef.current.orbitOffset || { x: 0, z: 0 };
          moon.position.x = a * Math.cos(angle) + offset.x;
          moon.position.z = b * Math.sin(angle) + offset.z;
          moon.position.y = 0; // Keep moon in Earth's orbital plane
        }
        
        // Update the angle state for the slider
        // keep angle in range for numeric stability
        const twoPi = Math.PI * 2;
        if (guiRef.current.moonAngle > twoPi || guiRef.current.moonAngle < -twoPi) {
          guiRef.current.moonAngle = guiRef.current.moonAngle % twoPi;
        }
      } else {
        // Manual angle control - also elliptical
        if (moon) {
          const a = guiRef.current.semiMajorAxis;
          const b = guiRef.current.semiMinorAxis;
          const angle = guiRef.current.moonAngle;
          const offset = guiRef.current.orbitOffset || { x: 0, z: 0 };
          moon.position.x = a * Math.cos(angle) + offset.x;
          moon.position.z = b * Math.sin(angle) + offset.z;
          moon.position.y = 0;
        }
      }

      if (guiRef.current.autorotate) {
        earth.rotation.y += dt * 0.2; // ~12 deg/sec
        if (moon) moon.rotation.y += dt * 0.1; // ~6 deg/sec

        if (clouds) clouds.rotation.y += dt * 0.25;
      }

      // Update and cleanup explosions
      const currentTime = Date.now();
      for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];
        const elapsed = currentTime - explosion.startTime;
        
        if (elapsed > explosion.duration) {
          // Remove expired explosion
          console.log('🧹 Removing explosion sprite after 1.7 seconds');
          scene.remove(explosion.sprite);
          explosion.sprite.material.dispose();
          explosions.splice(i, 1);
        } else {
          // Fade out explosion
          const progress = elapsed / explosion.duration;
          explosion.sprite.material.opacity = 1 - progress;
          // Optional: Scale up during explosion
          const scale = 0.5 + progress * 0.5;
          explosion.sprite.scale.setScalar(scale);
        }
      }
      
      // Collision detection — one-time only
      if (moon && earth) {
        const earthRadius = 1.0;
        const duckRadius = 0.15; // Approximate duck size
        const threshold = earthRadius + duckRadius;
        const distance = moon.position.distanceTo(earth.position);

        if (!hasCollidedOnceRef.current && distance < threshold) {
          console.log('🦆💥 DUCK COLLISION WITH EARTH! (one-time)');
          hasCollidedOnceRef.current = true;
          collisionActiveRef.current = true;
          setCollisionDetected(true);
          guiRef.current.moonOrbit = false;
          createExplosion(moon.position.clone());
          playExplosionSound();
        } else if (collisionActiveRef.current && distance >= threshold) {
          collisionActiveRef.current = false;
          setCollisionDetected(false);
        }
      } else if (collisionActiveRef.current) {
        collisionActiveRef.current = false;
        setCollisionDetected(false);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    // Kick off the render loop
    animate();

    // Cleanup function
    cleanupRef.current = () => {
      if (raf) cancelAnimationFrame(raf);

      document.removeEventListener("earth-toggle-rotate", onToggleRotate);
      document.removeEventListener("moon-toggle-orbit", onToggleOrbit);
      document.removeEventListener("earth-toggle-stars", onToggleStars);
      document.removeEventListener("moon-toggle-orbit-line", onToggleOrbitLine);
      document.removeEventListener("earth-reset-camera", onReset);

      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);

      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material?.dispose?.();
        }
      });
    };

    return () => cleanupRef.current();
  }, []);

  // UI Buttons dispatch DOM events consumed in the effect
  const dispatch = (type) => document.dispatchEvent(new Event(type));

  return (
    <div className="relative" ref={containerRef}>
      <div className="cosmo-control-buttons">
        <button
          onClick={() => dispatch("earth-toggle-rotate")}
          className="cosmo-button"
        >
          🔄 Rotate
        </button>
        <button
          onClick={() => dispatch("moon-toggle-orbit")}
          className="cosmo-button"
        >
          🛸 Orbit
        </button>
        <button
          onClick={() => dispatch("earth-reset-camera")}
          className="cosmo-button"
        >
          📷 Reset
        </button>
        <button
          onClick={() => dispatch("earth-toggle-stars")}
          className="cosmo-button"
        >
          ⭐ Stars
        </button>
        
        <button
          onClick={() => dispatch("moon-toggle-orbit-line")}
          className="cosmo-button"
        >
          🛤️ Path
        </button>
      </div>
      
      {/* Orbit Control Sliders */}
      <div className="cosmo-orbit-panel">
        <h3 className="cosmo-orbit-title">🛰️ Orbital Mechanics</h3>
        
        {/* Semi-Major Axis Slider */}
        <div>
          <label className="block text-xs text-white mb-1">Semi-Major Axis: {semiMajorAxis.toFixed(1)}</label>
          <input
            type="range"
            min="2.0"
            max="6.0"
            step="0.1"
            value={semiMajorAxis}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              setSemiMajorAxis(newValue);
              guiRef.current.semiMajorAxis = newValue;
              updateOrbitLineRef.current();
            }}
            className="w-32 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        {/* Semi-Minor Axis Slider */}
        <div>
          <label className="block text-xs text-white mb-1">Semi-Minor Axis: {semiMinorAxis.toFixed(1)}</label>
          <input
            type="range"
            min="1.5"
            max="5.0"
            step="0.1"
            value={semiMinorAxis}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              setSemiMinorAxis(newValue);
              guiRef.current.semiMinorAxis = newValue;
              updateOrbitLineRef.current();
            }}
            className="w-32 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        {/* Orbit Speed Slider */}
        <div>
          <label className="block text-xs text-white mb-1">Orbit Speed: {orbitSpeed.toFixed(2)}x</label>
          <input
            type="range"
            min="0.05"
            max="1.0"
            step="0.05"
            value={orbitSpeed}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              setOrbitSpeed(newValue);
              guiRef.current.orbitSpeed = newValue;
            }}
            className="w-32 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        {/* Eccentricity Display */}
        <div className="text-xs text-white/70 mt-2">
          Eccentricity: {Math.sqrt(1 - Math.pow(Math.min(semiMinorAxis, semiMajorAxis) / Math.max(semiMinorAxis, semiMajorAxis), 2)).toFixed(3)}
        </div>
        
        {/* Collision Status */}
        {collisionDetected && (
          <div className="collision-indicator">
            🦆💥 IMPACT DETECTED!
          </div>
        )}
      </div>
      
      {/* Renderer canvas is injected here */}
      <div className="w-full h-full" />
    </div>
  );
}

  // (Removed unused latLngToVector3 helper to satisfy lint rules)
