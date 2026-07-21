import * as THREE from "three";

const mat = (color, roughness = 0.82, emissive = 0x000000) =>
  new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity: 0.35 });

function mesh(geometry, material, cast = true) {
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = cast;
  item.receiveShadow = true;
  return item;
}

export function createSignal(position, scale = 1) {
  const group = new THREE.Group();
  group.position.copy(position);
  const pole = mesh(new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, 5.2 * scale, 8), mat(0x273434));
  pole.position.y = 2.6 * scale;
  group.add(pole);
  const head = mesh(new THREE.BoxGeometry(1.05 * scale, 2.5 * scale, 0.72 * scale), mat(0x183031));
  head.position.set(0, 5.5 * scale, 0);
  group.add(head);
  [0xe4533f, 0xf1bf42, 0x6abf69].forEach((color, index) => {
    const lamp = mesh(new THREE.SphereGeometry(0.29 * scale, 12, 8), mat(color, 0.5, color), false);
    lamp.position.set(0, (6.25 - index * 0.75) * scale, 0.39 * scale);
    group.add(lamp);
  });
  return group;
}

export function createStopSign(position, scale = 1) {
  const group = new THREE.Group();
  group.position.copy(position);
  const pole = mesh(new THREE.CylinderGeometry(0.09 * scale, 0.12 * scale, 3.8 * scale, 8), mat(0x55635f));
  pole.position.y = 1.9 * scale;
  group.add(pole);
  const sign = mesh(new THREE.CylinderGeometry(0.78 * scale, 0.78 * scale, 0.18 * scale, 8), mat(0xc84d40));
  sign.rotation.x = Math.PI / 2;
  sign.rotation.z = Math.PI / 8;
  sign.position.y = 4.25 * scale;
  group.add(sign);
  return group;
}

export function createTree(position, scale = 1) {
  const group = new THREE.Group();
  group.position.copy(position);
  const trunk = mesh(new THREE.CylinderGeometry(0.24 * scale, 0.34 * scale, 2.6 * scale, 8), mat(0x805d40));
  trunk.position.y = 1.3 * scale;
  group.add(trunk);
  [[0, 3.2, 0], [-0.65, 3.45, 0.15], [0.55, 3.65, -0.1]].forEach(([x, y, z], index) => {
    const crown = mesh(new THREE.SphereGeometry((1.15 - index * 0.08) * scale, 12, 8), mat(index === 1 ? 0x6b9b58 : 0x5d8b50));
    crown.position.set(x * scale, y * scale, z * scale);
    group.add(crown);
  });
  return group;
}

export function createZebra(position, angle = 0, width = 13, color = 0xf6f0cf) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = angle;
  for (let offset = -4.2; offset <= 4.2; offset += 1.4) {
    const stripe = mesh(new THREE.BoxGeometry(width, 0.09, 0.66), mat(color), false);
    stripe.position.set(0, 0.05, offset);
    group.add(stripe);
  }
  return group;
}

export function createHazardRing(position, status = "CONFIRMED") {
  const group = new THREE.Group();
  group.position.copy(position);
  const color = status === "CONFIRMED" ? 0xf04e3e : 0xf2a63b;
  const ring = mesh(new THREE.TorusGeometry(3.2, 0.28, 10, 36), mat(color, 0.5, color), false);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  ring.userData.pulse = true;
  group.add(ring);
  const pin = mesh(new THREE.SphereGeometry(0.62, 16, 10), mat(color, 0.5, color), false);
  pin.position.y = 3.3;
  group.add(pin);
  const stem = mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.7, 7), mat(color), false);
  stem.position.y = 1.9;
  group.add(stem);
  return group;
}

function createBeacon(position) {
  const group = createSignal(position, 0.82);
  group.children.slice(-3).forEach((child, index) => { child.visible = index === 1; });
  return group;
}

function createBulbouts(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  [[-5, -5], [5, -5], [-5, 5], [5, 5]].forEach(([x, z], index) => {
    const curb = mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.34, 24, 1, false, 0, Math.PI / 2), mat(0xe8ddc4));
    curb.position.set(x, 0.32, z);
    curb.rotation.y = index * Math.PI / 2;
    group.add(curb);
    const shrub = mesh(new THREE.SphereGeometry(0.7, 10, 7), mat(0x5f9157));
    shrub.scale.y = 0.75;
    shrub.position.set(x * 1.12, 0.8, z * 1.12);
    group.add(shrub);
  });
  return group;
}

function createCushions(position, angle = 0) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = angle;
  [-3.1, 0, 3.1].forEach((x) => {
    const cushion = mesh(new THREE.BoxGeometry(2.3, 0.36, 3.6), mat(0xe5bb32));
    cushion.position.set(x, 0.35, 0);
    cushion.rotation.x = -0.05;
    group.add(cushion);
  });
  return group;
}

function createBikeLane(position, angle = 0) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = angle;
  const lane = mesh(new THREE.BoxGeometry(3.2, 0.08, 34), mat(0x4aa778), false);
  lane.position.set(7.2, 0.14, 0);
  group.add(lane);
  for (let z = -14; z <= 14; z += 7) {
    const post = mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.8, 7), mat(0xf7eee0));
    post.position.set(5.55, 0.48, z);
    group.add(post);
  }
  return group;
}

export function createFixProp(fix, position) {
  switch (fix.type) {
    case "crosswalk": return createZebra(position, 0, 15);
    case "beacon": return createBeacon(position);
    case "signal": return createSignal(position, 1.05);
    case "cushions": return createCushions(position);
    case "bulbout": return createBulbouts(position);
    case "bike-lane": return createBikeLane(position);
    default: return new THREE.Group();
  }
}
