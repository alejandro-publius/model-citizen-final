import * as THREE from "three";

export function attachOrbit(canvas, camera, target = new THREE.Vector3(0, 0, 0)) {
  let radius = 96;
  let theta = -0.7;
  let phi = 0.96;
  let dragging = false;
  let previous = { x: 0, y: 0 };
  let pinchDistance = 0;
  let idleAt = performance.now();

  const update = (autoRotate = false) => {
    if (autoRotate && !dragging && performance.now() - idleAt > 2200) theta += 0.0007;
    const sinPhi = Math.sin(phi);
    camera.position.set(
      target.x + radius * sinPhi * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * sinPhi * Math.cos(theta),
    );
    camera.lookAt(target);
  };

  const pointerDown = (event) => {
    dragging = true;
    previous = { x: event.clientX, y: event.clientY };
    idleAt = performance.now();
    canvas.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event) => {
    if (!dragging) return;
    theta -= (event.clientX - previous.x) * 0.008;
    phi = THREE.MathUtils.clamp(phi + (event.clientY - previous.y) * 0.006, 0.34, 1.42);
    previous = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = () => {
    dragging = false;
    idleAt = performance.now();
  };
  const wheel = (event) => {
    event.preventDefault();
    radius = THREE.MathUtils.clamp(radius + event.deltaY * 0.08, 42, 165);
    idleAt = performance.now();
  };
  const touchMove = (event) => {
    if (event.touches.length !== 2) return;
    const [a, b] = event.touches;
    const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinchDistance) radius = THREE.MathUtils.clamp(radius + (pinchDistance - distance) * 0.12, 42, 165);
    pinchDistance = distance;
    idleAt = performance.now();
  };
  const touchEnd = () => { pinchDistance = 0; };

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("touchmove", touchMove, { passive: true });
  canvas.addEventListener("touchend", touchEnd);
  update();

  return {
    update,
    dispose() {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("touchmove", touchMove);
      canvas.removeEventListener("touchend", touchEnd);
    },
  };
}
