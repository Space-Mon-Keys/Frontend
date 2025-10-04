import React, { useState } from "react";
import "./scenarios.css";

const SCENARIOS = [
  {
    key: "city",
    name: "City",
    img: "https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80",
    desc: "Impact in a densely populated urban area."
  },
  {
    key: "countryside",
    name: "Countryside",
    img: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
    desc: "Impact in a rural or agricultural area."
  },
  {
    key: "ocean",
    name: "Ocean",
    img: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    desc: "Impact in the ocean and possible tsunamis."
  }
];

const Scenarios = ({ onSelect }) => {
  const [selected, setSelected] = useState(0);

  return (
    <div className="scenarios-container">
  <h2>Select a scenario</h2>
      <div className="scenarios-list">
        {SCENARIOS.map((s, idx) => (
          <div
            key={s.key}
            className={`scenario-card${selected === idx ? " selected" : ""}`}
            onClick={() => setSelected(idx)}
          >
            <img src={s.img} alt={s.name} className="scenario-img" />
            <div className="scenario-info">
              <h3>{s.name}</h3>
              <p>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <button className="select-btn" onClick={() => onSelect(SCENARIOS[selected])}>
        Simulate impact
      </button>
    </div>
  );
};

export default Scenarios;
