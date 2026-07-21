import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { createCity } from "./city.js";
import { attachOrbit } from "./orbit.js";

const Diorama = forwardRef(function Diorama({ data, remodeled }, ref) {
  const canvasRef = useRef(null);
  const cityRef = useRef(null);
  const runtimeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    capturePair() {
      const runtime = runtimeRef.current;
      if (!runtime) throw new Error("The 3D scene is still preparing.");
      const capture = (state) => {
        runtime.city.setRemodeled(state);
        runtime.renderer.render(runtime.scene, runtime.camera);
        return runtime.renderer.domElement.toDataURL("image/png");
      };
      const today = capture(false);
      const proposed = capture(true);
      runtime.city.setRemodeled(remodeled);
      runtime.renderer.render(runtime.scene, runtime.camera);
      return { today, proposed };
    },
  }), [remodeled]);

  useEffect(() => {
    cityRef.current?.setRemodeled(remodeled);
  }, [remodeled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return undefined;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbe7e0);
    scene.fog = new THREE.Fog(0xdbe7e0, 92, 190);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
    const orbit = attachOrbit(canvas, camera, new THREE.Vector3(0, 2, 0));

    const hemisphere = new THREE.HemisphereLight(0xfff6df, 0x546b67, 2.4);
    scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xffefd1, 4.2);
    sun.position.set(-45, 75, 35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    scene.add(sun);

    const city = createCity(data);
    city.setRemodeled(remodeled);
    cityRef.current = city;
    scene.add(city.root);
    runtimeRef.current = { renderer, scene, camera, city };

    let frame;
    const resize = () => {
      const width = canvas.clientWidth || 1;
      const height = canvas.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const render = (time) => {
      resize();
      orbit.update(true);
      city.animate(time);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      orbit.dispose();
      city.dispose();
      renderer.dispose();
      cityRef.current = null;
      runtimeRef.current = null;
    };
  }, [data]);

  return (
    <div className="diorama-surface">
      <canvas ref={canvasRef} className="diorama-canvas" aria-label="Interactive 3D model of the intersection" />
      {remodeled && (
        <div className="fix-reveal-labels" aria-live="polite">
          {(data.fixes || []).map((fix, index) => (
            <div className="fix-reveal-label" style={{ animationDelay: `${index * 350}ms` }} key={fix.id}>
              <b>+</b><span>{fix.title}</span><small>{fix.cost} · {fix.grant}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default Diorama;
