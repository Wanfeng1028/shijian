'use client';

import { useId } from 'react';
import { cx } from '@/utils/cx';

type AvatarShape =
  | "star" | "heart" | "cloud" | "diamond" | "shield"
  | "slender" | "pocket" | "petal" | "flower";

type AvatarExpression =
  | "Neutral" | "Happy" | "Angry" | "Thinking" | "Shook" | "Curious"
  | "Wink" | "Sleepy" | "Sad" | "Worried" | "Skeptical" | "Focused"
  | "Excited" | "Calm" | "Shy" | "Confused";

const SHAPE_PATHS: Record<AvatarShape, string> = {
  star: "M20 2.2l4.7 9.9 10.8 1.4-7.9 7.4 2 10.7L20 26.4l-9.6 5.2 2-10.7-7.9-7.4 10.8-1.4L20 2.2Z",
  heart: "M20 36.5C10 29 3.5 22 3.5 14.5 3.5 9.5 7.5 6 12 6c3.2 0 6 1.8 8 4.5C22 7.8 24.8 6 28 6c4.5 0 8.5 3.5 8.5 8.5 0 7.5-6.5 14.5-16.5 22Z",
  cloud: "M13.5 34.5c-4.5 0-8-3.2-8-7.4 0-3.6 2.5-6.6 6-7.3.9-4.6 5-8.3 10-8.3 4.4 0 8.1 2.8 9.4 6.8 3.6.7 6.1 3.7 6.1 7.3 0 4.2-3.6 7.4-8.5 7.4H13.5Z",
  diamond: "M20 3.5L35.5 20 20 36.5 4.5 20 20 3.5Z",
  shield: "M20 0.8C24 1.2 29 3 33 5.2 36.5 6.8 39.5 7.5 39.5 11 39.8 15 39.5 20 38.8 24.5 38 29 35 32.5 31 36 27 38.8 23 39.8 20 39.8 17 39.8 13 38.8 9 36 5 32.5 2 29 1.2 24.5 0.5 20 0.2 15 0.5 11 0.5 7.5 3.5 6.8 7 5.2 11 3 16 1.2 20 0.8Z",
  slender: "M20 0.5C26 0.5 32 1 35.5 2.5 38.5 4 40 6.5 40 10L40 16C40 24 39.5 30 38 34.5 36.5 38 33 39.5 28 40 22 40.5 16 40 12 38 8 36 3 32 1.5 27 0.5 23 0 18 0 13 0 8 2 4 6 2 10 0.5 15 0.5 20 0.5Z",
  pocket: "M10 4h20a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z",
  petal: "M20 2.5C28 10 32.5 17.5 32.5 24.5a12.5 12.5 0 1 1-25 0C7.5 17.5 12 10 20 2.5Z",
  flower: "M20 6.5A6.8 6.8 0 0 1 31.7 13.25 6.8 6.8 0 0 1 31.7 26.75 6.8 6.8 0 0 1 20 33.5 6.8 6.8 0 0 1 8.3 26.75 6.8 6.8 0 0 1 8.3 13.25 6.8 6.8 0 0 1 20 6.5Z",
};

type EyeStyle = "open" | "wide" | "narrow" | "half" | "closed" | "arc" | "side";

type ExpressionSpec = {
  leftEye: EyeStyle;
  rightEye: EyeStyle;
  /** Stroke path, or a filled path when mouthFill is set. */
  mouth: string;
  mouthFill?: boolean;
  brows?: string;
  blush?: boolean;
  strongBlush?: boolean;
  lookX?: number;
  lookY?: number;
};

/** Our reading of the original's 16 expressions, in the original's ring
    order (investigation-report.md section 3.2). Only the names are
    evidence; every eye/mouth/brow below is drawn from the name. */
const EXPRESSIONS: Record<AvatarExpression, ExpressionSpec> = {
  Neutral: { leftEye: "open", rightEye: "open", mouth: "M16 26h8" },
  Happy: { leftEye: "arc", rightEye: "arc", mouth: "M14.5 24Q20 29.5 25.5 24", blush: true },
  Angry: { leftEye: "open", rightEye: "open", mouth: "M15.5 27.5Q20 24.5 24.5 27.5", brows: "M11 13.5L17 15.8M29 13.5L23 15.8" },
  Thinking: { leftEye: "side", rightEye: "side", mouth: "M17.5 26.5h5", brows: "M11.5 13.5Q14 12 16.5 13.5", lookX: 2 },
  Shook: { leftEye: "wide", rightEye: "wide", mouth: "M17.8 26.5a2.2 2.8 0 1 0 4.4 0 2.2 2.8 0 1 0-4.4 0Z", mouthFill: true, brows: "M11.5 13Q14 11 16.5 12.5M23.5 12.5Q26 11 28.5 13" },
  Curious: { leftEye: "wide", rightEye: "open", mouth: "M18.4 26a1.6 2 0 1 0 3.2 0 1.6 2 0 1 0-3.2 0Z", mouthFill: true, brows: "M11.5 12.5Q14 11 16.5 12.5" },
  Wink: { leftEye: "closed", rightEye: "open", mouth: "M15.5 25Q20 28.5 24.5 25", blush: true },
  Sleepy: { leftEye: "half", rightEye: "half", mouth: "M17 26.5h6" },
  Sad: { leftEye: "open", rightEye: "open", mouth: "M15.5 27Q20 24 24.5 27", brows: "M11 14.5Q14 12.5 17 14M23 14Q26 12.5 29 14.5" },
  Worried: { leftEye: "open", rightEye: "open", mouth: "M15.5 26Q17.8 27.6 20 26Q22.2 24.4 24.5 26", brows: "M11 13.5Q14 11.5 16.8 13M23.2 13Q26 11.5 29 13.5" },
  Skeptical: { leftEye: "side", rightEye: "open", mouth: "M16 26.5L24 25.5", brows: "M11.5 12.5Q14 11 16.5 12.5M23.5 14.5h5", lookX: 2 },
  Focused: { leftEye: "narrow", rightEye: "narrow", mouth: "M16.5 26h7", brows: "M11.5 14h5M23.5 14h5" },
  Excited: { leftEye: "wide", rightEye: "wide", mouth: "M14 24Q20 32 26 24Q20 27.5 14 24Z", mouthFill: true, brows: "M11.5 12.5Q14 11 16.5 12.5M23.5 12.5Q26 11 28.5 12.5", blush: true },
  Calm: { leftEye: "arc", rightEye: "arc", mouth: "M16.5 25.5Q20 28 23.5 25.5" },
  Shy: { leftEye: "open", rightEye: "open", mouth: "M16.5 25.5Q20 27.5 23.5 25.5", blush: true, strongBlush: true, lookY: 1 },
  Confused: { leftEye: "side", rightEye: "open", mouth: "M15.5 26Q17.8 27.4 20 26Q22.2 24.6 24.5 26", brows: "M11.5 12.5Q14 11 16.5 12.5M23.5 15.5Q26 14 28.5 15", lookX: -2 },
};

const EXPRESSION_ORDER: AvatarExpression[] = [
  "Neutral", "Happy", "Angry", "Thinking", "Shook", "Curious",
  "Wink", "Sleepy", "Sad", "Worried", "Skeptical", "Focused",
  "Excited", "Calm", "Shy", "Confused",
];

function AvatarEye({
  cx,
  style,
  lookX,
  lookY,
  blinkClass,
  wanderClass,
  blinkDelay,
  bold = false,
  /** Wheel-glyph rendering: the original's emotion-ring faces draw the
      same eyes far larger — measured off crop-orig-bigface.png, a wheel
      eye spans ~20% of the dot's width and ~25% of its height, with its
      centre at ~55% of the dot — while the avatar's own eyes span ~14%
      of the face width and ~23% of its height. One shared component
      with two geometries, so the ring stops reading as fine symbols. */
  mini = false,
}: {
  cx: number;
  style: EyeStyle;
  lookX: number;
  lookY: number;
  blinkClass: string | null;
  wanderClass: string | null;
  blinkDelay: string;
  /** Thicker strokes for the editor wheel glyphs (measured: the
      original's wheel faces are drawn bold). */
  bold?: boolean;
  mini?: boolean;
}) {
  const sw = mini ? 3.2 : bold ? 2.4 : 1.8;
  const cy = (mini ? 21 : 18) + lookY;
  const k = mini ? 1.7 : 1;
  const x = cx + (style === "side" ? lookX : 0);
  if (style === "closed") {
    return (
      <path
        d={`M${cx - 2.2 * k} ${cy}h${4.4 * k}`}
        stroke="#262626"
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  if (style === "arc") {
    return (
      <path
        d={`M${cx - 2.4 * k} ${cy + 0.7 * k}Q${cx} ${cy - 2.7 * k} ${cx + 2.4 * k} ${cy + 0.7 * k}`}
        stroke="#262626"
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
      />
    );
  }
  const ry =
    (mini
      ? style === "wide"
        ? 6.8
        : style === "narrow"
          ? 3.4
          : style === "half"
            ? 3.0
            : 6.0
      : style === "wide"
        ? 5.6
        : style === "narrow"
          ? 3.0
          : style === "half"
            ? 2.8
            : 4.6) + (bold && !mini ? 0.4 : 0);
  const rx = (mini ? (style === "wide" ? 5.0 : 4.6) : style === "wide" ? 3.3 : 2.9) + (bold && !mini ? 0.4 : 0);
  const eye = (
    <g>
      {/* No white highlight: the original's eyes are solid black pills. */}
      <ellipse cx={x} cy={cy} rx={rx} ry={ry} fill="#262626" />
      {style === "half" && (
        <path
          d={`M${x - 2.4} ${cy - 1.6}h4.8`}
          stroke="#262626"
          strokeWidth={bold ? 2 : 1.4}
          strokeLinecap="round"
        />
      )}
    </g>
  );
  const wandered = wanderClass ? <g className={wanderClass}>{eye}</g> : eye;
  return blinkClass ? (
    <g className={blinkClass} style={{ animationDelay: blinkDelay }}>
      {wandered}
    </g>
  ) : (
    wandered
  );
}

type CharacterAvatarData = {
  body: string;
  deep: string;
  shape: AvatarShape;
  name: string;
  expression?: AvatarExpression;
};

const AVATAR_FOR_CHARACTER: Record<
  string,
  { body: string; deep: string; shape: AvatarShape; expression: AvatarExpression }
> = {
  kongzi: { shape: "flower", body: "#B9ABED", deep: "#9A86E2", expression: "Calm" },
  qinshihuang: { shape: "shield", body: "#B3E4E5", deep: "#85CCD3", expression: "Focused" },
  shangyang: { shape: "diamond", body: "#91B6EB", deep: "#7492BC", expression: "Thinking" },
  zhangqian: { shape: "star", body: "#B4E4E3", deep: "#87CFCD", expression: "Curious" },
  wanganshi: { shape: "pocket", body: "#EBC7AD", deep: "#DCA87E", expression: "Thinking" },
  linzexu: { shape: "cloud", body: "#F3BCA5", deep: "#E89B78", expression: "Focused" },
  simajian: { shape: "slender", body: "#B9DFD0", deep: "#8EC7AE", expression: "Sad" },
  weiyuan: { shape: "heart", body: "#A6E0B5", deep: "#85B391", expression: "Curious" },
  sunzhongshan: { shape: "petal", body: "#F5DEA3", deep: "#EACB77", expression: "Excited" },
};

function avatarForCharacter(id: string, name: string): CharacterAvatarData {
  const builtin = AVATAR_FOR_CHARACTER[id];
  if (builtin) {
    return { body: builtin.body, deep: builtin.deep, shape: builtin.shape, name, expression: builtin.expression };
  }
  const entries = Object.values(AVATAR_FOR_CHARACTER);
  const charSum = id.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const picked = entries[charSum % entries.length];
  return { body: picked.body, deep: picked.deep, shape: picked.shape, name, expression: "Neutral" };
}

function AgentAvatar({
  agent,
  size = 40,
  blinkDelay = "0s",
  className,
}: {
  agent: CharacterAvatarData;
  size?: number;
  blinkDelay?: string;
  className?: string;
}) {
  const rawId = useId().replace(/:/g, "");
  const expr = EXPRESSIONS[agent.expression ?? "Neutral"] ?? EXPRESSIONS.Neutral;
  const gid = `bui-grad-${rawId}`;
  const cid = `bui-clip-${rawId}`;
  const d = SHAPE_PATHS[agent.shape];
  const rightDelay = blinkDelay === "0s" ? "1.3s" : `calc(${blinkDelay} + 1.3s)`;
  const openEye = (s: EyeStyle) => s !== "closed" && s !== "arc";
  const svg = (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      className="block"
    >
      <defs>
        {/* Pastel fill: light at upper-left, deeper at the edge — the
            original's radial gradient, measured off its sidebar faces. */}
        <radialGradient id={gid} cx="42%" cy="38%" r="75%">
          <stop offset="0%" stopColor={agent.body} />
          <stop offset="100%" stopColor={agent.deep} />
        </radialGradient>
        <clipPath id={cid}>
          <path d={d} />
        </clipPath>
      </defs>
      {/* Shape morph: keyed remount replays a short scale/fade so a shape
          change reads as a morph, not a hard cut. The intermediate frames
          are our own easing, not the original canvas morph. */}
      <g key={agent.shape} className="bui-morph">
        <path d={d} fill={`url(#${gid})`} />
        <g clipPath={`url(#${cid})`}>
          {/* Fold shadow: a deeper band down the right side, as on the
              original's large editor face and sidebar faces. */}
          <path d="M31 2C37.5 10 37.5 30 31 38L38 38 38 2Z" fill={agent.deep} opacity="0.45" />
        </g>
      </g>
      <AvatarEye
        cx={15}
        style={expr.leftEye}
        lookX={expr.lookX ?? 0}
        lookY={expr.lookY ?? 0}
        blinkClass={openEye(expr.leftEye) ? "bui-blink-l" : null}
        wanderClass={openEye(expr.leftEye) ? "bui-wander-l" : null}
        blinkDelay={blinkDelay}
      />
      <AvatarEye
        cx={26}
        style={expr.rightEye}
        lookX={expr.lookX ?? 0}
        lookY={expr.lookY ?? 0}
        blinkClass={openEye(expr.rightEye) ? "bui-blink-r" : null}
        wanderClass={openEye(expr.rightEye) ? "bui-wander-r" : null}
        blinkDelay={rightDelay}
      />
      {expr.brows && (
        <path d={expr.brows} stroke="#262626" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      )}
      {/* No mouth: the original's avatars — sidebar and the large editor
          face — show eyes only. Mouths survive only on the wheel glyphs
          (MiniFace below). */}
      {expr.blush && (
        <>
          <ellipse cx="10.5" cy="22.5" rx={expr.strongBlush ? 2.6 : 2} ry="1.2" fill="#f2a0a0" opacity={expr.strongBlush ? 0.85 : 0.55} />
          <ellipse cx="29.5" cy="22.5" rx={expr.strongBlush ? 2.6 : 2} ry="1.2" fill="#f2a0a0" opacity={expr.strongBlush ? 0.85 : 0.55} />
        </>
      )}
    </svg>
  );
  const label = `${agent.name}, ${agent.expression ?? "Neutral"}`;
  return (
    <span
      className={cx("relative block shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      {svg}
    </span>
  );
}

function AvatarKeyframes() {
  return (
    <style>{`@keyframes bui-blink{0%,91%,100%{transform:scaleY(1)}94%,96%{transform:scaleY(.08)}}.bui-blink-l{animation:bui-blink 4.4s infinite;transform-box:fill-box;transform-origin:center}.bui-blink-r{animation:bui-blink 5.3s infinite;transform-box:fill-box;transform-origin:center}@keyframes bui-wander-l{0%,100%{transform:translate(0,0)}25%{transform:translate(2px,1px)}50%{transform:translate(-2px,0)}75%{transform:translate(1px,-1px)}}@keyframes bui-wander-r{0%,100%{transform:translate(0,0)}30%{transform:translate(-2px,1px)}55%{transform:translate(1.5px,-1px)}80%{transform:translate(-1px,1px)}}.bui-wander-l{animation:bui-wander-l 7s ease-in-out infinite}.bui-wander-r{animation:bui-wander-r 8.5s ease-in-out infinite;animation-delay:-2.3s}@keyframes bui-morph{from{transform:scale(.93);opacity:.55}to{transform:scale(1);opacity:1}}.bui-morph{animation:bui-morph .32s ease-out;transform-box:fill-box;transform-origin:center}@media (prefers-reduced-motion:reduce){.bui-blink-l,.bui-blink-r,.bui-wander-l,.bui-wander-r,.bui-morph{animation:none!important}}`}</style>
  );
}

export type { AvatarShape, AvatarExpression, EyeStyle, ExpressionSpec, CharacterAvatarData };
export { SHAPE_PATHS, EXPRESSIONS, EXPRESSION_ORDER, AvatarEye, AgentAvatar, AvatarKeyframes, AVATAR_FOR_CHARACTER, avatarForCharacter };