// Tideglass: Night Shift — keyboard and mouse. Tracks held keys and the latest
// click in logical canvas coordinates, so the simulation never touches the DOM.
export class TideglassInput {
  constructor(canvas) {
    this.keys = new Set();
    this.click = null;
    this.canvas = canvas;
    this.onKey = null; // (code) => void, for menu keys the loop owns
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) {
        this.keys.add(event.code);
        if (this.onKey) this.onKey(event.code);
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (event) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      this.click = {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    });
  }

  moveVector() {
    let mx = 0;
    let my = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
    return { mx, my };
  }

  get grab() {
    return this.keys.has('KeyE');
  }

  takeClick() {
    const click = this.click;
    this.click = null;
    return click;
  }
}
