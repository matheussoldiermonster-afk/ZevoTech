import { useEffect } from "react";
import "./ZevoIntro.css";

export default function ZevoIntro({ onFinish, duration = 3200 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [onFinish, duration]);

  return (
    <div className="zevo-intro">

      <div className="zevo-intro-glow" />

      <img
        className="zevo-intro-logo"
        src="/zevo-logo-transparent.png"
        alt="Zevo Tech"
      />

      <div className="zevo-intro-status">
        <span>SISTEMA INICIANDO</span>
        <span className="zevo-intro-dots">•••</span>
      </div>

    </div>
  );
}