import * as THREE from "three";
import { createFixProp, createHazardRing, createSignal, createStopSign, createTree, createZebra } from "./props.js";

const ROAD_WIDTHS = { primary: 15, secondary: 13, tertiary: 11, residential: 9, service: 5.5 };
const BUILDING_COLORS = [0xe7a779, 0xedd1aa, 0xa9c6bd, 0xd9afbf, 0xb8c5d6, 0xf0c47c, 0xc3bbd9];
const ZONE_OFFSETS = {
  "NW corner": [-14, -14], "NE corner": [14, -14], "SW corner": [-14, 14], "SE corner": [14, 14],
  "north crosswalk": [0, -12], "south crosswalk": [0, 12], "east crosswalk": [12, 0], "west crosswalk": [-12, 0],
  "center of intersection": [0, 0], "north approach": [0, -25], "south approach": [0, 25],
  "east approach": [25, 0], "west approach": [-25, 0],
};

const material = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });

export function projectPoint(point, center) {
  const lat = Number(point.lat);
  const lon = Number(point.lon);
  const x = (lon - center.lng) * 111320 * Math.cos(center.lat * Math.PI / 180);
  const z = -(lat - center.lat) * 110540 || 0;
  return new THREE.Vector3(x, 0, z);
}

function hashNumber(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return Math.abs(hash >>> 0);
}

function addSegment(group, a, b, width, color, y = 0.18) {
  const length = a.distanceTo(b);
  if (length < 0.25) return;
  const item = new THREE.Mesh(new THREE.BoxGeometry(width, 0.28, length + 0.35), material(color));
  item.position.copy(a).lerp(b, 0.5);
  item.position.y = y;
  item.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  item.receiveShadow = true;
  group.add(item);
}

function addRoad(group, way, center) {
  const geometry = (way.geometry || []).map((point) => projectPoint(point, center));
  if (geometry.length < 2) return;
  const kind = way.tags?.highway || "residential";
  const footway = ["footway", "path", "pedestrian"].includes(kind);
  const indoor = way.tags?.indoor === "yes" || Number(way.tags?.layer) < 0;
  if (indoor) return;
  const width = footway ? 2.6 : (ROAD_WIDTHS[kind] || 7);
  const color = footway ? 0xd7c9aa : 0x45565a;
  for (let i = 1; i < geometry.length; i += 1) addSegment(group, geometry[i - 1], geometry[i], width, color, footway ? 0.2 : 0.16);
  geometry.forEach((point) => {
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(width / 2, width / 2, 0.29, 18), material(color));
    joint.position.copy(point);
    joint.position.y = footway ? 0.2 : 0.16;
    joint.receiveShadow = true;
    group.add(joint);
  });

  if (!footway) {
    for (let i = 1; i < geometry.length; i += 1) {
      const a = geometry[i - 1];
      const b = geometry[i];
      const length = a.distanceTo(b);
      const direction = b.clone().sub(a).normalize();
      for (let d = 5; d < length; d += 8) {
        const start = a.clone().add(direction.clone().multiplyScalar(d));
        const end = a.clone().add(direction.clone().multiplyScalar(Math.min(d + 3.2, length)));
        addSegment(group, start, end, 0.22, 0xf1e9d0, 0.34);
      }
    }
  }
}

function addBuilding(group, way, center) {
  const points = (way.geometry || []).map((point) => projectPoint(point, center));
  if (points.length < 4) return;
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, -points[0].z);
  points.slice(1).forEach((point) => shape.lineTo(point.x, -point.z));
  const levels = Number.parseFloat(way.tags?.["building:levels"]);
  const taggedHeight = Number.parseFloat(way.tags?.height);
  const height = Number.isFinite(taggedHeight) ? taggedHeight : Number.isFinite(levels) ? levels * 3.3 : 7 + (hashNumber(way.id) % 12);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.min(height, 28), bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12 });
  geometry.rotateX(-Math.PI / 2);
  const building = new THREE.Mesh(geometry, material(BUILDING_COLORS[hashNumber(way.id) % BUILDING_COLORS.length]));
  building.position.y = 0.34;
  building.castShadow = true;
  building.receiveShadow = true;
  group.add(building);
}

function zonePosition(zone) {
  const [x, z] = ZONE_OFFSETS[zone] || [0, 0];
  return new THREE.Vector3(x, 0.35, z);
}

function disposeGroup(group) {
  group.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose?.());
    else object.material?.dispose?.();
  });
}

export function createCity(data) {
  const root = new THREE.Group();
  const base = new THREE.Group();
  const today = new THREE.Group();
  const remodeled = new THREE.Group();
  root.add(base, today, remodeled);
  remodeled.visible = false;

  const grass = new THREE.Mesh(new THREE.CylinderGeometry(72, 72, 2.4, 64), material(0xabc699));
  grass.position.y = -1.15;
  grass.receiveShadow = true;
  base.add(grass);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(71.6, 1.2, 10, 64), material(0x6f8a69));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.5;
  base.add(rim);

  const elements = data.geometry?.elements || [];
  elements.filter((item) => item.type === "way" && item.tags?.highway).forEach((way) => addRoad(base, way, data.location));
  elements.filter((item) => item.type === "way" && item.tags?.building).forEach((way) => addBuilding(base, way, data.location));
  elements.filter((item) => item.type === "node").forEach((node) => {
    const position = projectPoint(node, data.location);
    if (node.tags?.highway === "traffic_signals") base.add(createSignal(position, 0.72));
    if (node.tags?.highway === "stop") base.add(createStopSign(position, 0.72));
    if (node.tags?.highway === "crossing" && node.tags?.["crossing:markings"] !== "no") {
      const angle = Math.abs(position.x) > Math.abs(position.z) ? Math.PI / 2 : 0;
      base.add(createZebra(position, angle, 12, 0xded8c9));
    }
  });

  [[-52, -35, 1], [-58, 18, 0.9], [-39, 50, 1.1], [48, 43, 0.95], [55, -25, 1.05]].forEach(([x, z, scale]) => {
    base.add(createTree(new THREE.Vector3(x, 0.25, z), scale));
  });

  (data.findings || []).forEach((finding) => today.add(createHazardRing(zonePosition(finding.zone), finding.status)));
  (data.fixes || []).forEach((fix, index) => {
    const prop = createFixProp(fix, zonePosition(fix.zone));
    prop.userData.revealIndex = index;
    remodeled.add(prop);
  });

  let revealStartedAt = 0;
  const hasFatalRecord = (data.summary?.fatalCount || 0) > 0;

  return {
    root,
    today,
    remodeled,
    setRemodeled(value) {
      today.visible = !value;
      remodeled.visible = value;
      if (value) {
        revealStartedAt = performance.now();
        remodeled.children.forEach((child) => child.scale.setScalar(0.001));
      }
      if (hasFatalRecord) {
        rim.material.color.setHex(value ? 0x3d8862 : 0xb64c3e);
        rim.material.emissive.setHex(value ? 0x3d8862 : 0xb64c3e);
        rim.material.emissiveIntensity = 0.18;
      }
    },
    animate(time) {
      today.traverse((object) => {
        if (object.userData.pulse) {
          const scale = 1 + Math.sin(time * 0.004) * 0.12;
          object.scale.setScalar(scale);
        }
      });
      remodeled.traverse((object) => {
        if (object.material?.emissiveIntensity) object.material.emissiveIntensity = 0.25 + Math.sin(time * 0.003) * 0.08;
      });
      if (remodeled.visible) {
        remodeled.children.forEach((child) => {
          const elapsed = time - revealStartedAt - child.userData.revealIndex * 350;
          const progress = THREE.MathUtils.clamp(elapsed / 420, 0, 1);
          const shifted = progress - 1;
          const scale = progress === 0 ? 0.001 : 1 + 2.70158 * shifted ** 3 + 1.70158 * shifted ** 2;
          child.scale.setScalar(scale);
        });
      }
    },
    dispose: () => disposeGroup(root),
  };
}
