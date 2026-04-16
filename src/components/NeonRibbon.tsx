import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import ribbonVertexShader from "../shaders/ribbon.vert";
import ribbonFragmentShader from "../shaders/ribbon.frag";
import type { MentalState } from "../hooks/useFatigueScore";

// Map mental state string to shader float: 0=Chill, 1=Focused, 2=Flow, 3=Frantic, 4=Critical
function mentalStateToFloat(state: MentalState): number {
  switch (state) {
    case "chill": return 0;
    case "focused": return 1;
    case "flow": return 2;
    case "frantic": return 3;
    case "critical": return 4;
  }
}

// Wave parameters per mental state
function getWaveParams(state: MentalState, score: number) {
  switch (state) {
    case "chill":
      return { freq: 0.8, speed: 0.25, amplitude: 0.3 };
    case "focused":
      return { freq: 1.5, speed: 0.5, amplitude: 0.4 };
    case "flow":
      // Fast but SMOOTH and aerodynamic — low frequency, high speed, medium amplitude
      return { freq: 1.2, speed: 1.0, amplitude: 0.35 };
    case "frantic":
      // CHAOTIC — high frequency, jagged, aggressive
      return { freq: 4.5, speed: 1.3, amplitude: 0.65 };
    case "critical":
      return { freq: 5.5, speed: 1.6, amplitude: 0.75 };
    default: {
      // Fallback: score-based interpolation
      const t = score;
      return {
        freq: 1.0 + t * 4.0,
        speed: 0.3 + t * 1.2,
        amplitude: 0.35 + t * 0.35,
      };
    }
  }
}

interface RibbonMeshProps {
  fatigueScore: number;
  mentalState: MentalState;
}

function RibbonMesh({ fatigueScore, mentalState }: RibbonMeshProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const smoothedRef = useRef({
    fatigue: 0,
    freq: 0.8,
    speed: 0.25,
    amplitude: 0.3,
    mentalState: 0,
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFrequency: { value: 0.8 },
      uSpeed: { value: 0.25 },
      uAmplitude: { value: 0.3 },
      uFatigue: { value: 0 },
      uMentalState: { value: 0 },
    }),
    []
  );

  useFrame((_, delta) => {
    if (!materialRef.current) return;

    const s = smoothedRef.current;
    const lerp = 1 - Math.pow(0.05, delta);

    const target = getWaveParams(mentalState, fatigueScore);
    const targetMentalFloat = mentalStateToFloat(mentalState);

    // Smooth interpolation
    s.fatigue += (fatigueScore - s.fatigue) * lerp;
    s.freq += (target.freq - s.freq) * lerp;
    s.speed += (target.speed - s.speed) * lerp;
    s.amplitude += (target.amplitude - s.amplitude) * lerp;
    s.mentalState += (targetMentalFloat - s.mentalState) * lerp;

    // Update uniforms
    materialRef.current.uniforms.uTime.value += delta;
    materialRef.current.uniforms.uFrequency.value = s.freq;
    materialRef.current.uniforms.uSpeed.value = s.speed;
    materialRef.current.uniforms.uAmplitude.value = s.amplitude;
    materialRef.current.uniforms.uFatigue.value = s.fatigue;
    materialRef.current.uniforms.uMentalState.value = s.mentalState;
  });

  return (
    <mesh rotation={[-0.3, 0, 0]} position={[0, -0.2, 0]}>
      <planeGeometry args={[8, 2.5, 128, 48]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={ribbonVertexShader}
        fragmentShader={ribbonFragmentShader}
        uniforms={uniforms}
        transparent={true}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

interface NeonRibbonProps {
  fatigueScore: number;
  mentalState: MentalState;
}

export default function NeonRibbon({ fatigueScore, mentalState }: NeonRibbonProps) {
  return (
    <div className="canvas-container">
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 100 } }}
      >
        <RibbonMesh fatigueScore={fatigueScore} mentalState={mentalState} />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            intensity={1.8}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
