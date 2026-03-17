/**
 * Galaxy Orb shader material + component — animated cosmic sphere for the move handle.
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

const BALL_R = 30

const GalaxyOrbShader = shaderMaterial(
  { uTime: 0 },
  /* vertex */ `
    varying vec3 vPos;
    varying vec3 vNorm;
    varying vec2 vUv;
    uniform float uTime;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 perm(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    float noise(vec3 p) {
      vec3 a = floor(p);
      vec3 d = p - a;
      d = d*d*(3.0-2.0*d);
      vec4 b = a.xxyy + vec4(0,1,0,1);
      vec4 k1 = perm(b.xyxy);
      vec4 k2 = perm(k1.xyxy + b.zzww);
      vec4 c = k2 + a.zzzz;
      vec4 k3 = perm(c);
      vec4 k4 = perm(c + 1.0);
      vec4 o1 = fract(k3 * (1.0/41.0));
      vec4 o2 = fract(k4 * (1.0/41.0));
      vec4 o3 = o2*d.z + o1*(1.0-d.z);
      vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
      return o4.y*d.y + o4.x*(1.0-d.y);
    }

    void main() {
      vPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vNorm = normalize(normalMatrix * normal);
      vUv = uv;
      float n = noise(position * 3.0 + uTime * 0.8) * 0.15;
      vec3 displaced = position + normal * n;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  /* fragment */ `
    varying vec3 vPos;
    varying vec3 vNorm;
    varying vec2 vUv;
    uniform float uTime;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 perm(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    float noise(vec3 p) {
      vec3 a = floor(p);
      vec3 d = p - a;
      d = d*d*(3.0-2.0*d);
      vec4 b = a.xxyy + vec4(0,1,0,1);
      vec4 k1 = perm(b.xyxy);
      vec4 k2 = perm(k1.xyxy + b.zzww);
      vec4 c = k2 + a.zzzz;
      vec4 k3 = perm(c);
      vec4 k4 = perm(c + 1.0);
      vec4 o1 = fract(k3 * (1.0/41.0));
      vec4 o2 = fract(k4 * (1.0/41.0));
      vec4 o3 = o2*d.z + o1*(1.0-d.z);
      vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
      return o4.y*d.y + o4.x*(1.0-d.y);
    }

    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      float angle = atan(vPos.x, vPos.z) + uTime * 1.2;
      float radius = length(vPos.xz);
      vec3 noiseCoord = vec3(radius * 3.0, angle * 0.5, uTime * 0.4);
      float n = fbm(noiseCoord);
      float n2 = fbm(noiseCoord + vec3(5.0, 3.0, 1.0));

      vec3 voidBlack = vec3(0.04, 0.04, 0.04);
      vec3 darkGreen = vec3(0.15, 0.4, 0.0);
      vec3 limeGreen = vec3(0.67, 1.0, 0.0);
      vec3 electricBlue = vec3(0.27, 0.53, 1.0);
      vec3 brightGreen = vec3(0.8, 1.0, 0.27);

      vec3 col = mix(voidBlack, darkGreen, smoothstep(0.15, 0.4, n));
      col = mix(col, limeGreen, smoothstep(0.35, 0.65, n2));
      col = mix(col, electricBlue, smoothstep(0.5, 0.75, n));
      col = mix(col, brightGreen, smoothstep(0.75, 0.95, n * n2 * 2.0));

      vec3 viewDir = normalize(cameraPosition - vPos);
      float fresnel = 1.0 - abs(dot(normalize(vNorm), viewDir));
      fresnel = pow(fresnel, 2.5);
      col += vec3(0.67, 1.0, 0.0) * fresnel * 0.8;

      float star = smoothstep(0.92, 0.95, noise(vPos * 20.0 + uTime * 0.2));
      col += vec3(0.8, 1.0, 0.4) * star * 0.6;
      col *= 1.3;

      gl_FragColor = vec4(col, 1.0);
    }
  `
)

extend({ GalaxyOrbShader })

declare module '@react-three/fiber' {
  interface ThreeElements {
    galaxyOrbShader: any
  }
}

export default function GalaxyOrb() {
  const ref = useRef<any>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.uTime = clock.getElapsedTime()
  })
  return (
    <mesh renderOrder={1001}>
      <sphereGeometry args={[BALL_R * 1.2, 32, 32]} />
      <galaxyOrbShader ref={ref} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
