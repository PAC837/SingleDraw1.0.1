/**
 * Global clipping plane that slices through walls and products as the camera
 * zooms in toward the room. Replaces the old opacity-fade approach with a
 * hard GPU-level clip — no transparency hacks needed.
 */

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Plane, Vector3 } from 'three'

interface CameraClipPlaneProps {
  roomCenter: [number, number, number]
  enabled: boolean
}

export default function CameraClipPlane({ roomCenter, enabled }: CameraClipPlaneProps) {
  const { gl } = useThree()
  const plane = useRef(new Plane())
  const center = useRef(new Vector3())
  const dir = useRef(new Vector3())

  // Clear clipping planes on unmount
  useEffect(() => () => { gl.clippingPlanes = [] }, [gl])

  useFrame(({ camera }) => {
    if (!enabled) {
      gl.clippingPlanes = []
      return
    }

    center.current.set(roomCenter[0], roomCenter[1], roomCenter[2])
    const dist = camera.position.distanceTo(center.current)

    const outerDist = 4500  // beyond this: no clipping
    const innerDist = 1000  // fully clipping at this distance

    if (dist > outerDist) {
      gl.clippingPlanes = []
      return
    }

    // t: 0 when far (outerDist) → 1 when close (innerDist)
    const t = 1 - Math.max(0, Math.min(1, (dist - innerDist) / (outerDist - innerDist)))

    // Direction from camera toward room center
    dir.current.subVectors(center.current, camera.position).normalize()

    // Clip plane extends cutDepth mm in front of camera toward room
    const cutDepth = t * dist * 0.7
    const planePoint = camera.position.clone().addScaledVector(dir.current, cutDepth)

    // Normal points toward room → room side is kept, camera side is clipped
    plane.current.setFromNormalAndCoplanarPoint(dir.current, planePoint)
    gl.clippingPlanes = [plane.current]
  })

  return null
}
