"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Slider as AriaSlider, SliderThumb as AriaSliderThumb, SliderTrack as AriaSliderTrack } from "react-aria-components";

export const EFFORT_LEVELS = ["Low", "Medium", "Balanced", "High", "Very High", "Max"];

// Original effort slider (3oxmuz9pqr-wm.js, EffortSlider): a React Aria
// slider with a custom 27px track — a fill that grows with the value,
// 3px tick bars that scatter away when Max is picked, and a 21px thumb.
// The Max flame overlay is ported verbatim from the original chunk
// 3oxmuz9pqr-wm.js: a WebGL fragment-shader plume, a 2D spark canvas and a
// non-WebGL fallback. The dark overlay rgba(16,24,40,0.62) is the
// original's own value.
const EFFORT_FLAME_VERTEX_SHADER = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const EFFORT_FLAME_FRAGMENT_SHADER = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_power; // 0 -> 1 throttle-up after ignition

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.1 + vec2(37.4, 17.9);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float d = 1.0 - uv.x;            // 0 at the nozzle (right) -> 1 far left
  float y = (uv.y - 0.5) * 2.0;    // -1 bottom .. 1 top

  // Turbulence blown leftward; second octave wobbles the plume axis
  float turb = fbm(vec2(uv.x * 5.5 + u_time * 3.2, uv.y * 3.5 + u_time * 0.4)) - 0.5;
  float sway = (fbm(vec2(u_time * 1.6, uv.x * 2.0)) - 0.5) * 0.55;

  // Plume envelope: wide at the nozzle, tapering left, edges licked by noise.
  // Throttle (u_power) grows the plume from a short narrow jet to full burn.
  float width = mix(1.05, 0.12, smoothstep(0.0, 1.0, d)) * mix(0.35, 1.0, u_power);
  float reach = mix(0.18, 1.05, u_power);
  float shape = 1.0 - smoothstep(width * 0.35, width, abs(y + sway * d + turb * (0.35 + d * 0.9)));
  float len = 1.0 - smoothstep(0.15 * u_power, reach, d + turb * 0.45 * u_power);
  float flame = clamp(shape * len, 0.0, 1.0);

  // Extra hot core hugging the nozzle centre line
  float core = (1.0 - smoothstep(0.0, 0.38 * mix(0.5, 1.0, u_power), d + turb * 0.15)) * (1.0 - smoothstep(0.0, 0.55, abs(y)));
  flame = clamp(flame + core * 0.6, 0.0, 1.0) * mix(0.6, 1.0, u_power);

  // Ambient glow so the flame feels emissive even past its tongues
  float glow = (1.0 - smoothstep(0.0, 0.85, d)) * (1.0 - smoothstep(0.2, 1.15, abs(y))) * 0.4 * u_power;

  // blue-600 -> blue-400 -> blue-200 -> white-hot. The white core is gated on
  // nozzle distance too, so only the plume root burns white and the body
  // stays saturated blue.
  vec3 c600 = vec3(0.082, 0.365, 0.988);
  vec3 c400 = vec3(0.318, 0.635, 1.0);
  vec3 c200 = vec3(0.741, 0.867, 1.0);
  vec3 col = mix(c600, c400, smoothstep(0.2, 0.6, flame));
  col = mix(col, c200, smoothstep(0.62, 0.95, flame) * (1.0 - smoothstep(0.1, 0.75, d)));
  float hot = smoothstep(0.9, 1.0, flame) * (1.0 - smoothstep(0.02, 0.3, d));
  col = mix(col, vec3(1.0), hot);

  float alpha = smoothstep(0.04, 0.55, flame) * 0.96 + glow;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

function EffortFlameSparks() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const makeSpark = (fromRight: boolean) => ({
      x: fromRight ? Math.random() * width : width + 4,
      y: 1 + Math.random() * (height - 2),
      speed: 18 + 90 * Math.random(),
      size: 0.6 + Math.random(),
      alpha: 0.4 + 0.55 * Math.random(),
    });

    const sparks = Array.from({ length: 40 }, () => makeSpark(true));
    let star: {
      x: number;
      y: number;
      speed: number;
      size: number;
      alpha: number;
      life: number;
    } | null = null;

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx.clearRect(0, 0, width, height);
      for (const spark of sparks) {
        spark.x -= spark.speed * dt;
        if (spark.x < -6) Object.assign(spark, makeSpark(false));
        const grad = ctx.createLinearGradient(
          spark.x,
          spark.y,
          spark.x + 0.05 * spark.speed,
          spark.y,
        );
        grad.addColorStop(
          0,
          "rgba(255,255,255," + spark.alpha.toFixed(3) + ")",
        );
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(
          spark.x,
          spark.y - spark.size / 2,
          0.05 * spark.speed + spark.size,
          spark.size,
        );
      }

      if (!star && Math.random() < dt / 2.5) {
        star = {
          ...makeSpark(false),
          speed: 260 + 120 * Math.random(),
          size: 1.2,
          alpha: 0.9,
          life: 1,
        };
      }
      if (star) {
        star.x -= star.speed * dt;
        star.life -= 0.9 * dt;
        if (star.x < -40 || star.life <= 0) {
          star = null;
        } else {
          const a = star.alpha * Math.max(star.life, 0);
          const grad = ctx.createLinearGradient(star.x, star.y, star.x + 26, star.y);
          grad.addColorStop(0, "rgba(255,255,255," + a.toFixed(3) + ")");
          grad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(star.x, star.y - 0.6, 26, 1.2);
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />;
}

function EffortFlameFallback() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const cols = Math.ceil(width / 3);
    const rows = Math.ceil(height / 3);
    const palette: Array<[number, number, number]> = [
      [142, 197, 255],
      [81, 162, 255],
      [43, 127, 255],
      [21, 93, 252],
    ];

    let raf = 0;
    let lastMs = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastMs <= 70) return;
      lastMs = now;
      ctx.clearRect(0, 0, width, height);
      for (let cx = 0; cx < cols; cx++) {
        const a = cx / (cols - 1);
        const density = 0.78 * Math.pow(a, 1.6);
        for (let cy = 0; cy < rows; cy++) {
          if (Math.random() < density) {
            const [r, g, b] = palette[(Math.random() * palette.length) | 0];
            const alpha = (0.15 + 0.85 * Math.random()) * (0.35 + 0.65 * a);
            ctx.fillStyle =
              "rgba(" + r + "," + g + "," + b + "," + alpha.toFixed(3) + ")";
            ctx.fillRect(3 * cx, 3 * cy, 2, 2);
          }
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0"
    >
      <div className="absolute inset-0 bg-gradient-to-l from-blue-300/90 via-blue-300/30 to-transparent" />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </motion.div>
  );
}

function EffortFlame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      setWebglFailed(true);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, EFFORT_FLAME_VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, EFFORT_FLAME_FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs || !program) {
      setWebglFailed(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setWebglFailed(true);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(gl.getUniformLocation(program, "u_res"), canvas.width, canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uPower = gl.getUniformLocation(program, "u_power");

    let raf = 0;
    const startMs = performance.now();
    const loop = (now: number) => {
      const t = (now - startMs) / 1000;
      gl.uniform1f(uTime, t);
      const s = Math.min(t / 1.4, 1);
      gl.uniform1f(uPower, 1 - Math.pow(1 - s, 3));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (webglFailed) return <EffortFlameFallback />;

  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0"
    >
      <div className="absolute inset-0 rounded-lg bg-[rgba(16,24,40,0.62)]" />
      <EffortFlameSparks />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </motion.div>
  );
}
export function EffortSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isMax = value === EFFORT_LEVELS.length - 1;
  const scatter = useMemo(
    () =>
      EFFORT_LEVELS.map(() => ({
        x: -(70 + 130 * Math.random()),
        y: (Math.random() - 0.5) * 70,
        rotate: (Math.random() - 0.5) * 720,
        delay: 0.3 * Math.random(),
      })),
    [isMax],
  );
  const d = value / (EFFORT_LEVELS.length - 1);
  return (
    <AriaSlider
      aria-label="Effort"
      minValue={0}
      maxValue={EFFORT_LEVELS.length - 1}
      step={1}
      value={value}
      onChange={onChange}
      className="w-full"
    >
      <div className="relative h-[27px] w-full overflow-hidden rounded-lg bg-background-secondary-default">
        <div
          className="absolute inset-y-0 start-0 rounded-lg bg-background-tertiary-hover transition-[width] duration-150 ease-out"
          style={{ width: `calc(${d} * (100% - 21px) + 21px)` }}
        />
        <div className="absolute inset-x-[9px] top-[7px] flex h-[13px] items-center justify-between">
          {EFFORT_LEVELS.map((label, i) => (
            <motion.span
              key={label}
              animate={
                isMax
                  ? { x: scatter[i].x, y: scatter[i].y, rotate: scatter[i].rotate, opacity: 0 }
                  : { x: 0, y: 0, rotate: 0, opacity: i > value ? 0.3 : 1 }
              }
              transition={
                isMax
                  ? { duration: 1.6, ease: [0.22, 0.5, 0.5, 1], delay: scatter[i].delay }
                  : { duration: 0.3, ease: "easeOut" }
              }
              className="h-full w-[3px] rounded-[2px] bg-foreground-icon-tertiary"
            />
          ))}
        </div>
        <AnimatePresence>{isMax && <EffortFlame />}</AnimatePresence>
        <div className="absolute inset-x-[10.5px] inset-y-0">
          <AriaSliderTrack className="h-full w-full">
            <AriaSliderThumb className="top-1/2 h-[27px] w-[21px] cursor-grab rounded-[7px] border border-border-checkbox-default bg-background-primary-default shadow-xs outline-none transition-shadow data-[dragging]:cursor-grabbing data-[focus-visible]:ring-2 data-[focus-visible]:ring-border-focus-ring" />
          </AriaSliderTrack>
        </div>
      </div>
    </AriaSlider>
  );
}
