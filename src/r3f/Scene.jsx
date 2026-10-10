import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

// Brand colors from index.html (:root --cyan / --peach / --purple).
const COLORS = ['#00e5ff', '#ffd8bd', '#8b5cf6']

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// A cube that spins every frame, brightens on hover and grows on click.
function Box({ color, ...props }) {
  const ref = useRef()
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)

  useFrame((_, delta) => {
    if (reduceMotion) return
    ref.current.rotation.x += delta * 0.6
    ref.current.rotation.y += delta * 0.4
  })

  return (
    <mesh
      {...props}
      ref={ref}
      scale={active ? 1.4 : 1}
      onClick={() => setActive(a => !a)}
      onPointerOver={e => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = '' }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 0.6 : 0.08} roughness={0.35} metalness={0.2} />
    </mesh>
  )
}

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 2]}>
      <ambientLight intensity={Math.PI / 4} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI / 2} color="#8b5cf6" />
      {COLORS.map((color, i) => (
        <Box key={color} color={color} position={[(i - 1) * 1.8, 0, 0]} />
      ))}
    </Canvas>
  )
}
