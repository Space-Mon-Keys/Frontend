import React, { useEffect, useRef, useState } from "react";

// IrisTransition: circle animation that expands or collapses for screen transition
// Props:
// - in: boolean, if transition is active (true = circle open, false = closed)
// - duration: animation duration in ms
// - color: background color of iris
// - children: content to show inside
// - onRest: callback when animation finishes
const IrisTransition = ({ in: inProp, duration = 700, color = "#181c24", children, onRest, style = {} }) => {
  const [show, setShow] = useState(inProp);
  const [renderChildren, setRenderChildren] = useState(inProp);
  const timeoutRef = useRef();

  useEffect(() => {
    if (inProp) {
      setShow(true);
      setRenderChildren(true);
    } else {
      // Wait for animation before hiding
      timeoutRef.current = setTimeout(() => {
        setShow(false);
        setRenderChildren(false);
        if (onRest) onRest();
      }, duration);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [inProp, duration, onRest]);

  // The circle covers the entire screen, scales from 0 (closed) to 1.5 (open)
  // We use a div with border-radius: 50% and transform: scale()
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