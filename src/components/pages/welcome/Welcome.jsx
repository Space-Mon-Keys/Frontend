import React from "react";
import "./welcome.css";

const Welcome = ({ onStart }) => (
  <div className="welcome-container">
    <div className="welcome-content">
      <h1>Meteor Madness - Impact Simulator</h1>
      <p className="solution-text">
        Our solution focuses on visualizing meteorite impacts and their consequences in different terrestrial scenarios. Using real data from asteroids, earthquakes, and elevation maps, we simulate possible impact zones and show their effects on population and environment. The platform allows users to explore scenarios and better understand the risks associated with impacts, facilitating decision-making and emergency preparedness.
      </p>
      <button className="start-btn" onClick={onStart}>Explore scenarios</button>
    </div>
  </div>
);

export default Welcome;
