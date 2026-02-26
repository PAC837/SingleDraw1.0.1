import { Vector3, Quaternion } from 'three'

/**
 * Mozaik space:   X = width (right), Y = depth (into room), Z = height (up)
 * Three.js space: X = right, Y = up, Z = toward camera
 *
 * Default mapping: (Xm, Ym, Zm) → (Xm, Zm, -Ym)
 *
 * Basis change matrix M:
 *   | 1  0  0 |   Mozaik X → Three X
 *   | 0  0  1 |   Mozaik Z → Three Y
 *   | 0 -1  0 |   Mozaik Y → Three -Z
 *
 * det(M) = +1 (proper rotation, no reflection)
 */

/** Convert a Mozaik-space position to Three.js position. */
export function mozPosToThree(mx: number, my: number, mz: number): Vector3 {
  return new Vector3(mx, mz, -my)
}

/** Convert a Three.js position back to Mozaik-space. */
export function threePosToMoz(v: Vector3): [number, number, number] {
  // Inverse: Xm = Xt, Ym = -Zt, Zm = Yt
  return [v.x, -v.z, v.y]
}

/**
 * Transform a Mozaik-space quaternion to Three.js space.
 *
 * Quaternion q = w + xi + yj + zk, where i,j,k are basis vectors.
 * Under our basis change M:
 *   i_moz → i_three     (X stays X)
 *   j_moz → -k_three    (Y maps to -Z)
 *   k_moz → j_three     (Z maps to Y)
 *
 * So q_moz = w + x·i_moz + y·j_moz + z·k_moz
 *          = w + x·i_three + y·(-k_three) + z·j_three
 *          = w + x·i + z·j + (-y)·k
 *
 * Result: q_three = (x_moz, z_moz, -y_moz, w_moz)
 */
export function mozQuatToThree(qMoz: Quaternion): Quaternion {
  return new Quaternion(qMoz.x, qMoz.z, -qMoz.y, qMoz.w)
}

/** Convert a Three.js quaternion back to Mozaik-space. */
export function threeQuatToMoz(qThree: Quaternion): Quaternion {
  // Inverse: x_moz = x_three, y_moz = -z_three, z_moz = y_three, w_moz = w_three
  return new Quaternion(qThree.x, -qThree.z, qThree.y, qThree.w)
}

/** Convert a Mozaik-space 2D plan position (XY) to Three.js XZ plane. */
export function mozPlanToThree(mx: number, my: number): [number, number] {
  // In Three.js: X stays X, Mozaik Y maps to -Z
  return [mx, -my]
}
