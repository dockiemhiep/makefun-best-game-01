// Responsive keyboard + mouse input controller mapped to 1280x720 logical coordinates.

import { ARENA } from './config.js';

export function createInputController(canvas) {
  const keysDown = new Set();
  const state = {
    aimX: ARENA.centerX + 140,
    aimY: ARENA.centerY - 60,
    firing: false,
    usingPointer: false,
    deployRequested: false,
    deployAimX: null,
    deployAimY: null,
    recallRequested: false,
    recallAimX: null,
    recallAimY: null,
    dashRequested: false,
    novaRequested: false,
    pauseRequested: false,
    muteRequested: false,
    restartRequested: false,
    confirmRequested: false,
    prismSelectRequested: null,
    cyclePrismRequested: 0,
  };

  function toLogicalCoords(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { x: ARENA.centerX, y: ARENA.centerY };
    }
    const x = ((clientX - rect.left) / rect.width) * ARENA.width;
    const y = ((clientY - rect.top) / rect.height) * ARENA.height;
    return {
      x: Math.max(0, Math.min(ARENA.width, x)),
      y: Math.max(0, Math.min(ARENA.height, y)),
    };
  }

  function onPointerMove(e) {
    const pt = toLogicalCoords(e.clientX, e.clientY);
    state.aimX = pt.x;
    state.aimY = pt.y;
    state.usingPointer = true;
  }

  function onMouseDown(e) {
    const pt = toLogicalCoords(e.clientX, e.clientY);
    state.aimX = pt.x;
    state.aimY = pt.y;
    state.usingPointer = true;
    if (e.button === 0) {
      state.firing = true;
    } else if (e.button === 2) {
      state.deployRequested = true;
      state.deployAimX = pt.x;
      state.deployAimY = pt.y;
    } else if (e.button === 1) {
      e.preventDefault();
      state.novaRequested = true;
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) {
      state.firing = false;
    }
  }

  function onWheel(e) {
    if (Math.abs(e.deltaY) > 4) {
      state.cyclePrismRequested += e.deltaY > 0 ? 1 : -1;
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  function onKeyDown(e) {
    if (e.isComposing || e.keyCode === 229) return;
    const target = e.target;
    const inMenu = Boolean(document.querySelector('#overlay-root button'));
    if (target?.matches?.('input, select, textarea') && e.code !== 'Escape' && e.code !== 'KeyP') return;
    if (inMenu && target?.closest?.('button') && (e.code === 'Enter' || e.code === 'Space')) return;
    const code = e.code;
    if (
      code === 'Space' ||
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      (code === 'Tab' && !inMenu)
    ) {
      e.preventDefault();
    }
    if (!keysDown.has(code)) {
      if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
        state.dashRequested = true;
      } else if (code === 'KeyE') {
        state.deployRequested = true;
        state.deployAimX = state.aimX;
        state.deployAimY = state.aimY;
      } else if (code === 'KeyQ') {
        state.recallRequested = true;
        state.recallAimX = state.aimX;
        state.recallAimY = state.aimY;
      } else if (code === 'KeyF') {
        state.novaRequested = true;
      } else if (code === 'KeyP' || code === 'Escape') {
        state.pauseRequested = true;
      } else if (code === 'KeyM') {
        state.muteRequested = true;
      } else if (code === 'KeyR') {
        state.restartRequested = true;
      } else if (code === 'Enter') {
        state.confirmRequested = true;
      } else if (code === 'Digit1') {
        state.prismSelectRequested = 0;
      } else if (code === 'Digit2') {
        state.prismSelectRequested = 1;
      } else if (code === 'Digit3') {
        state.prismSelectRequested = 2;
      } else if (code === 'Tab' && !inMenu) {
        state.cyclePrismRequested += 1;
      }
    }
    keysDown.add(code);
  }

  function onKeyUp(e) {
    keysDown.delete(e.code);
  }

  function onBlur() {
    keysDown.clear();
    state.firing = false;
  }

  canvas.addEventListener('mousemove', onPointerMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  function getMoveVector() {
    let dx = 0;
    let dy = 0;
    if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) dy -= 1;
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) dy += 1;
    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) dx -= 1;
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) dx += 1;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }
    return { dx, dy };
  }

  function isKeyHeldFire() {
    return keysDown.has('KeyJ') || keysDown.has('KeyK');
  }

  function consumeFrameActions() {
    const snapshot = {
      move: getMoveVector(),
      aimX: state.aimX,
      aimY: state.aimY,
      firing: state.firing || isKeyHeldFire(),
      deployPrism: state.deployRequested,
      deployAimX: state.deployAimX ?? state.aimX,
      deployAimY: state.deployAimY ?? state.aimY,
      recallPrism: state.recallRequested,
      recallAimX: state.recallAimX ?? state.aimX,
      recallAimY: state.recallAimY ?? state.aimY,
      dash: state.dashRequested,
      nova: state.novaRequested,
      pause: state.pauseRequested,
      mute: state.muteRequested,
      restart: state.restartRequested,
      confirm: state.confirmRequested,
      prismSelect: state.prismSelectRequested,
      cyclePrism: state.cyclePrismRequested,
    };
    state.deployRequested = false;
    state.deployAimX = null;
    state.deployAimY = null;
    state.recallRequested = false;
    state.recallAimX = null;
    state.recallAimY = null;
    state.dashRequested = false;
    state.novaRequested = false;
    state.pauseRequested = false;
    state.muteRequested = false;
    state.restartRequested = false;
    state.confirmRequested = false;
    state.prismSelectRequested = null;
    state.cyclePrismRequested = 0;
    return snapshot;
  }

  return {
    state,
    consumeFrameActions,
    toLogicalCoords,
  };
}
