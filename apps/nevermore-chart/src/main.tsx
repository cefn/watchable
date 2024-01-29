import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function getDomElement(cssSelector: string) {
  const el = document.querySelector(`${cssSelector}`);
  if (el === null) {
    throw new Error(`No element matching '${cssSelector}'`);
  }
  return el;
}

ReactDOM.createRoot(getDomElement("#root")).render(
  // <React.StrictMode>
  //   <App />
  // </React.StrictMode>
  <App />
);
