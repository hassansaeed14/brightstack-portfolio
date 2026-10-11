// three.js for the site's hand-written scenes. They were tuned on r128 (from a CDN); this
// module serves the npm version but keeps r128's rendering so colours and lighting look the same.
import * as THREE from 'three'

// r128 had no colour management: hex colours and canvas textures were used as-is.
THREE.ColorManagement.enabled = false

export class WebGLRenderer extends THREE.WebGLRenderer {
  constructor(parameters) {
    super(parameters)
    // r128 wrote linear output by default (pages that wanted sRGB set it explicitly).
    this.outputColorSpace = THREE.LinearSRGBColorSpace
  }
  // Cap the pixel ratio: above 2x the extra GPU cost isn't visible.
  setPixelRatio(value) {
    super.setPixelRatio(Math.min(value, 2))
  }
}

// r128's default ("legacy") lighting multiplied light intensities by π internally, and point
// lights without a distance never faded. Recreate that so existing intensity values still apply.
export class AmbientLight extends THREE.AmbientLight {
  constructor(color, intensity = 1) { super(color, intensity * Math.PI) }
}
export class DirectionalLight extends THREE.DirectionalLight {
  constructor(color, intensity = 1) { super(color, intensity * Math.PI) }
}
export class PointLight extends THREE.PointLight {
  constructor(color, intensity = 1, distance = 0) { super(color, intensity * Math.PI, distance, 0) }
}

export * from 'three'
