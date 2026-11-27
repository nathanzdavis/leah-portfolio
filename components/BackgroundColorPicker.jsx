'use client';

import { useEffect, useRef, useState } from 'react';

const themeColors = [
  ['Terracotta', '#d18966'], ['Charcoal', '#373838'], ['Text gray', '#606060'],
  ['Muted gray', '#818181'], ['Warm border', '#e3e1dc'], ['Warm cream', '#f1efec'],
  ['Light gray', '#f0f0f0'], ['White', '#ffffff'],
];
const defaultColor = '#ffffff';
const validHex = /^#[0-9a-f]{6}$/i;
const toHex = value => Math.round(value).toString(16).padStart(2, '0');

function initialHex(color) {
  if (validHex.test(color)) return color;
  const channels = /^rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/.exec(color);
  return channels ? `#${channels.slice(1).map(value => toHex(Number(value))).join('')}` : defaultColor;
}

function wheelColor(angle, radius, brightness) {
  const hue = (angle / (2 * Math.PI) + 1) % 1;
  return '#' + [5, 3, 1].map(channel => {
    const step = (channel + hue * 6) % 6;
    const intensity = 1 - radius * Math.max(0, Math.min(step, 4 - step, 1));
    return toHex(intensity * brightness * 255);
  }).join('');
}

export default function BackgroundColorPicker({ currentColor, onApply, onClose }) {
  const dialogRef = useRef(null);
  const wheelPoint = useRef(null);
  const [color, setColor] = useState(() => initialHex(currentColor));
  const [brightness, setBrightness] = useState(1);
  const preview = validHex.test(color) ? color : defaultColor;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  function chooseFromWheel(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 2 - 1;
    const y = (event.clientY - rect.top) / rect.height * 2 - 1;
    wheelPoint.current = [Math.atan2(x, -y), Math.min(1, Math.hypot(x, y))];
    setColor(wheelColor(...wheelPoint.current, brightness));
  }

  function chooseColor(value) {
    wheelPoint.current = null;
    setColor(value);
  }

  return (
    <dialog ref={dialogRef} className="modal background-picker" aria-labelledby="background-picker-title" onCancel={onClose}>
      <form onSubmit={event => { event.preventDefault(); if (validHex.test(color)) onApply(color); }}>
        <h2 id="background-picker-title">Background color</h2>
        <div className="background-picker-controls">
          <div className="background-wheel" aria-hidden="true" style={{ filter: `brightness(${brightness})` }}
            onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); chooseFromWheel(event); }}
            onPointerMove={event => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) chooseFromWheel(event);
            }} />
          <div className="background-picker-fields">
            <label>Wheel brightness<input type="range" min="0" max="100" value={Math.round(brightness * 100)} onChange={event => {
              const next = Number(event.target.value) / 100;
              setBrightness(next);
              if (wheelPoint.current) setColor(wheelColor(...wheelPoint.current, next));
            }} /></label>
            <label>Color picker<input type="color" value={preview} onChange={event => chooseColor(event.target.value)} /></label>
            <label>Hex color<input value={color} onChange={event => chooseColor(event.target.value)} maxLength={7} spellCheck={false} /></label>
          </div>
        </div>
        <fieldset className="background-swatches">
          <legend>Site colors</legend>
          {themeColors.map(([name, value]) => (
            <button key={value} type="button" aria-label={`${name} ${value}`} title={`${name} ${value}`}
              aria-pressed={color.toLowerCase() === value}
              style={{ backgroundColor: value }} onClick={() => chooseColor(value)} />
          ))}
        </fieldset>
        <div className="background-picker-actions">
          <button type="button" className="mini-button" onClick={() => onApply('transparent')}>Transparent</button>
          <button type="button" className="mini-button" onClick={onClose}>Cancel</button>
          <button className="tool-button" disabled={!validHex.test(color)}>Apply color</button>
        </div>
      </form>
    </dialog>
  );
}
