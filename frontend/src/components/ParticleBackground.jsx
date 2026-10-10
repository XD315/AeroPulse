import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ---- Hạt bụi bay nhẹ ----
function DustParticles({ count = 900 }) {
  const mesh = useRef()

  // Tạo vị trí ngẫu nhiên 1 lần duy nhất
  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)

    const palette = [
      [0.22, 0.74, 0.98],  // sky blue
      [0.14, 0.67, 0.86],  // teal
      [0.45, 0.86, 0.98],  // light cyan
      [0.08, 0.53, 0.78],  // deep blue
    ]

    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 22
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10

      const c = palette[Math.floor(Math.random() * palette.length)]
      col[i * 3]     = c[0]
      col[i * 3 + 1] = c[1]
      col[i * 3 + 2] = c[2]
    }
    return [pos, col]
  }, [count])

  // Xoay nhẹ liên tục
  useFrame((_, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.025
      mesh.current.rotation.x += delta * 0.008
    }
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={colors.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.55}
        sizeAttenuation
      />
    </points>
  )
}

// ---- Wrapper export ----
export default function ParticleBackground({ style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 65 }}
        gl={{ antialias: false, alpha: true }}
        dpr={Math.min(window.devicePixelRatio, 1.5)}
        style={{ width: '100%', height: '100%' }}
      >
        <DustParticles />
      </Canvas>
    </div>
  )
}
