import type { MozRotation } from '../mozaik/types'
import { mozEulerToQuaternion } from '../math/rotations'
import { mozQuatToThree } from '../math/basis'

interface RotationTestCase {
  label: string
  input: MozRotation
  description: string
}

/** Known rotation patterns from real Mozaik files. */
export const rotationTestCases: RotationTestCase[] = [
  {
    label: 'Identity (Bottom)',
    input: { a1: 0, a2: 0, a3: 0, r1: 'Y', r2: 'Z', r3: 'X' },
    description: 'No rotation — part lies flat in its default orientation',
  },
  {
    label: 'Hanger 10° Z-tilt',
    input: { a1: 10, a2: 0, a3: 0, r1: 'Z', r2: 'X', r3: 'Y' },
    description: 'Hanger bracket tilted 10° around global vertical (Z=height)',
  },
  {
    label: 'ClosetRod 180° Z-flip',
    input: { a1: 180, a2: 0, a3: 0, r1: 'Z', r2: 'X', r3: 'Y' },
    description: 'Closet rod flipped 180° around Z axis',
  },
  {
    label: 'Toe -90° X-perpendicular',
    input: { a1: -90, a2: 0, a3: 0, r1: 'X', r2: 'Z', r3: 'Y' },
    description: 'Front toe rotated -90° around X (width axis) — perpendicular',
  },
  {
    label: 'Top/Shelf 180° Y-flip',
    input: { a1: 180, a2: 0, a3: 0, r1: 'Y', r2: 'Z', r3: 'X' },
    description: 'Top and shelves flipped 180° around Y (depth axis)',
  },
  {
    label: 'FEnd complex -90°Y then 180°Z',
    input: { a1: -90, a2: 180, a3: 0, r1: 'Y', r2: 'Z', r3: 'X' },
    description: 'Filler strip Fin End: -90° around Y, then 180° around Z',
  },
]

/** Run all rotation test cases and return results. */
export function runRotationTests(): string[] {
  const results: string[] = []

  for (const tc of rotationTestCases) {
    const qMoz = mozEulerToQuaternion(tc.input)
    const qThree = mozQuatToThree(qMoz)

    // Verify quaternion is unit length
    const mozLen = Math.sqrt(qMoz.x ** 2 + qMoz.y ** 2 + qMoz.z ** 2 + qMoz.w ** 2)
    const threeLen = Math.sqrt(qThree.x ** 2 + qThree.y ** 2 + qThree.z ** 2 + qThree.w ** 2)

    const unitCheck = Math.abs(mozLen - 1) < 1e-10 && Math.abs(threeLen - 1) < 1e-10
      ? 'PASS' : 'FAIL'

    results.push(
      `[${tc.label}] ${tc.description}\n` +
      `  Input: A1=${tc.input.a1} A2=${tc.input.a2} A3=${tc.input.a3} ` +
      `R1=${tc.input.r1} R2=${tc.input.r2} R3=${tc.input.r3}\n` +
      `  Mozaik quat: (${fmt(qMoz.x)}, ${fmt(qMoz.y)}, ${fmt(qMoz.z)}, ${fmt(qMoz.w)})\n` +
      `  Three.js quat: (${fmt(qThree.x)}, ${fmt(qThree.y)}, ${fmt(qThree.z)}, ${fmt(qThree.w)})\n` +
      `  Unit length: ${unitCheck}`,
    )

    // Special checks for identity
    if (tc.input.a1 === 0 && tc.input.a2 === 0 && tc.input.a3 === 0) {
      const isIdentity = Math.abs(qMoz.w - 1) < 1e-10 &&
        Math.abs(qMoz.x) < 1e-10 && Math.abs(qMoz.y) < 1e-10 && Math.abs(qMoz.z) < 1e-10
      results.push(`  Identity check: ${isIdentity ? 'PASS' : 'FAIL'}`)
    }
  }

  return results
}

function fmt(n: number): string {
  return n.toFixed(6)
}
