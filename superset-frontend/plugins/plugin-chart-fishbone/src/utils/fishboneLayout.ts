/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  FishboneBone,
  FishboneLayout,
  FishboneRow,
  FixedBoneLabel,
  HeadPosition,
  LaidOutBone,
  LaidOutBox,
  LaidOutCircle,
  LaidOutRow,
  LaidOutText,
} from '../types';
import estimateTextWidth, { truncateToWidth, wrapText } from './textWidth';

/** 画布四周留白。 */
const PAD = 16;
/** 主干（横向鱼身）线宽。 */
const SPINE_WIDTH = 20;
/** 小刺引线的线宽，比主骨细一档。 */
const LEADER_WIDTH = 2;
/** 小骨引线的长度：从主骨中心到文字的横向距离。 */
const LEADER_LENGTH = 64;
/** 箭头三角形的长度与半高。 */
const ARROW_LENGTH = 8;
const ARROW_HALF = 3.5;
/** 小刺箭头尖与主骨边缘之间的间隙，避免小刺贴住主骨。 */
const ARROW_CLEARANCE = 8;
/** 大骨与主干连接处的箭头尖到主干中心的间隙。 */
const MAIN_ARROW_GAP = 8;
/** 行高相对行字号的倍数。 */
const ROW_HEIGHT_RATIO = 1.65;
/** 相邻两行标签之间的间隙。 */
const VALUE_GAP = 8;
/**
 * 同一侧两根主骨内侧文字之间的最小间隙。
 *
 * 图较矮时原因行会排到主骨的另一侧；同一侧的两根主骨内侧是相向的，两边的
 * 文字在两条主骨中线处各让出一半间隙，避免互相压住。
 */
const INNER_GAP = 12;
/** 主骨与主干夹角的余切关系：tan(55°)。 */
const BONE_ANGLE_TAN = Math.tan((55 * Math.PI) / 180);
/** 主干最短长度，短于此值说明横向空间已经不够。 */
const MIN_SPINE_LENGTH = 80;
/** 胶囊标签的内边距与圆角。 */
const PILL_PAD_X = 13;
const PILL_PAD_Y = 7;
const PILL_RADIUS = 10;
/** 胶囊标签的字号：在行字号基础上放大，并保证一个足够醒目的下限。 */
const PILL_FONT_BONUS = 10;
const PILL_MIN_FONT_SIZE = 26;
/** 问题气泡的内边距、行高倍数与最大行数。 */
const EFFECT_PAD_X = 12;
const EFFECT_PAD_Y = 12;
const EFFECT_LINE_RATIO = 1.45;
const EFFECT_MAX_LINES = 3;
/** 问题气泡的字号：比原因文字大，并保证足够醒目。 */
const EFFECT_FONT_BONUS = 10;
const EFFECT_MIN_FONT_SIZE = 22;
/** 气泡尾巴高度，以及气泡底部与鱼头之间的间距。 */
const EFFECT_TAIL_HEIGHT = 14;
const EFFECT_BOTTOM_GAP = 24;
/**
 * 问题气泡的最大宽度。
 *
 * 收窄到画布宽度的四分之一左右：文字变多时优先换行、让气泡向上长高，
 * 而不是一路横向拉长；这样更像对话框，也不会把鱼头上方的空间占满。
 */
const EFFECT_WIDTH_RATIO = 0.26;
const EFFECT_MAX_WIDTH = 240;
const EFFECT_MIN_WIDTH = 160;
/** 行字号下限：内容过多时允许缩到 11px，再小就改为丢弃原因。 */
const MIN_FONT_SIZE = 11;
/** 缩字号的尝试次数上限。 */
const MAX_FONT_STEPS = 12;
/** 鱼头 / 鱼尾的半高与长度比例。 */
const FISH_HALF_RATIO = 0.17;
const FISH_HALF_MIN = 28;
const FISH_HALF_MAX = 84;
const HEAD_LEN_RATIO = 2.2;
const TAIL_LEN_RATIO = 1.9;
/** 主骨锚点沿主干（从鱼尾到鱼头）的相对位置。 */
const TAIL_FLOW = 0.3;
const HEAD_FLOW = 0.7;

export interface FishboneLayoutInput {
  width: number;
  height: number;
  /** 固定四根主骨及其原因行。 */
  bones: FishboneBone[];
  /** 鱼头文字，即要分析的问题。 */
  effectName: string;
  headPosition: HeadPosition;
  showValues: boolean;
  /** 行标签的基准字号，由控件档位决定。 */
  baseFontSize: number;
  /** 主骨线宽，由控件档位决定。 */
  baseThickness: number;
  formatValue: (value: number) => string;
}

/** 画布几何：主干两端、鱼头鱼尾尺寸。 */
interface Geometry {
  dir: 1 | -1;
  spineY: number;
  /** 鱼尾尖端、尾鳍根部与鱼头根部、嘴尖的横坐标。 */
  tailTipX: number;
  tailBaseX: number;
  headTipX: number;
  headBaseX: number;
  fishHalf: number;
  headLen: number;
  tailLen: number;
}

/** 主骨在画布上的四个固定槽位。 */
interface SlotDef {
  key: FixedBoneLabel;
  side: 'top' | 'bottom';
  flow: 'head' | 'tail';
}

/**
 * 固定槽位。
 *
 * 位置与参考图一致：人、法在鱼头一侧，环、物在鱼尾一侧，上下各两根。
 * 槽位与分类绑定，数据多少都不会改变某根主骨画在哪，排布因此是确定的。
 */
const SLOTS: SlotDef[] = [
  { key: '人', side: 'top', flow: 'head' },
  { key: '环', side: 'top', flow: 'tail' },
  { key: '物', side: 'bottom', flow: 'tail' },
  { key: '法', side: 'bottom', flow: 'head' },
];

/** 问题气泡。 */
interface EffectBubble {
  box: LaidOutBox;
  lines: LaidOutText[];
  /** 气泡底部指向鱼头的尾巴。 */
  tail: string;
}

/** 一次完整布局的产出。 */
interface LayoutAttempt {
  layout: Omit<FishboneLayout, 'droppedRows'>;
  /** 因空间不足被丢弃的行数。 */
  dropped: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 计算主干、鱼头与鱼尾的几何。 */
function computeGeometry(
  width: number,
  height: number,
  dir: 1 | -1,
): Geometry | null {
  if (width < PAD * 3 || height < PAD * 2) {
    return null;
  }

  const fishHalf = clamp(
    Math.min(height * FISH_HALF_RATIO, width * 0.1),
    FISH_HALF_MIN,
    FISH_HALF_MAX,
  );
  const headLen = Math.min(fishHalf * HEAD_LEN_RATIO, width * 0.2);
  const tailLen = Math.min(fishHalf * TAIL_LEN_RATIO, width * 0.17);

  const headTipX = dir > 0 ? width - PAD : PAD;
  const headBaseX = headTipX - dir * headLen;
  const tailTipX = dir > 0 ? PAD : width - PAD;
  const tailBaseX = tailTipX + dir * tailLen;

  return {
    dir,
    spineY: height / 2,
    tailTipX,
    tailBaseX,
    headTipX,
    headBaseX,
    fishHalf,
    headLen,
    tailLen,
  };
}

/** 鱼头轮廓：圆润的头部曲线，外端收成一个带凹口的嘴。 */
function fishHeadPath(g: Geometry): string {
  const { dir, spineY, headBaseX, headTipX, headLen, fishHalf } = g;
  const c1 = headBaseX + dir * headLen * 0.42;
  const c2 = headBaseX + dir * headLen * 0.82;
  const upperLipY = spineY - fishHalf * 0.17;
  const lowerLipY = spineY + fishHalf * 0.17;
  // 嘴角比嘴尖略微收进头部，上下唇之间形成向内凹的缺口。
  const mouthX = headTipX - dir * headLen * 0.12;
  return [
    `M ${headBaseX} ${spineY - fishHalf}`,
    `C ${c1} ${spineY - fishHalf} ${c2} ${spineY - fishHalf * 0.58} ${headTipX} ${upperLipY}`,
    `C ${headTipX - dir * headLen * 0.07} ${upperLipY} ${mouthX + dir * headLen * 0.03} ${spineY - fishHalf * 0.05} ${mouthX} ${spineY}`,
    `C ${mouthX + dir * headLen * 0.03} ${spineY + fishHalf * 0.05} ${headTipX - dir * headLen * 0.07} ${lowerLipY} ${headTipX} ${lowerLipY}`,
    `C ${c2} ${spineY + fishHalf * 0.58} ${c1} ${spineY + fishHalf} ${headBaseX} ${spineY + fishHalf}`,
    'Z',
  ].join(' ');
}

/** 鱼鳃：头部后方一道向嘴侧弯的弧线。 */
function fishGillPath(g: Geometry): string {
  const { dir, spineY, headBaseX, headLen, fishHalf } = g;
  const x1 = headBaseX + dir * headLen * 0.3;
  const x2 = headBaseX + dir * headLen * 0.38;
  return `M ${x1} ${spineY - fishHalf * 0.58} C ${x2} ${spineY - fishHalf * 0.22} ${x2} ${spineY + fishHalf * 0.22} ${x1} ${spineY + fishHalf * 0.58}`;
}

/**
 * 鱼尾轮廓：从主干末端一段窄颈向外张开的弧状叉尾。
 *
 * 窄颈与主干线宽接近，尾鳍再从颈部左右张开，避免尾鳍和主干之间出现生硬的
 * 直角接缝；两个叶瓣用三次贝塞尔曲线收出圆弧和中间的凹口。
 */
function fishTailPath(g: Geometry): string {
  const { dir, spineY, tailTipX, tailLen, fishHalf } = g;
  const base = tailTipX + dir * tailLen;
  const notch = tailTipX + dir * tailLen * 0.42;
  // 尾根高度跟着主干线宽走，粗细变化时尾鳍始终与鱼身自然衔接。
  const neck = SPINE_WIDTH * 0.6;
  return [
    `M ${base} ${spineY - neck}`,
    `C ${base - dir * tailLen * 0.2} ${spineY - fishHalf * 0.55} ${tailTipX + dir * tailLen * 0.1} ${spineY - fishHalf * 1.05} ${tailTipX} ${spineY - fishHalf * 0.95}`,
    `C ${tailTipX + dir * tailLen * 0.28} ${spineY - fishHalf * 0.6} ${tailTipX + dir * tailLen * 0.3} ${spineY - fishHalf * 0.18} ${notch} ${spineY}`,
    `C ${tailTipX + dir * tailLen * 0.3} ${spineY + fishHalf * 0.18} ${tailTipX + dir * tailLen * 0.28} ${spineY + fishHalf * 0.6} ${tailTipX} ${spineY + fishHalf * 0.95}`,
    `C ${tailTipX + dir * tailLen * 0.1} ${spineY + fishHalf * 1.05} ${base - dir * tailLen * 0.2} ${spineY + fishHalf * 0.55} ${base} ${spineY + neck}`,
    'Z',
  ].join(' ');
}

/** 鱼眼位置。 */
function fishEye(g: Geometry): LaidOutCircle {
  return {
    cx: g.headBaseX + g.dir * g.headLen * 0.5,
    cy: g.spineY - g.fishHalf * 0.32,
    r: Math.max(2, g.fishHalf * 0.13),
  };
}

/**
 * 问题气泡：停在鱼头上方，深色底白字，底部有一个指向鱼头的尖角。
 *
 * 气泡不再占用整段竖直区域，而是像对话框一样排在鱼头上方；同一高度的
 * 原因行可以排到气泡左侧，因此气泡放大、下移也不会挤掉原因。
 */
function buildEffectBubble(
  effectName: string,
  fontSize: number,
  width: number,
  g: Geometry,
): EffectBubble | null {
  const text = effectName.trim();
  if (!text) {
    return null;
  }

  const effectFontSize = Math.max(
    fontSize + EFFECT_FONT_BONUS,
    EFFECT_MIN_FONT_SIZE,
  );
  const lineHeight = effectFontSize * EFFECT_LINE_RATIO;
  // 气泡底部固定在鱼头上方，尾巴再从底部伸向鱼头。
  const bubbleBottom = g.spineY - g.fishHalf - EFFECT_BOTTOM_GAP;
  const maxHeight = bubbleBottom - PAD;
  const maxLines = Math.min(
    EFFECT_MAX_LINES,
    Math.floor((maxHeight - EFFECT_PAD_Y * 2) / lineHeight),
  );
  if (maxLines < 1) {
    return null;
  }

  const maxWidth = Math.min(
    EFFECT_MAX_WIDTH,
    Math.max(EFFECT_MIN_WIDTH, width * EFFECT_WIDTH_RATIO),
  );
  const lines = wrapText(
    text,
    effectFontSize,
    maxWidth - EFFECT_PAD_X * 2,
    maxLines,
  );
  if (!lines.length) {
    return null;
  }

  const textWidth = Math.max(
    ...lines.map(line => estimateTextWidth(line, effectFontSize)),
  );
  const boxWidth = Math.min(maxWidth, textWidth + EFFECT_PAD_X * 2);
  const boxHeight = lines.length * lineHeight + EFFECT_PAD_Y * 2;
  const y = bubbleBottom - boxHeight;
  if (y < PAD) {
    return null;
  }

  const x = g.dir > 0 ? width - PAD - boxWidth : PAD;
  // 尾巴放在靠鱼头的一侧，向下指向鱼头。
  const pointerX = g.dir > 0 ? x + boxWidth - 28 : x + 28;
  const tail = `M ${pointerX - 10} ${bubbleBottom - 1} L ${pointerX + 10} ${bubbleBottom - 1} L ${pointerX} ${bubbleBottom + EFFECT_TAIL_HEIGHT} Z`;

  return {
    box: {
      x,
      y,
      width: boxWidth,
      height: boxHeight,
      radius: 10,
    },
    lines: lines.map((line, index) => ({
      x: x + EFFECT_PAD_X,
      y: y + EFFECT_PAD_Y + (index + 0.5) * lineHeight,
      text: line,
      fontSize: effectFontSize,
      anchor: 'start',
    })),
    tail,
  };
}

/** 只有主干、鱼头鱼尾与问题气泡的退化布局。 */
function buildSkeleton(
  input: FishboneLayoutInput,
): Omit<FishboneLayout, 'droppedRows'> {
  const dir: 1 | -1 = input.headPosition === 'left' ? -1 : 1;
  const g = computeGeometry(input.width, input.height, dir);
  if (!g) {
    return {
      spine: { x1: 0, y1: 0, x2: 0, y2: 0, width: SPINE_WIDTH },
      headPath: '',
      headEye: { cx: 0, cy: 0, r: 0 },
      headGill: '',
      tailPath: '',
      effectBubble: null,
      effectLines: [],
      effectTail: '',
      bones: [],
    };
  }

  const effect = buildEffectBubble(
    input.effectName,
    input.baseFontSize,
    input.width,
    g,
  );

  return {
    spine: {
      x1: g.tailBaseX,
      y1: g.spineY,
      x2: g.headBaseX,
      y2: g.spineY,
      width: SPINE_WIDTH,
    },
    headPath: fishHeadPath(g),
    headEye: fishEye(g),
    headGill: fishGillPath(g),
    tailPath: fishTailPath(g),
    effectBubble: effect?.box ?? null,
    effectLines: effect?.lines ?? [],
    effectTail: effect?.tail ?? '',
    bones: [],
  };
}

/** 一根主骨的几何，排原因行时两侧都要用到。 */
interface SlotGeometry {
  slot: SlotDef;
  source: FishboneBone | undefined;
  label: string;
  pillWidth: number;
  anchorX: number;
  run: number;
  tipX: number;
  tipY: number;
  outward: -1 | 1;
  textDir: -1 | 1;
  /** 外侧与内侧各自允许的竖直铺开距离（距主干）。 */
  outerMax: number;
  innerMax: number;
}

/** 排原因行时用到的公共参数。 */
interface RowLayoutContext {
  width: number;
  spineY: number;
  dir: 1 | -1;
  fontSize: number;
  laneGap: number;
  showValues: boolean;
  formatValue: (value: number) => string;
  /** 主骨线宽，用来把箭头尖推到主骨边缘之外。 */
  boneThickness: number;
  /** 问题气泡；鱼头一侧的原因行要避开它。 */
  effect: EffectBubble | null;
}

/** 一根主骨的行分配方案。 */
interface BoneRowPlan {
  kept: FishboneRow[];
  outerCount: number;
  innerCount: number;
  /** 两侧都排不下的行数。 */
  dropped: number;
}

/** 按两侧容量分配原因行：外侧优先，溢出时在两侧之间尽量均分。 */
function planBoneRows(
  geo: SlotGeometry,
  rowHeight: number,
  laneGap: number,
): BoneRowPlan {
  const sourceRows = geo.source?.rows ?? [];
  const outerSpan = Math.max(0, geo.outerMax - laneGap);
  const outerSlots =
    geo.outerMax >= laneGap ? Math.floor(outerSpan / rowHeight) + 1 : 0;
  const innerSpan = Math.max(0, geo.innerMax - laneGap);
  const innerSlots =
    geo.innerMax >= laneGap ? Math.floor(innerSpan / rowHeight) + 1 : 0;

  const kept = sourceRows.slice(0, outerSlots + innerSlots);
  const dropped = sourceRows.length - kept.length;

  let outerCount = kept.length;
  let innerCount = 0;
  if (kept.length > outerSlots) {
    outerCount = Math.min(Math.ceil(kept.length / 2), outerSlots);
    innerCount = Math.min(kept.length - outerCount, innerSlots);
    const remaining = kept.length - outerCount - innerCount;
    if (remaining > 0) {
      outerCount += Math.min(remaining, outerSlots - outerCount);
    }
  }

  return { kept, outerCount, innerCount, dropped };
}

/**
 * 排一根主骨上的原因行。
 *
 * 外侧放得下时全部排在外侧，保持和参考图一致的疏朗感；外侧放不下时把行
 * 分到主骨两侧，由内侧继续承接，而不是丢掉多出来的原因。同一侧两根主骨都
 * 用到内侧时，以两根骨的中线为界、各让出半个 `INNER_GAP`；只有一根用到内侧
 * 时，文字可以一直用到另一根主骨旁边，避免把长原因白白截短。
 */
function layoutBoneRows(
  geo: SlotGeometry,
  other: SlotGeometry | null,
  plan: BoneRowPlan,
  otherUsesInner: boolean,
  context: RowLayoutContext,
): { rows: LaidOutRow[]; dropped: number } {
  const {
    width,
    spineY,
    dir,
    fontSize,
    laneGap,
    showValues,
    formatValue,
    boneThickness,
    effect,
  } = context;
  const rows: LaidOutRow[] = [];
  let dropped = plan.dropped;
  // 箭头尖退到主骨边缘之外，再留一段可见间隙。
  const arrowGap = boneThickness / 2 + ARROW_CLEARANCE;

  const place = (targets: FishboneRow[], isInner: boolean) => {
    if (!targets.length) {
      return;
    }
    const maxDistance = isInner ? geo.innerMax : geo.outerMax;
    const span = Math.max(0, maxDistance - laneGap);
    const spacing = targets.length > 1 ? span / (targets.length - 1) : 0;
    const sideDir: -1 | 1 = isInner
      ? geo.textDir === 1
        ? -1
        : 1
      : geo.textDir;

    targets.forEach((row, index) => {
      const distance = targets.length > 1 ? laneGap + index * spacing : laneGap;
      const y = spineY + geo.outward * distance;
      const boneX = geo.anchorX - dir * (distance / BONE_ANGLE_TAN);
      // 箭头从主骨旁边一点开始，箭头尖朝主骨但不与主骨线重叠。
      const arrowTipX = boneX + sideDir * arrowGap;
      const leaderEnd = boneX + sideDir * LEADER_LENGTH;

      let available: number;
      if (isInner) {
        // 另一根主骨在同一高度上的横坐标；它可能更短，到末端就钉住不动。
        const otherX = other
          ? other.anchorX -
            dir *
              (Math.min(distance, other.run * BONE_ANGLE_TAN) / BONE_ANGLE_TAN)
          : boneX;
        if (otherUsesInner) {
          // 两根骨的内侧都用上了：在中线处分界，各留半个间隙。
          const midpoint = (boneX + otherX) / 2;
          const boundary =
            midpoint + (sideDir > 0 ? -INNER_GAP / 2 : INNER_GAP / 2);
          available = sideDir > 0 ? boundary - leaderEnd : leaderEnd - boundary;
        } else {
          // 对侧不排内侧行，可以一直用到对侧主骨旁边，并给胶囊留出余量。
          const clearance = Math.max(
            INNER_GAP,
            (other?.pillWidth ?? 0) / 2 + 6,
          );
          available =
            sideDir > 0
              ? otherX - clearance - leaderEnd
              : leaderEnd - (otherX + clearance);
        }
      } else {
        let edgeLimit = sideDir < 0 ? PAD : width - PAD;
        // 问题气泡停在鱼头一侧的上方；同一高度上的原因行排到气泡旁边，
        // 而不是把整段高度让给气泡。气泡尾巴下方也按气泡宽度避让。
        if (effect && geo.slot.flow === 'head' && geo.slot.side === 'top') {
          const bubbleBandBottom =
            effect.box.y + effect.box.height + EFFECT_TAIL_HEIGHT + 8;
          if (y < bubbleBandBottom) {
            edgeLimit =
              sideDir > 0
                ? effect.box.x - 8
                : effect.box.x + effect.box.width + 8;
          }
        }
        available = sideDir < 0 ? leaderEnd - edgeLimit : edgeLimit - leaderEnd;
      }

      const valueText = showValues ? formatValue(row.value) : null;
      const valueWidth = valueText ? estimateTextWidth(valueText, fontSize) : 0;
      const labelMax = available - (valueText ? valueWidth + VALUE_GAP : 0);
      if (labelMax < fontSize * 1.6) {
        dropped += 1;
        return;
      }

      const displayLabel = truncateToWidth(row.label, fontSize, labelMax);
      // 箭头尖落在主骨旁，尾巴朝文字一侧，表示原因指向骨骼。
      const arrowBaseX = arrowTipX + sideDir * ARROW_LENGTH;
      const labelOffset = valueText ? valueWidth + VALUE_GAP : 0;

      rows.push({
        key: row.key,
        label: row.label,
        depth: row.depth,
        value: row.value,
        path: row.path,
        leader: {
          x1: arrowTipX,
          y1: y,
          x2: leaderEnd,
          y2: y,
          width: LEADER_WIDTH,
        },
        arrow: `M ${arrowTipX} ${y} L ${arrowBaseX} ${y - ARROW_HALF} L ${arrowBaseX} ${y + ARROW_HALF} Z`,
        labelText: {
          x: leaderEnd + sideDir * labelOffset,
          y,
          text: displayLabel,
          fontSize,
          anchor: sideDir < 0 ? 'end' : 'start',
        },
        valueText: valueText
          ? {
              x: leaderEnd,
              y,
              text: valueText,
              fontSize,
              anchor: sideDir < 0 ? 'end' : 'start',
            }
          : null,
      });
    });
  };

  place(plan.kept.slice(0, plan.outerCount), false);
  place(
    plan.kept.slice(plan.outerCount, plan.outerCount + plan.innerCount),
    true,
  );

  return { rows, dropped };
}

/**
 * 在给定字号下排一次完整布局。
 *
 * 每根主骨占一个固定的象限：主骨沿「背离鱼头」的方向斜出，原因行优先排在
 * 骨骼外侧；外侧排不下时继续排到内侧，行与行按固定行高展开，引线长度固定，
 * 因此相邻行不会压在一起。两侧都排满仍放不下的行才丢弃，数量计入 `dropped`。
 */
function attemptLayout(
  input: FishboneLayoutInput,
  fontSize: number,
): LayoutAttempt | null {
  const { width, height, showValues, formatValue } = input;
  const dir: 1 | -1 = input.headPosition === 'left' ? -1 : 1;
  const g = computeGeometry(width, height, dir);
  if (!g) {
    return null;
  }

  const spineLen = Math.abs(g.headBaseX - g.tailBaseX);
  if (spineLen < MIN_SPINE_LENGTH || g.spineY < PAD + fontSize * 2) {
    return null;
  }

  const effect = buildEffectBubble(input.effectName, fontSize, width, g);
  const boneFontSize = Math.max(fontSize + PILL_FONT_BONUS, PILL_MIN_FONT_SIZE);
  const pillHeight = boneFontSize + PILL_PAD_Y * 2;
  const rowHeight = fontSize * ROW_HEIGHT_RATIO;
  const laneGap = g.fishHalf + fontSize * 0.6;
  const boneByKey = new Map(input.bones.map(bone => [bone.key, bone]));
  const desiredRun = (g.spineY - PAD - pillHeight / 2) / BONE_ANGLE_TAN;

  // 先把四根主骨的几何都算出来：内侧排行时要用到对面那根骨的位置。
  const geometries: SlotGeometry[] = SLOTS.map(slot => {
    const source = boneByKey.get(slot.key);
    const label = source?.label ?? slot.key;
    const pillWidth = estimateTextWidth(label, boneFontSize) + PILL_PAD_X * 2;

    // 锚点沿主干按比例放置；鱼头在左时比例方向自动翻转。
    const flow = slot.flow === 'head' ? HEAD_FLOW : TAIL_FLOW;
    const anchorX = g.tailBaseX + flow * (g.headBaseX - g.tailBaseX);

    // 主骨朝背离鱼头的方向斜出，长度受画布边缘限制。
    const roomToEdge =
      dir > 0
        ? anchorX - PAD - pillWidth / 2
        : width - PAD - anchorX - pillWidth / 2;
    const run = Math.max(0, Math.min(desiredRun, roomToEdge));
    const tipX = anchorX - dir * run;
    const tipY =
      g.spineY + (slot.side === 'top' ? -1 : 1) * run * BONE_ANGLE_TAN;

    // 文字朝象限外侧排：鱼尾侧的骨头把文字排在鱼尾方向，鱼头侧反之。
    const textDir: -1 | 1 = slot.flow === 'tail' ? (dir > 0 ? -1 : 1) : dir;
    const outward: -1 | 1 = slot.side === 'top' ? -1 : 1;

    const baseMax = run * BONE_ANGLE_TAN - pillHeight / 2 - fontSize * 0.9;
    let outerMax = baseMax;

    // 文字排在鱼尾一侧时，越靠近骨骼末端，留给文字的横向空间越小。把铺开
    // 范围收到文字还放得下的位置，避免为了填满骨骼把末端几行挤到没有宽度。
    if (slot.flow === 'tail') {
      const sourceRows = source?.rows ?? [];
      const maxValueWidth = showValues
        ? sourceRows.reduce(
            (max, row) =>
              Math.max(
                max,
                estimateTextWidth(formatValue(row.value), fontSize),
              ),
            0,
          )
        : 0;
      // 从锚点朝鱼尾方向的可用横向空间，鱼头朝左时左右互换。
      const tailRoom = dir > 0 ? anchorX - PAD : width - PAD - anchorX;
      const usable =
        tailRoom -
        LEADER_LENGTH -
        fontSize * 1.6 -
        (maxValueWidth ? maxValueWidth + VALUE_GAP : 0);
      outerMax = Math.min(outerMax, usable * BONE_ANGLE_TAN);
    }

    return {
      slot,
      source,
      label,
      pillWidth,
      anchorX,
      run,
      tipX,
      tipY,
      outward,
      textDir,
      outerMax,
      innerMax: baseMax,
    };
  });

  // 同一侧的两根主骨互为内侧的边界参照。
  const bySide: Record<'top' | 'bottom', SlotGeometry[]> = {
    top: [],
    bottom: [],
  };
  geometries.forEach(geo => bySide[geo.slot.side].push(geo));

  // 先给每根主骨分配行数，内侧排版时才能知道对面那根骨是否也占用内侧。
  const plans = new Map(
    geometries.map(geo => [
      geo.slot.key,
      planBoneRows(geo, rowHeight, laneGap),
    ]),
  );

  const laidOutBones: LaidOutBone[] = [];
  let dropped = 0;

  geometries.forEach(geo => {
    const other =
      bySide[geo.slot.side].find(item => item.slot.key !== geo.slot.key) ??
      null;
    const plan = plans.get(geo.slot.key);
    if (!plan) {
      return;
    }
    const otherUsesInner = other
      ? (plans.get(other.slot.key)?.innerCount ?? 0) > 0
      : false;
    const { rows, dropped: rowDropped } = layoutBoneRows(
      geo,
      other,
      plan,
      otherUsesInner,
      {
        width,
        spineY: g.spineY,
        dir,
        fontSize,
        laneGap,
        showValues,
        formatValue,
        boneThickness: input.baseThickness,
        effect,
      },
    );
    dropped += rowDropped;

    // 大骨汇入主干处的箭头：箭头尖朝主干，并与主干留出间隙。
    const thickness = input.baseThickness;
    const dx = geo.tipX - geo.anchorX;
    const dy = geo.tipY - g.spineY;
    const boneLength = Math.hypot(dx, dy);
    const unitX = boneLength > 0 ? dx / boneLength : 0;
    const unitY = boneLength > 0 ? dy / boneLength : 0;
    const arrowGap = SPINE_WIDTH / 2 + MAIN_ARROW_GAP;
    const arrowLength = thickness * 1.6 + 4;
    const arrowHalf = thickness * 0.9 + 2;
    const arrowTipX = geo.anchorX + unitX * arrowGap;
    const arrowTipY = g.spineY + unitY * arrowGap;
    const arrowBaseX = geo.anchorX + unitX * (arrowGap + arrowLength);
    const arrowBaseY = g.spineY + unitY * (arrowGap + arrowLength);
    const perpX = -unitY;
    const perpY = unitX;

    laidOutBones.push({
      key: geo.slot.key,
      label: geo.label,
      value: geo.source?.value ?? 0,
      formattedValue: formatValue(geo.source?.value ?? 0),
      bone: {
        x1: arrowBaseX,
        y1: arrowBaseY,
        x2: geo.tipX,
        y2: geo.tipY,
        width: thickness,
      },
      baseArrow:
        boneLength > 0
          ? `M ${arrowTipX} ${arrowTipY} L ${arrowBaseX + perpX * arrowHalf} ${arrowBaseY + perpY * arrowHalf} L ${arrowBaseX - perpX * arrowHalf} ${arrowBaseY - perpY * arrowHalf} Z`
          : '',
      pill: {
        box: {
          x: geo.tipX - geo.pillWidth / 2,
          y: geo.tipY - pillHeight / 2,
          width: geo.pillWidth,
          height: pillHeight,
          radius: PILL_RADIUS,
        },
        text: {
          x: geo.tipX,
          y: geo.tipY,
          text: truncateToWidth(
            geo.label,
            boneFontSize,
            geo.pillWidth - PILL_PAD_X * 2,
          ),
          fontSize: boneFontSize,
          anchor: 'middle',
        },
      },
      rows,
    });
  });

  return {
    layout: {
      spine: {
        x1: g.tailBaseX,
        y1: g.spineY,
        x2: g.headBaseX,
        y2: g.spineY,
        width: SPINE_WIDTH,
      },
      headPath: fishHeadPath(g),
      headEye: fishEye(g),
      headGill: fishGillPath(g),
      tailPath: fishTailPath(g),
      effectBubble: effect?.box ?? null,
      effectLines: effect?.lines ?? [],
      effectTail: effect?.tail ?? '',
      bones: laidOutBones,
    },
    dropped,
  };
}

/**
 * 把鱼骨数据排布到给定画布上。
 *
 * 布局把四根主骨固定在四个象限里：每根主骨的位置、角度与问题气泡的位置都
 * 不随数据变化，只有原因行的多少会占用不同的行数。空间不足时先缩小字号，
 * 缩到下限仍放不下才丢弃每根主骨末尾的次要原因，丢弃数量放在 `droppedRows`
 * 里供渲染层提示。
 */
export default function computeFishboneLayout(
  input: FishboneLayoutInput,
): FishboneLayout {
  const totalRows = input.bones.reduce(
    (sum, bone) => sum + bone.rows.length,
    0,
  );

  if (!totalRows) {
    return { ...buildSkeleton(input), bones: [], droppedRows: 0 };
  }

  let best: LayoutAttempt | null = null;
  for (let step = 0; step < MAX_FONT_STEPS; step += 1) {
    const fontSize = input.baseFontSize - step;
    if (fontSize < MIN_FONT_SIZE) {
      break;
    }
    const attempt = attemptLayout(input, fontSize);
    if (!attempt) {
      continue;
    }
    // 字号越小通常越能放下，但两侧分配与宽度上限的联动偶尔会让更小的
    // 字号反而丢得更多；这里始终保留丢弃最少的那次，同数时保留字号更大的。
    if (!best || attempt.dropped < best.dropped) {
      best = attempt;
    }
    if (attempt.dropped === 0) {
      break;
    }
  }

  if (best) {
    return { ...best.layout, droppedRows: best.dropped };
  }

  // 画布小到连主干都放不下。
  return { ...buildSkeleton(input), bones: [], droppedRows: totalRows };
}
