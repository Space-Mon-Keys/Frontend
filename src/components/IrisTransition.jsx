import React, { useEffect, useRef, useState } from "react";

// IrisTransition: animación de círculo que se expande o colapsa para transición de pantalla
// Props:
// - in: boolean, si la transición está activa (true = círculo abierto, false = cerrado)
// - duration: ms de duración de la animación
// - color: color del fondo del iris
// - children: contenido a mostrar dentro
// - onRest: callback cuando termina la animación
const IrisTransition = ({ in: inProp, duration = 700, color = "#181c24", children, onRest, style = {} }) => {
  const [show, setShow] = useState(inProp);
  const [renderChildren, setRenderChildren] = useState(inProp);
  const timeoutRef = useRef();

  useEffect(() => {
    if (inProp) {
      setShow(true);
      setRenderChildren(true);
    } else {
      // Espera la animación antes de ocultar
      timeoutRef.current = setTimeout(() => {
        setShow(false);
        setRenderChildren(false);
        if (onRest) onRest();
      }, duration);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [inProp, duration, onRest]);

  // El círculo cubre toda la pantalla, escala de 0 (cerrado) a 1.5 (abierto)
  // Usamos un div con border-radius: 50% y transform: scale()
  return (
    <div style={{
      position: style.position || "fixed",
      inset: style.inset || 0,
      zIndex: style.zIndex || 1000,
      width: '100%',
      height: '100%',
      pointerEvents: show ? "auto" : "none",
      transition: `background ${duration}ms`,
      background: show ? color : "transparent",
      display: show ? "flex" : "none",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "200vmax",
          height: "200vmax",
          minWidth: '100%',
          minHeight: '100%',
          background: color,
          borderRadius: "50%",
          transform: inProp ? "translate(-50%, -50%) scale(1.5)" : "translate(-50%, -50%) scale(0)",
          transition: `transform ${duration}ms cubic-bezier(0.7,0,0.3,1)`,
          boxShadow: inProp ? "0 0 0 9999px " + color : "none",
          zIndex: 1001,
        }}
      />
      {/* Renderiza los hijos solo cuando el círculo está abierto */}
      <div
        style={{
          position: "relative",
          zIndex: 1002,
          width: '100%',
          height: '100%',
          opacity: inProp ? 1 : 0,
          transition: `opacity ${duration / 2}ms ${inProp ? "200ms" : "0ms"}`,
          pointerEvents: inProp ? "auto" : "none",
        }}
      >
        {renderChildren && children}
      </div>
    </div>
  );
};

export default IrisTransition;