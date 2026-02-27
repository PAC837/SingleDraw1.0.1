/** Plain white infinite ground plane. Room floor texture is handled by RoomFloor. */

export default function FloorPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -50, 0]}>
      <planeGeometry args={[20000, 20000]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
    </mesh>
  )
}
