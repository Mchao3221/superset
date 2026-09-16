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
  HeadPosition,
  LaidOutBone,
  LaidOutBox,
  LaidOutRow,
  LaidOutText,
} from '../types';
import estimateTextWidth, { truncateToWidth } from './textWidth';

/** 画布四周留白。 */
const PAD = 16;
/** 箭头的长度与半高。 */
const ARROW_LENGTH = 14;
const ARROW_HALF = 6;
/** 鱼头文字与箭头之间的间隙。 */
const HEAD_GAP = 8;
/** 鱼头外框相对文字的内边距。 */
const HEAD_BOX_PAD_X = 6;
const HEAD_BOX_PAD_Y = 4;
/** 鱼头外框的圆角半径。 */
const HEAD_BOX_RADIUS = 6;
/** 大骨标签越过骨骼末端的距离。 */
const BONE_LABEL_GAP = 6;
/**
 * 行高相对行字号的倍数。
 *
 * 单行标签之间的垂直间距。压得太紧时相邻两行看着挤在一起；调大它会让同一块
 * 画布能放下的行变少、字号被迫缩小，所以每加一档都要复核密集数据的表现。
 */
const ROW_HEIGHT_RATIO = 2.304;
/** 大骨标签占用高度相对其字号的倍数。 */
const BONE_LABEL_RATIO = 1.6;
/** 行引线的最短长度，保证标签不会贴到骨骼上。 */
const LEADER_MIN = 12;
/** 每深一层额外增加的引线长度，用作层级缩进。 */
const INDENT_PER_DEPTH = 14;
/** 标签与数值之间的间隙。 */
const VALUE_GAP = 8;
/**
 * 行字号下限。
 *
 * 空间不够时宁可少画几行，也不把字缩到看不清 —— 缩到这个字号仍放不下的行
 * 会被丢弃，数量在右下角如实提示。低于 12px 的中文在实际屏幕尺寸下已经很难
 * 辨认，所以下限就定在这里。
 */
const MIN_FONT_SIZE = 12;
/** 鱼头文字相对基准字号的上浮量。 */
const HEAD_FONT_BONUS = 2;
/** 大骨与主干的夹角（60 度）及其正切。 */
const BONE_ANGLE_TAN = Math.tan((60 * Math.PI) / 180);
/** 主干最短长度，短于此值说明横向空间已经不够。 */
const MIN_SPINE_LENGTH = 80;
/**
 * 骨骼沿主轴的间距，取「放得下」的最大间距的比例。
 *
 * 主干铺满画布能让骨骼摊得最开，但整条鱼会被拉得很长；收到 0.6 之后相邻两根
 * 挨得更近，鱼身随之变短，代价是画布左边会空出一块。
 */
const SPINE_SPACING_RATIO = 0.6;
/** 单条标签最多占用的横向比例，超出即截断，保证布局一定收敛。 */
const LABEL_WIDTH_BUDGET = 0.55;
/** 鱼头文字最多占用的横向比例。 */
const HEAD_WIDTH_BUDGET = 0.4;
/** 缩字号的尝试次数上限。 */
const MAX_FONT_STEPS = 12;
/** 大骨线宽相对基准线宽的最细／最粗倍数。 */
const THINNEST_RATIO = 0.55;
const THICKEST_RATIO = 1.45;
/** 兜底骨骼颜色，仅在配色表里查不到时使用。 */
const DEFAULT_BONE_COLOR = '#5b7fbd';
/**
 * 行引线（中骨／小骨）的固定线宽。
 *
 * 与骨骼一样按「粗一倍」的档位取值；比骨骼细一档，读图时才能一眼分出主干、
 * 大骨和挂在它们下面的具体原因。
 */
const LEADER_WIDTH = 2;
/**
 * 主干线宽。
 *
 * 与 `BONE_THICKNESS_PX`（见 ../types）的基准值同量级：主干是鱼骨的主心骨，
 * 比它分出去的骨骼还细的话，整条鱼看上去会散架。
 */
const SPINE_WIDTH = 5;

export interface FishboneLayoutInput {
  width: number;
  height: number;
  bones: FishboneBone[];
  /** 鱼头文字，即要分析的问题。 */
  effectName: string;
  headPosition: HeadPosition;
  showValues: boolean;
  /** 行标签的基准字号，由控件档位决定。 */
  baseFontSize: number;
  /** 大骨基准线宽，由控件档位决定。 */
  baseThickness: number;
  /** 大骨 key → 颜色。 */
  boneColors: Record<string, string>;
  formatValue: (value: number) => string;
}

/** 量算后的行：宽度与最终要画的文字都已确定。 */
interface MeasuredRow {
  row: FishboneRow;
  /** 实际画在画布上的文字（超长时已截断）。 */
  displayLabel: string;
  /** 从骨骼点到文字的引线长度，随层级递增。 */
  leaderLength: number;
  /** 数值文字，未开启或无度量时为 null。 */
  displayValue: string | null;
  labelWidth: number;
  valueWidth: number;
  /** 自骨骼点向左延伸的总距离。 */
  reach: number;
}

/** 量算后的骨骼：只含与位置无关的尺寸。 */
interface MeasuredBone {
  bone: FishboneBone;
  displayLabel: string;
  rows: MeasuredRow[];
  /** 大骨标签占用的高度。 */
  labelHeight: number;
  /** 整根骨骼在垂直方向占用的高度。 */
  height: number;
}

/** 已定位的骨骼：带有相对主干的垂直区间。 */
interface PositionedBone {
  measured: MeasuredBone;
  /** 内侧（靠近主干）与外侧（远离主干）距主干的垂直距离。 */
  inner: number;
  outer: number;
}

/**
 * 骨骼在主干上的槽位。
 *
 * 槽位序号决定骨骼的横向位置（序号越小越靠鱼头），`sign` 决定它画在主干
 * 的哪一侧。两者一一对应，因此每根骨骼在图上都有自己的位置。
 */
interface BoneSlot {
  item: PositionedBone;
  /** -1 表示画在主干上方，1 表示下方。 */
  sign: -1 | 1;
}

interface MeasureOptions {
  fontSize: number;
  boneFontSize: number;
  labelBudget: number;
  showValues: boolean;
  formatValue: (value: number) => string;
}

interface BoneRenderContext {
  input: FishboneLayoutInput;
  maxBoneValue: number;
  fontSize: number;
  boneFontSize: number;
  rowHeight: number;
}

interface BoneGeometry {
  context: BoneRenderContext;
  spineY: number;
  xRight: number;
  spineLength: number;
}

/** 一行行高，由行字号推出。 */
function rowHeightOf(fontSize: number): number {
  return fontSize * ROW_HEIGHT_RATIO;
}

/**
 * 一根骨骼自其锚点向左延伸的最大距离。
 *
 * 骨骼是斜的，行挂得越高，骨骼在那一点就越靠左；行自身还要再往左让出引线
 * 和文字。取两者的最大值，就是这根骨骼「最左能到哪」。
 *
 * 行的垂直位置要算上骨骼自身的带偏移 `item.inner`——同一侧靠外的骨骼，
 * 它的每一行都比靠内的骨骼整体更靠外、也更靠左。漏掉这一项会低估外侧
 * 骨骼的占用，主干就会解得过长，文字随之溢出画布。
 */
function boneReach(item: PositionedBone, rowHeight: number): number {
  let reach = item.outer / BONE_ANGLE_TAN;
  item.measured.rows.forEach((row, index) => {
    const distance = item.inner + (index + 0.5) * rowHeight;
    reach = Math.max(reach, distance / BONE_ANGLE_TAN + row.reach);
  });
  return reach;
}

/** 全局按数值降序保留前 `budget` 行，其余丢弃；大骨标签本身始终保留。 */
function keepTopRows(bones: FishboneBone[], budget: number): FishboneBone[] {
  const entries = bones.flatMap((bone, boneIndex) =>
    bone.rows.map((row, rowIndex) => ({ row, boneIndex, rowIndex })),
  );
  if (budget >= entries.length) {
    return bones;
  }
  const kept = new Set(
    [...entries]
      // 值相同时按原始顺序，保证结果稳定可复现。
      .sort(
        (a, b) =>
          b.row.value - a.row.value ||
          a.boneIndex - b.boneIndex ||
          a.rowIndex - b.rowIndex,
      )
      .slice(0, Math.max(0, budget))
      .map(entry => `${entry.boneIndex}:${entry.row.key}`),
  );
  return bones.map((bone, boneIndex) => ({
    ...bone,
    rows: bone.rows.filter(row => kept.has(`${boneIndex}:${row.key}`)),
  }));
}

/** 量出一根骨骼及其所有行的尺寸。文字截断在这里做一次，后续直接复用。 */
function measureBone(
  bone: FishboneBone,
  options: MeasureOptions,
): MeasuredBone {
  const { fontSize, boneFontSize, labelBudget, showValues, formatValue } =
    options;

  const rows = bone.rows.map(row => {
    const displayLabel = truncateToWidth(row.label, fontSize, labelBudget);
    const leaderLength =
      LEADER_MIN + Math.max(0, row.depth - 1) * INDENT_PER_DEPTH;
    const labelWidth = estimateTextWidth(displayLabel, fontSize);
    const displayValue = showValues ? formatValue(row.value) : null;
    const valueWidth = displayValue
      ? estimateTextWidth(displayValue, fontSize)
      : 0;
    return {
      row,
      displayLabel,
      leaderLength,
      displayValue,
      labelWidth,
      valueWidth,
      reach:
        leaderLength + labelWidth + (displayValue ? VALUE_GAP + valueWidth : 0),
    };
  });

  const labelHeight = boneFontSize * BONE_LABEL_RATIO;

  return {
    bone,
    displayLabel: truncateToWidth(bone.label, boneFontSize, labelBudget),
    rows,
    labelHeight,
    height: labelHeight + rows.length * rowHeightOf(fontSize),
  };
}

/** 按数值从大到小把骨骼分给当前更矮的一侧，让两侧高度尽量均衡。 */
function splitBySide(measured: MeasuredBone[]): {
  top: MeasuredBone[];
  bottom: MeasuredBone[];
} {
  const top: MeasuredBone[] = [];
  const bottom: MeasuredBone[] = [];
  let topHeight = 0;
  let bottomHeight = 0;

  [...measured]
    .sort((a, b) => b.bone.value - a.bone.value)
    .forEach(item => {
      if (topHeight <= bottomHeight) {
        top.push(item);
        topHeight += item.height;
      } else {
        bottom.push(item);
        bottomHeight += item.height;
      }
    });

  return { top, bottom };
}

/**
 * 把一侧的骨骼沿主干向外依次排开。
 *
 * 同一侧内按占用高度升序排列：占用小的贴近主干（骨骼短），占用大的排在外侧
 * （骨骼长），于是数据上更重要的分支同时获得更长的骨骼和更大的展开空间。
 *
 * 这里先按「一人一段、互不重叠」排出垂直带，再由 `shareHeights` 把能共用的
 * 骨骼并到一起。带子只是最保守的初始解。
 */
function positionSide(measured: MeasuredBone[]): PositionedBone[] {
  const ordered = [...measured].sort((a, b) => a.height - b.height);

  let cursor = 0;
  return ordered.map(item => {
    const inner = cursor;
    cursor += item.height;
    return { measured: item, inner, outer: cursor };
  });
}

/** 一根骨骼里所有行向左伸得最远的距离（含引线与数值）。 */
function rowsReach(item: PositionedBone): number {
  return item.measured.rows.reduce((max, row) => Math.max(max, row.reach), 0);
}

/**
 * 把同一侧里「挤得下」的骨骼并到同一段高度上。
 *
 * 每根骨骼的行动辄两三百像素宽（引线 + 标签 + 数值），同一侧相邻两根如果高度
 * 区间重叠，右边那根的文字就会盖住左边那根的行。但横向间隔够大时两者互不
 * 干涉，这时它们**可以共用同一段高度** —— 这才是鱼骨图常见的画法：同一侧的
 * 骨头各占一段主轴，原因都贴着主干往上排。按占用高度依次错开只是没办法时
 * 的退让，会让外侧骨骼在内侧骨骼占的那段高度里空一大块。
 *
 * 共用要同时满足两个条件，任一不满足就退回错开：
 * 1. 横向间隔容得下右侧骨骼整行的宽度（`rowsReach`）；
 * 2. 自己的行数不多于右侧骨骼，否则多出来的行会顶进右侧骨骼标签所在的外端。
 *
 * @param gap 同一侧相邻两根骨骼的锚点间距。
 */
function shareHeights(side: PositionedBone[], gap: number): PositionedBone[] {
  const bases: number[] = [];

  return side.map((item, index) => {
    const rowCount = item.measured.rows.length;
    let base = 0;

    side.slice(0, index).forEach((other, otherIndex) => {
      const shareable =
        gap >= rowsReach(other) &&
        rowCount <= other.measured.rows.length;
      if (!shareable) {
        // 让不开就退到它后面，等价于原来的分带行为。
        base = Math.max(base, bases[otherIndex] + other.measured.height);
      }
    });

    bases[index] = base;
    return {
      ...item,
      inner: base,
      outer: base + item.measured.height,
    };
  });
}

/** 一侧骨骼占用的总高度。 */
function sideExtent(side: PositionedBone[]): number {
  return side.reduce((max, item) => Math.max(max, item.outer), 0);
}

/**
 * 把两侧的骨骼交织成「上、下、上、下」的一条序列。
 *
 * 两侧各自沿主干铺开的话，上下的第 k 根骨骼会落在同一个横坐标上，整幅图
 * 变成左右对称的镜像梳子，既不好看也拉不开层次。交织之后每根骨骼独占一个
 * 横坐标，相邻两根分处主干两侧，才是鱼骨图惯常的交错排布。
 */
function interleaveSides(
  top: PositionedBone[],
  bottom: PositionedBone[],
): BoneSlot[] {
  const slots: BoneSlot[] = [];
  for (let index = 0; index < Math.max(top.length, bottom.length); index += 1) {
    if (index < top.length) {
      slots.push({ item: top[index], sign: -1 });
    }
    if (index < bottom.length) {
      slots.push({ item: bottom[index], sign: 1 });
    }
  }
  return slots;
}

/**
 * 反解主干长度。
 *
 * 骨骼沿主干等距分布，第 k 个槽位（从 1 数起）的锚点在
 * `xRight - (k - 0.5) * L / n`。它自锚点向左延伸 `reach` 后不得越过 `PAD`，
 * 每个槽位给出一个 L 的上界，取最小值即为可行解。无解（或主干短到不可用）
 * 时返回 null。
 */
function solveSpineLength(
  slots: BoneSlot[],
  rowHeight: number,
  xRight: number,
): number | null {
  let limit = xRight - PAD;
  const count = slots.length;

  slots.forEach((slot, index) => {
    const k = index + 1;
    const slack = xRight - PAD - boneReach(slot.item, rowHeight);
    // L <= count * slack / (k - 0.5)
    limit = Math.min(limit, (count * slack) / (k - 0.5));
  });

  if (!Number.isFinite(limit) || limit < MIN_SPINE_LENGTH) {
    return null;
  }
  return limit;
}

/** 大骨线宽按数值在基准线宽的 0.55～1.45 倍之间线性映射。 */
function boneStrokeWidth(
  value: number,
  maxValue: number,
  input: FishboneLayoutInput,
): number {
  const ratio = maxValue > 0 ? Math.max(0, Math.min(1, value / maxValue)) : 1;
  return (
    input.baseThickness *
    (THINNEST_RATIO + (THICKEST_RATIO - THINNEST_RATIO) * ratio)
  );
}

/** 生成一根骨骼及其所有行的最终坐标。 */
function layoutBone(
  slot: BoneSlot,
  slotIndex: number,
  slotCount: number,
  geometry: BoneGeometry,
): LaidOutBone {
  const { context, spineY, xRight, spineLength } = geometry;
  const { input, maxBoneValue, fontSize, boneFontSize, rowHeight } = context;
  const { sign } = slot;
  const { measured, inner, outer } = slot.item;

  const anchorX = xRight - ((slotIndex + 0.5) * spineLength) / slotCount;
  const tipY = spineY + sign * outer;
  const tipX = anchorX - outer / BONE_ANGLE_TAN;

  const rows: LaidOutRow[] = measured.rows.map((row, rowIndex) => {
    const distance = inner + (rowIndex + 0.5) * rowHeight;
    const leaderY = spineY + sign * distance;
    const leaderX = anchorX - distance / BONE_ANGLE_TAN;
    const leaderEnd = leaderX - row.leaderLength;
    const hasValue = row.displayValue !== null;

    return {
      key: row.row.key,
      label: row.row.label,
      depth: row.row.depth,
      value: row.row.value,
      path: row.row.path,
      leader: {
        x1: leaderX,
        y1: leaderY,
        x2: leaderEnd,
        y2: leaderY,
        width: LEADER_WIDTH,
      },
      labelText: {
        x: hasValue ? leaderEnd - row.valueWidth - VALUE_GAP : leaderEnd,
        y: leaderY,
        text: row.displayLabel,
        fontSize,
        anchor: 'end',
      },
      valueText: hasValue
        ? {
            x: leaderEnd,
            y: leaderY,
            text: row.displayValue as string,
            fontSize,
            anchor: 'end',
          }
        : null,
    };
  });

  const strokeWidth = boneStrokeWidth(
    measured.bone.value,
    maxBoneValue,
    input,
  );

  return {
    key: measured.bone.key,
    label: measured.bone.label,
    value: measured.bone.value,
    formattedValue: input.formatValue(measured.bone.value),
    strokeWidth,
    color: input.boneColors[measured.bone.key] ?? DEFAULT_BONE_COLOR,
    bone: { x1: anchorX, y1: spineY, x2: tipX, y2: tipY, width: strokeWidth },
    labelText: {
      x: tipX - BONE_LABEL_GAP,
      y: spineY + sign * (outer - measured.labelHeight / 2),
      text: measured.displayLabel,
      fontSize: boneFontSize,
      anchor: 'end',
    },
    rows,
  };
}

/**
 * 鱼头文字外面那圈圆角矩形：把要分析的问题框起来，让它在整幅图里最显眼。
 *
 * 文字在鱼头朝右时左对齐、镜像后右对齐，两种都要量出完整宽度，框才不会偏
 * 到文字的一边。文字本身是垂直居中于主干的，框跟着它的中线走。
 */
function headBoxOf(text: LaidOutText | null): LaidOutBox | null {
  if (!text) {
    return null;
  }
  const textWidth = estimateTextWidth(text.text, text.fontSize);
  const height = text.fontSize + HEAD_BOX_PAD_Y * 2;

  return {
    x: (text.anchor === 'end' ? text.x - textWidth : text.x) - HEAD_BOX_PAD_X,
    y: text.y - height / 2,
    width: textWidth + HEAD_BOX_PAD_X * 2,
    height,
    radius: HEAD_BOX_RADIUS,
  };
}

/** 主干末端的箭头。方向取自主干朝向，因此镜像后无需再单独判断。 */
function withArrow(
  layout: Omit<FishboneLayout, 'droppedRows'>,
): Omit<FishboneLayout, 'droppedRows'> {
  const { x1, x2, y1 } = layout.spine;
  const direction = Math.sign(x2 - x1) || 1;
  const tipX = x2 + direction * ARROW_LENGTH;
  return {
    ...layout,
    arrow: `M ${x2} ${y1 - ARROW_HALF} L ${tipX} ${y1} L ${x2} ${
      y1 + ARROW_HALF
    } Z`,
  };
}

/** 布局里每一处横坐标的搬运规则。 */
interface XMap {
  /** 线段端点的映射。 */
  edge: (x: number) => number;
  /** 矩形左边缘的映射：镜像时矩形的右边缘才是新的左边缘。 */
  boxLeft: (box: LaidOutBox) => number;
  /** 文字的对齐方向是否跟着翻。 */
  flipAnchors: boolean;
}

/**
 * 按同一套规则重算布局里所有的横坐标，其余部分原样保留。
 *
 * 镜像与居中都是这套「搬坐标」，只是规则不同，因此共用一份遍历。箭头的路径
 * 是坐标拼出来的字符串，搬不动，这里一律清空，由调用方最后用 `withArrow`
 * 依搬完的主干重算。
 */
function mapLayoutX(
  layout: Omit<FishboneLayout, 'droppedRows'>,
  xmap: XMap,
): Omit<FishboneLayout, 'droppedRows'> {
  const flipAnchor = (anchor: LaidOutText['anchor']): LaidOutText['anchor'] =>
    anchor === 'start' ? 'end' : anchor === 'end' ? 'start' : 'middle';
  const mapText = (text: LaidOutText): LaidOutText => ({
    ...text,
    x: xmap.edge(text.x),
    anchor: xmap.flipAnchors ? flipAnchor(text.anchor) : text.anchor,
  });
  const mapLine = <T extends { x1: number; x2: number }>(line: T): T => ({
    ...line,
    x1: xmap.edge(line.x1),
    x2: xmap.edge(line.x2),
  });

  return {
    spine: mapLine(layout.spine),
    arrow: '',
    headText: layout.headText ? mapText(layout.headText) : null,
    headBox: layout.headBox
      ? { ...layout.headBox, x: xmap.boxLeft(layout.headBox) }
      : null,
    bones: layout.bones.map(bone => ({
      ...bone,
      bone: mapLine(bone.bone),
      labelText: mapText(bone.labelText),
      rows: bone.rows.map(row => ({
        ...row,
        leader: mapLine(row.leader),
        labelText: mapText(row.labelText),
        valueText: row.valueText ? mapText(row.valueText) : null,
      })),
    })),
  };
}

/**
 * 把整幅图沿垂直中轴镜像，供鱼头在左侧时使用。
 *
 * 布局本身只按「鱼头在右」推算，镜像放在最后一步，避免同一套几何写两遍。
 * 文字只翻坐标不翻内容，同时把对齐方向对调，保证文字仍然正着读。
 */
function mirror(
  layout: Omit<FishboneLayout, 'droppedRows'>,
  width: number,
): Omit<FishboneLayout, 'droppedRows'> {
  return mapLayoutX(layout, {
    edge: x => width - x,
    boxLeft: box => width - (box.x + box.width),
    flipAnchors: true,
  });
}

/**
 * 布局里所有图元的横向范围。文字按 `anchor` 换算出实际延伸，箭头算到尖端。
 */
function horizontalExtents(layout: Omit<FishboneLayout, 'droppedRows'>): {
  left: number;
  right: number;
} {
  let left = Math.min(layout.spine.x1, layout.spine.x2);
  let right = Math.max(layout.spine.x1, layout.spine.x2);

  const extend = (node: LaidOutText | null) => {
    if (!node) {
      return;
    }
    const textWidth = estimateTextWidth(node.text, node.fontSize);
    const start =
      node.anchor === 'end'
        ? node.x - textWidth
        : node.anchor === 'middle'
          ? node.x - textWidth / 2
          : node.x;
    left = Math.min(left, start);
    right = Math.max(right, start + textWidth);
  };
  const extendBox = (box: LaidOutBox | null) => {
    if (box) {
      left = Math.min(left, box.x);
      right = Math.max(right, box.x + box.width);
    }
  };

  extend(layout.headText);
  extendBox(layout.headBox);
  layout.bones.forEach(bone => {
    left = Math.min(left, bone.bone.x1, bone.bone.x2);
    right = Math.max(right, bone.bone.x1, bone.bone.x2);
    extend(bone.labelText);
    bone.rows.forEach(row => {
      left = Math.min(left, row.leader.x1, row.leader.x2);
      right = Math.max(right, row.leader.x1, row.leader.x2);
      extend(row.labelText);
      extend(row.valueText);
    });
  });

  // 箭头尖比主干末端还突出一截。
  const direction = Math.sign(layout.spine.x2 - layout.spine.x1) || 1;
  right = Math.max(right, layout.spine.x2 + direction * ARROW_LENGTH);

  return { left, right };
}

/**
 * 把整幅图水平居中。
 *
 * 骨骼间距按比例收紧之后，主轴不再铺满画布，剩下的空白会全堆在鱼头对面的
 * 那一侧（鱼头朝右就全在左边），看上去整条鱼贴着一边。这里按所有图元的实际
 * 横向范围整体平移，让左右留白相等。
 */
function centerHorizontally(
  layout: Omit<FishboneLayout, 'droppedRows'>,
  width: number,
): Omit<FishboneLayout, 'droppedRows'> {
  const { left, right } = horizontalExtents(layout);
  const shift = (width - (right - left)) / 2 - left;

  return mapLayoutX(layout, {
    edge: x => x + shift,
    boxLeft: box => box.x + shift,
    flipAnchors: false,
  });
}

/** 无数据或画布过小时的退化布局：只有主干与鱼头。 */
function emptyLayout(
  input: FishboneLayoutInput,
  droppedRows: number,
): FishboneLayout {
  const { width, height, effectName, headPosition } = input;
  const spineY = height / 2;
  const fontSize = input.baseFontSize + HEAD_FONT_BONUS;
  const headText = effectName
    ? truncateToWidth(effectName, fontSize, width * HEAD_WIDTH_BUDGET)
    : '';
  const headWidth = headText ? estimateTextWidth(headText, fontSize) : 0;
  // 外框右边那圈内边距也要算进去，否则框会越过画布右侧的留白。
  const headBlock = headText
    ? headWidth + HEAD_GAP + ARROW_LENGTH + HEAD_BOX_PAD_X
    : 0;
  const xRight = Math.max(PAD, width - PAD - headBlock);
  const xLeft = Math.max(0, Math.min(PAD, xRight - MIN_SPINE_LENGTH));

  const headNode: LaidOutText | null = headText
    ? {
        x: xRight + ARROW_LENGTH + HEAD_GAP,
        y: spineY,
        text: headText,
        fontSize,
        anchor: 'start',
      }
    : null;

  const layout: Omit<FishboneLayout, 'droppedRows'> = {
    spine: { x1: xLeft, y1: spineY, x2: xRight, y2: spineY, width: SPINE_WIDTH },
    arrow: '',
    headText: headNode,
    headBox: headBoxOf(headNode),
    bones: [],
  };

  const oriented = headPosition === 'left' ? mirror(layout, width) : layout;
  return {
    ...withArrow(centerHorizontally(oriented, width)),
    droppedRows,
  };
}

/**
 * 在给定字号下尝试一次完整布局。返回 null 表示这个字号放不下，
 * 调用方需要缩小字号或减少数据。
 */
function attemptLayout(
  bones: FishboneBone[],
  fontSize: number,
  input: FishboneLayoutInput,
): Omit<FishboneLayout, 'droppedRows'> | null {
  const { width, height, effectName, showValues, headPosition } = input;
  const boneFontSize = fontSize + 1;

  // 鱼头先量出来，它的宽度决定主干右端能伸到哪里。
  const headFontSize = fontSize + HEAD_FONT_BONUS;
  const headText = truncateToWidth(
    effectName,
    headFontSize,
    width * HEAD_WIDTH_BUDGET,
  );
  const headWidth = headText ? estimateTextWidth(headText, headFontSize) : 0;
  // 外框右边那圈内边距也要算进去，否则框会越过画布右侧的留白。
  const headBlock = headText
    ? headWidth + HEAD_GAP + ARROW_LENGTH + HEAD_BOX_PAD_X
    : 0;

  const xRight = width - PAD - headBlock;
  if (xRight - PAD < MIN_SPINE_LENGTH) {
    return null;
  }

  const labelBudget = (xRight - PAD) * LABEL_WIDTH_BUDGET;

  const measured = bones.map(bone =>
    measureBone(bone, {
      fontSize,
      boneFontSize,
      labelBudget,
      showValues,
      formatValue: input.formatValue,
    }),
  );

  const { top, bottom } = splitBySide(measured);
  const spineY = height / 2;
  const availableHeight = spineY - PAD;
  if (availableHeight <= 0) {
    return null;
  }

  const rowHeight = rowHeightOf(fontSize);
  // 求主干长度要用最保守的分带解：带子越靠外，骨骼的占用越大，解出来的
  // 主干越短。先按它定长度，再在固定长度下把能共用的骨骼并起来。
  const bandTop = positionSide(top);
  const bandBottom = positionSide(bottom);
  const bandSlots = interleaveSides(bandTop, bandBottom);
  const maxSpineLength = solveSpineLength(bandSlots, rowHeight, xRight);
  if (maxSpineLength === null) {
    return null;
  }
  // 间距按比例收紧。解出来的长度是「放得下」的上界，缩短只会让锚点右移，
  // 因此收紧后每根骨骼的引线与文字依然落在画布内。
  const spineLength = maxSpineLength * SPINE_SPACING_RATIO;
  const xLeft = xRight - spineLength;

  // 同一侧相邻两根的锚点间距：槽位等距分布，隔一个槽位就是同一侧。
  const sameSideGap = (2 * spineLength) / bandSlots.length;
  const positionedTop = shareHeights(bandTop, sameSideGap);
  const positionedBottom = shareHeights(bandBottom, sameSideGap);
  if (
    Math.max(sideExtent(positionedTop), sideExtent(positionedBottom)) >
    availableHeight
  ) {
    return null;
  }

  const slots = interleaveSides(positionedTop, positionedBottom);
  const maxBoneValue = bones.reduce((max, bone) => Math.max(max, bone.value), 0);

  const context: BoneRenderContext = {
    input,
    maxBoneValue,
    fontSize,
    boneFontSize,
    rowHeight,
  };

  const laidOutBones: LaidOutBone[] = slots.map((slot, index) =>
    layoutBone(slot, index, slots.length, {
      context,
      spineY,
      xRight,
      spineLength,
    }),
  );

  const headNode: LaidOutText | null = headText
    ? {
        x: xRight + ARROW_LENGTH + HEAD_GAP,
        y: spineY,
        text: headText,
        fontSize: headFontSize,
        anchor: 'start',
      }
    : null;

  const layout: Omit<FishboneLayout, 'droppedRows'> = {
    spine: {
      x1: xLeft,
      y1: spineY,
      x2: xRight,
      y2: spineY,
      width: SPINE_WIDTH,
    },
    arrow: '',
    headText: headNode,
    headBox: headBoxOf(headNode),
    bones: laidOutBones,
  };

  const oriented = headPosition === 'left' ? mirror(layout, width) : layout;
  return withArrow(centerHorizontally(oriented, width));
}

/** 大骨过多时的兜底：只保留数值最高的一批，直到能放下为止。 */
function keepTopBones(
  bones: FishboneBone[],
  input: FishboneLayoutInput,
): FishboneBone[] {
  const sorted = [...bones].sort((a, b) => b.value - a.value);
  for (let count = sorted.length; count > 0; count -= 1) {
    const kept = sorted.slice(0, count);
    if (attemptLayout(kept, MIN_FONT_SIZE, input)) {
      return kept;
    }
  }
  return [];
}

/**
 * 二分找出此刻还能画下的最大行数。
 *
 * 保留的行按数值全局降序选取，因此被丢掉的永远是次要原因。返回 null 表示
 * 一行不留也放不下，需要调用方继续放宽条件。
 */
function fitRowBudget(
  bones: FishboneBone[],
  totalRows: number,
  input: FishboneLayoutInput,
): number | null {
  if (!attemptLayout(keepTopRows(bones, 0), MIN_FONT_SIZE, input)) {
    return null;
  }
  let low = 0;
  let high = totalRows;
  while (low < high) {
    // 向上取整，保证在 low < high 时 mid > low，循环必然收敛。
    const mid = Math.ceil((low + high) / 2);
    const attempt = attemptLayout(keepTopRows(bones, mid), MIN_FONT_SIZE, input);
    if (attempt) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

/**
 * 把鱼骨数据排布到给定画布上。
 *
 * 布局分四步：
 * 1. **分侧** —— 按数值从大到小依次把大骨分给当前更空的一侧，让上下两侧
 *    的高度尽量接近，避免一侧很挤、另一侧很空。
 * 2. **分带** —— 同一侧内，占用高度小的骨骼排在靠近主干的位置，占用大的排
 *    在外侧。同一侧各骨骼的垂直带互不重叠，因此行与行之间绝不会压在一起。
 * 3. **交错** —— 把两侧的骨骼按「上、下、上、下」交织成一条序列，每根骨骼
 *    独占主轴上的一段，形成上下交错的鱼骨，而不是左右对称的镜像。
 * 4. **求主干长度** —— 主干越长骨骼越舒展，但每根骨骼向左延伸的距离是确定
 *    的，于是可以反解出主干最多能有多长而不让文字越出画布。
 *
 * 空间不足时优先缩字号，缩到下限仍不够才丢弃数值最低的行，丢弃数量放在
 * `droppedRows` 里供渲染层提示。
 */
export default function computeFishboneLayout(
  input: FishboneLayoutInput,
): FishboneLayout {
  const { bones, baseFontSize } = input;
  const totalRows = bones.reduce((sum, bone) => sum + bone.rows.length, 0);

  if (!bones.length) {
    return emptyLayout(input, 0);
  }

  // 阶段一：优先缩字号，尽量把数据完整画下。
  for (let step = 0; step < MAX_FONT_STEPS; step += 1) {
    const fontSize = baseFontSize - step;
    if (fontSize < MIN_FONT_SIZE) {
      break;
    }
    const attempt = attemptLayout(bones, fontSize, input);
    if (attempt) {
      return { ...attempt, droppedRows: 0 };
    }
  }

  // 阶段二：字号已到底，改为丢弃数值最低的行。
  if (totalRows > 0) {
    const budget = fitRowBudget(bones, totalRows, input);
    if (budget !== null) {
      const attempt = attemptLayout(
        keepTopRows(bones, budget),
        MIN_FONT_SIZE,
        input,
      );
      if (attempt) {
        return { ...attempt, droppedRows: totalRows - budget };
      }
    }
  }

  // 阶段三：行都丢光了仍放不下（例如大骨本身太多），按数值丢弃大骨。
  const keptBones = keepTopBones(bones, input);
  const attempt = attemptLayout(keptBones, MIN_FONT_SIZE, input);
  if (attempt) {
    return { ...attempt, droppedRows: totalRows };
  }

  // 画布实在太小，退化成只画主干和鱼头。
  return emptyLayout(input, totalRows);
}
