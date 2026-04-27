import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;

uniform float u_time;
uniform vec2 u_mouse;
uniform vec2 u_resolution;

#define PI 3.14159265359

// Simplex noise
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / min(u_resolution.x, u_resolution.y);
  
  vec2 mouse = u_mouse * 0.15;
  float t = u_time * 0.3;
  
  float n1 = snoise(uv * 2.0 + mouse + t * 0.2);
  float n2 = snoise(uv * 3.0 - mouse * 0.5 - t * 0.15);
  float n3 = snoise(uv * 1.5 + vec2(t * 0.1, -t * 0.1));
  
  float plasma = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
  plasma = plasma * 0.5 + 0.5;
  
  float dist = length(uv);
  float radial = 1.0 - smoothstep(0.0, 1.2, dist);
  
  float intensity = plasma * radial * 1.5;
  
  vec3 core = vec3(1.0, 0.1, 0.2);
  vec3 mid = vec3(0.4, 0.02, 0.08);
  vec3 edge = vec3(0.012, 0.012, 0.015);
  
  vec3 color = mix(edge, mid, smoothstep(0.0, 0.3, intensity));
  color = mix(color, core, smoothstep(0.3, 0.7, intensity));
  
  float centerGlow = exp(-dist * dist * 3.0) * 0.3;
  color += vec3(0.86, 0.08, 0.24) * centerGlow;
  
  gl_FragColor = vec4(color, 1.0);
}
`

function PlasmaPlane() {
  const meshRef = useRef<THREE.Mesh>(null)
  const mouseTarget = useRef(new THREE.Vector2(0, 0))
  const mouseCurrent = useRef(new THREE.Vector2(0, 0))
  const { size } = useThree()

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(0, 0) },
      u_resolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    []
  )

  useFrame(({ clock, pointer }) => {
    if (!meshRef.current) return
    const mat = meshRef.current.material as THREE.ShaderMaterial
    mat.uniforms.u_time.value = clock.getElapsedTime()

    mouseTarget.current.set(pointer.x, pointer.y)
    mouseCurrent.current.x += (mouseTarget.current.x - mouseCurrent.current.x) * 0.05
    mouseCurrent.current.y += (mouseTarget.current.y - mouseCurrent.current.y) * 0.05

    mat.uniforms.u_mouse.value.set(mouseCurrent.current.x, mouseCurrent.current.y)
    mat.uniforms.u_resolution.value.set(size.width * 2, size.height * 2)
  })

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  )
}

export default function RadialPlasma() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      <Canvas
        orthographic
        camera={{ zoom: 1, position: [0, 0, 1], near: 0, far: 10 }}
        gl={{ antialias: false, alpha: false }}
        style={{ width: '100%', height: '100%' }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
      >
        <PlasmaPlane />
      </Canvas>
    </div>
  )
}
