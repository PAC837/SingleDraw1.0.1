import { Quaternion, Vector3, MathUtils } from 'three'
import type { MozRotation } from '../mozaik/types'

/**
 * Convert a Mozaik rotation specification to a quaternion in Mozaik space.
 *
 * Each part specifies its own axis order (R1, R2, R3) and angles (A1, A2, A3).
 * Convention: EXTRINSIC rotation (about fixed global axes).
 *   - Apply A1 degrees around R1 axis (fixed)
 *   - Then A2 degrees around R2 axis (fixed)
 *   - Then A3 degrees around R3 axis (fixed)
 *
 * Extrinsic composition: q_total = qR3(A3) · qR2(A2) · qR1(A1)
 * (last rotation first in quaternion multiplication)
 *
 * Evidence: Hanger R1=Z A1=10 means 10° tilt around global vertical — physical.
 */
export function mozEulerToQuaternion(rot: MozRotation): Quaternion {
  const q1 = quatFromAxisAngleDeg(rot.r1, rot.a1)
  const q2 = quatFromAxisAngleDeg(rot.r2, rot.a2)
  const q3 = quatFromAxisAngleDeg(rot.r3, rot.a3)

  // Extrinsic: q_total = q3 * q2 * q1
  return q3.multiply(q2).multiply(q1)
}

/** Create a quaternion from an axis label and angle in degrees. */
function quatFromAxisAngleDeg(axis: 'X' | 'Y' | 'Z', degrees: number): Quaternion {
  const rad = MathUtils.degToRad(degrees)
  const v = axisToVector(axis)
  return new Quaternion().setFromAxisAngle(v, rad)
}

/** Map axis label to a unit Vector3 in Mozaik space. */
function axisToVector(axis: 'X' | 'Y' | 'Z'): Vector3 {
  switch (axis) {
    case 'X': return new Vector3(1, 0, 0)
    case 'Y': return new Vector3(0, 1, 0)
    case 'Z': return new Vector3(0, 0, 1)
  }
}

/**
 * Decompose a quaternion back to Mozaik Euler angles given an axis order.
 * Used for verification only — production code uses stored original values.
 */
export function quaternionToMozEuler(
  q: Quaternion,
  r1: 'X' | 'Y' | 'Z',
  r2: 'X' | 'Y' | 'Z',
  r3: 'X' | 'Y' | 'Z',
): MozRotation {
  // Brute-force numerical decomposition: try to extract A1, A2, A3
  // by undoing each rotation step. This is approximate and for verification.
  const v1 = axisToVector(r1)
  const v2 = axisToVector(r2)
  const v3 = axisToVector(r3)

  // For single-axis rotations, extract directly
  if (q.x === 0 && q.y === 0 && q.z === 0) {
    return { a1: 0, a2: 0, a3: 0, r1, r2, r3 }
  }

  // General case: numerical extraction
  // The angle around axis v is: 2 * atan2(dot(qvec, v), qw)
  const qVec = new Vector3(q.x, q.y, q.z)

  // This is a simplified single-axis approximation
  const angle = 2 * Math.atan2(qVec.dot(v1), q.w)
  const a1 = MathUtils.radToDeg(angle)

  // Remove q1 and check remainder for q2, q3
  const q1Inv = quatFromAxisAngleDeg(r1, a1).conjugate()
  const remainder = q.clone().multiply(q1Inv)

  const rVec = new Vector3(remainder.x, remainder.y, remainder.z)
  const angle2 = 2 * Math.atan2(rVec.dot(v2), remainder.w)
  const a2 = MathUtils.radToDeg(angle2)

  const q2Inv = quatFromAxisAngleDeg(r2, a2).conjugate()
  const remainder2 = remainder.multiply(q2Inv)

  const r2Vec = new Vector3(remainder2.x, remainder2.y, remainder2.z)
  const angle3 = 2 * Math.atan2(r2Vec.dot(v3), remainder2.w)
  const a3 = MathUtils.radToDeg(angle3)

  return { a1, a2, a3, r1, r2, r3 }
}
