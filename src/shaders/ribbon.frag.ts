// Fragment Shader: color gradient driven by fatigue score + mental state
// uMentalState mapping: 0=Chill, 1=Focused, 2=Flow, 3=Frantic, 4=Critical

const ribbonFragmentShader = /* glsl */ `
uniform float uFatigue;
uniform float uTime;
uniform float uMentalState;

varying vec2 vUv;
varying float vDisplacement;
varying float vElevation;

void main() {
  // ── Color palette ──
  vec3 royalBlue  = vec3(0.255, 0.412, 0.882);   // #4169E1
  vec3 neonCyan   = vec3(0.0, 1.0, 1.0);           // #00FFFF
  vec3 neonGreen  = vec3(0.0, 1.0, 0.533);         // #00FF88
  vec3 emerald    = vec3(0.2, 0.8, 0.6);            // Flow accent
  vec3 neonPurple = vec3(0.545, 0.0, 1.0);         // #8B00FF
  vec3 neonMagenta= vec3(1.0, 0.0, 1.0);           // #FF00FF
  vec3 neonRed    = vec3(1.0, 0.2, 0.2);            // Frantic red
  vec3 amber      = vec3(1.0, 0.72, 0.0);           // Focused warm

  // ── Determine base color by mental state ──
  vec3 baseColor;
  vec3 accentColor;

  // Chill: Royal Blue → Cyan (original calm)
  vec3 chillBase   = mix(royalBlue, neonCyan, vUv.x * 0.7 + vElevation * 0.3);
  // Focused: Blue → warm Amber
  vec3 focusedBase = mix(royalBlue, amber, vUv.x * 0.5 + vElevation * 0.3);
  // Flow: Emerald → Neon Cyan (fast, smooth, aerodynamic)
  vec3 flowBase    = mix(emerald, neonCyan, vUv.x * 0.6 + vElevation * 0.4);
  // Frantic: Neon Purple → Red (chaotic, hot)
  vec3 franticBase = mix(neonPurple, neonRed, vUv.x * 0.6 + vElevation * 0.4);
  // Critical: Purple → Magenta (original stress, maxed out)
  vec3 critBase    = mix(neonPurple, neonMagenta, vUv.x * 0.6 + vElevation * 0.4);

  // Smoothly blend based on mental state uniform
  // 0=Chill, 1=Focused, 2=Flow, 3=Frantic, 4=Critical
  float s = uMentalState;

  if (s < 1.0) {
    baseColor = mix(chillBase, focusedBase, smoothstep(0.0, 1.0, s));
  } else if (s < 2.0) {
    baseColor = mix(focusedBase, flowBase, smoothstep(1.0, 2.0, s));
  } else if (s < 3.0) {
    baseColor = mix(flowBase, franticBase, smoothstep(2.0, 3.0, s));
  } else {
    baseColor = mix(franticBase, critBase, smoothstep(3.0, 4.0, s));
  }

  vec3 finalColor = baseColor;

  // ── Shimmer effect ──
  float shimmerSpeed = 2.0 + uFatigue * 3.0;
  float shimmerFreq = 20.0 + uFatigue * 15.0;
  float shimmer = sin(vUv.x * shimmerFreq + uTime * shimmerSpeed) * 0.5 + 0.5;
  finalColor += shimmer * 0.08 * (1.0 + uFatigue);

  // ── Flow state: extra smooth luminance pulse ──
  if (s >= 1.5 && s < 2.5) {
    float flowPulse = sin(uTime * 1.5 + vUv.x * 3.0) * 0.5 + 0.5;
    finalColor += flowPulse * 0.12 * neonGreen;
  }

  // ── Frantic state: flickering noise ──
  if (s >= 2.5 && s < 3.5) {
    float flicker = fract(sin(dot(vUv * uTime * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
    finalColor += flicker * 0.1 * neonRed;
  }

  // ── Edge glow ──
  float edgeFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
  float edgeGlow = 1.0 - edgeFade;

  // Edge color matches current state
  vec3 glowColor = mix(neonCyan, neonMagenta, uFatigue);
  if (s >= 1.5 && s < 2.5) glowColor = neonGreen;
  if (s >= 2.5 && s < 3.5) glowColor = neonRed;

  finalColor += edgeGlow * 0.25 * glowColor;

  // ── Alpha ──
  float alpha = edgeFade * 0.85 + edgeGlow * 0.5;
  alpha *= 0.9;

  // Brightness boost for bloom
  finalColor *= 1.3;

  gl_FragColor = vec4(finalColor, alpha);
}
`;

export default ribbonFragmentShader;
