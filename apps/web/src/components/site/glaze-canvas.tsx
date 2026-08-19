'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * TZ §25.4 — the signature element: a WebGL mesh gradient whose flow follows the
 * pointer slowly, with a faint tile-grid mask over it so the colour appears to
 * move *behind* ceramic.
 *
 * It degrades to the static CSS gradient (rendered underneath, always) when:
 *   · `prefers-reduced-motion: reduce` is set,
 *   · WebGL is unavailable,
 *   · the device reports few cores / low memory,
 *   · the section is scrolled out of view or the tab is hidden (rAF is paused).
 */

const VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision mediump float;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uPointer;

// Khiva majolica: navy → glaze → aqua, with a clay ember low in the mix.
const vec3 NAVY  = vec3(0.078, 0.306, 0.478);
const vec3 GLAZE = vec3(0.055, 0.549, 0.627);
const vec3 AQUA  = vec3(0.133, 0.675, 0.863);
const vec3 CLAY  = vec3(0.761, 0.392, 0.235);
const vec3 DEEP  = vec3(0.020, 0.082, 0.129);

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  const float K1 = 0.366025404;
  const float K2 = 0.211324865;
  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;
  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));
  return dot(n, vec3(70.0));
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Slow drift; the pointer nudges the field rather than driving it.
  float t = uTime * 0.045;
  vec2 pointer = (uPointer - 0.5) * 0.35;
  vec2 q = p + pointer;

  float n1 = fbm(q * 1.6 + vec2(t, t * 0.7));
  float n2 = fbm(q * 2.4 - vec2(t * 0.8, t * 1.1) + n1 * 0.6);
  float n3 = fbm(q * 0.9 + vec2(-t * 0.5, t * 0.3));

  vec3 color = mix(NAVY, GLAZE, smoothstep(-0.45, 0.55, n1));
  color = mix(color, AQUA, smoothstep(0.0, 0.85, n2) * 0.72);
  color = mix(color, CLAY, smoothstep(0.55, 1.0, n3) * 0.14);
  color = mix(DEEP, color, 0.82 + 0.18 * n1);

  // Vignette so headline text over the shader always clears AA contrast.
  float vignette = smoothstep(1.25, 0.25, length(uv - vec2(0.42, 0.5)));
  color *= 0.62 + 0.38 * vignette;

  // Break up banding on 8-bit displays.
  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;

  gl_FragColor = vec4(color + dither, 1.0);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** Conservative low-power heuristic — better a static gradient than a janky one. */
function isLowPowerDevice() {
  if (typeof navigator === 'undefined') return true
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  return cores <= 2 || memory <= 2
}

export function GlazeCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || isLowPowerDevice()) return

    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
      preserveDrawingBuffer: false,
    })
    if (!gl) return

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vertex || !fragment) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPosition = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    const uResolution = gl.getUniformLocation(program, 'uResolution')
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uPointer = gl.getUniformLocation(program, 'uPointer')

    // Pointer is eased towards the target so the flow feels slow, never twitchy.
    const target = { x: 0.5, y: 0.5 }
    const current = { x: 0.5, y: 0.5 }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const { clientWidth, clientHeight } = canvas
      const width = Math.max(1, Math.floor(clientWidth * dpr))
      const height = Math.max(1, Math.floor(clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
      gl.uniform2f(uResolution, canvas.width, canvas.height)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      target.x = (event.clientX - rect.left) / rect.width
      target.y = 1 - (event.clientY - rect.top) / rect.height
    }

    let visible = true
    let frame = 0
    const start = performance.now()

    const render = () => {
      if (!visible || document.hidden) {
        frame = requestAnimationFrame(render)
        return
      }
      resize()
      current.x += (target.x - current.x) * 0.03
      current.y += (target.y - current.y) * 0.03
      gl.uniform1f(uTime, (performance.now() - start) / 1000)
      gl.uniform2f(uPointer, current.x, current.y)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      frame = requestAnimationFrame(render)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true
      },
      { threshold: 0 },
    )
    observer.observe(canvas)

    const onContextLost = (event: Event) => {
      event.preventDefault()
      cancelAnimationFrame(frame)
      setActive(false)
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    setActive(true)
    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      window.removeEventListener('pointermove', onPointerMove)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      gl.deleteBuffer(buffer)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ opacity: active ? 1 : 0, transition: 'opacity 700ms var(--ease-enter)' }}
    />
  )
}
