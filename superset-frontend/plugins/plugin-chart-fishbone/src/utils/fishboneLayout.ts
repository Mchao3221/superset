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
/** 大骨标签越过骨骼末端的距离。 */
const BONE_LABEL_GAP = 6;
/** 行高相对行字号的倍数。 */
const ROW_HEIGHT_RATIO = 1.85;
/** 大骨标签占用高度相对其字号的倍数。 */
const BONE_LABEL_RATIO = 1.6;
/** 行引线的最短长度，保证标签不会贴到骨骼上。 */
const LEADER_MIN = 12;
/** 每深一层额外增加的引线长度，用作层级缩进。 */
const INDENT_PER_DEPTH = 14;
/** 标签与数值之间的间隙。 */
const VALUE_GAP = 8;
/** 行字号下限，再小就看不清了，此时改为丢弃数据。 */
const MIN_FONT_SIZE = 9;
/** 鱼头文字相对基准字号的上浮量。 */
const HEAD_FONT_BONUS = 2;
/** 大骨与主干的夹角（60 度）及其正切。 */
const BONE_ANGLE_TAN = Math.tan((60 * Math.PI) / 180);
/** 主干最短长度，短于此值说明横向空间已经不够。 */
const MIN_SPINE_LENGTH = 80;
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
/** 行引线的固定线宽。 */
const LEADER_WIDTH = 1;
/** 主干线宽。 */
const SPINE_WIDTH = 2.5;

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
  /** -1 表示画在主干上方，1 表示下方。 */
  sign: -1 | 1;
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

/** 一侧骨骼占用的总高度。 */
function sideExtent(side: PositionedBone[]): number {
  return side.reduce((max, item) => Math.max(max, item.outer), 0);
}

/**
 * 反解主干长度。
 *
 * 同一侧的骨骼沿主干等距分布，第 k 根锚点在 `xRight - (k - 0.5) * L / n`。
 * 它自锚点向左延伸 `reach` 后不得越过 `PAD`，每根骨骼给出一个 L 的上界，
 * 取最小值即为可行解。无解（或主干短到不可用）时返回 null。
 */
function solveSpineLength(
  sides: PositionedBone[][],
  rowHeight: number,
  xRight: number,
): number | null {
  let limit = xRight - PAD;

  sides.forEach(side => {
    const count = side.length;
    if (!count) {
      return;
    }
    side.forEach((item, index) => {
      const k = index + 1;
      const slack = xRight - PAD - boneReach(item, rowHeight);
      // L <= count * slack / (k - 0.5)
      limit = Math.min(limit, (count * slack) / (k - 0.5));
    });
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
  item: PositionedBone,
  side: PositionedBone[],
  geometry: BoneGeometry,
): LaidOutBone {
  const { context, spineY, sign, xRight, spineLength } = geometry;
  const { input, maxBoneValue, fontSize, boneFontSize, rowHeight } = context;
  const { measured } = item;

  const index = side.indexOf(item);
  const anchorX = xRight - ((index + 0.5) * spineLength) / side.length;
  const tipY = spineY + sign * item.outer;
  const tipX = anchorX - item.outer / BONE_ANGLE_TAN;

  const rows: LaidOutRow[] = measured.rows.map((row, rowIndex) => {
    const distance = item.inner + (rowIndex + 0.5) * rowHeight;
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
        boneKey: measured.bone.key,
      },
      valueText: hasValue
        ? {
            x: leaderEnd,
            y: leaderY,
            text: row.displayValue as string,
            fontSize,
            anchor: 'end',
            boneKey: measured.bone.key,
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
      y: spineY + sign * (item.outer - measured.labelHeight / 2),
      text: measured.displayLabel,
      fontSize: boneFontSize,
      anchor: 'end',
      boneKey: measured.bone.key,
    },
    rows,
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
  const flipX = (x: number) => width - x;
  const flipAnchor = (anchor: LaidOutText['anchor']): LaidOutText['anchor'] =>
    anchor === 'start' ? 'end' : anchor === 'end' ? 'start' : 'middle';
  const flipText = (text: LaidOutText): LaidOutText => ({
    ...text,
    x: flipX(text.x),
    anchor: flipAnchor(text.anchor),
  });
  const flipLine = <T extends { x1: number; x2: number }>(line: T): T => ({
    ...line,
    x1: flipX(line.x1),
    x2: flipX(line.x2),
  });

  return withArrow({
    spine: flipLine(layout.spine),
    arrow: '',
    headText: layout.headText ? flipText(layout.headText) : null,
    bones: layout.bones.map(bone => ({
      ...bone,
      bone: flipLine(bone.bone),
      labelText: flipText(bone.labelText),
      rows: bone.rows.map(row => ({
        ...row,
        leader: flipLine(row.leader),
        labelText: flipText(row.labelText),
        valueText: row.valueText ? flipText(row.valueText) : null,
      })),
    })),
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
  const headBlock = headText ? headWidth + HEAD_GAP + ARROW_LENGTH : 0;
  const xRight = Math.max(PAD, width - PAD - headBlock);
  const xLeft = Math.max(0, Math.min(PAD, xRight - MIN_SPINE_LENGTH));

  const layout: Omit<FishboneLayout, 'droppedRows'> = {
    spine: { x1: xLeft, y1: spineY, x2: xRight, y2: spineY, width: SPINE_WIDTH },
    arrow: '',
    headText: headText
      ? {
          x: xRight + ARROW_LENGTH + HEAD_GAP,
          y: spineY,
          text: headText,
          fontSize,
          anchor: 'start',
        }
      : null,
    bones: [],
  };

  const finalised =
    headPosition === 'left' ? mirror(layout, width) : withArrow(layout);
  return { ...finalised, droppedRows };
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
  const headBlock = headText ? headWidth + HEAD_GAP + ARROW_LENGTH : 0;

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

  const positionedTop = positionSide(top);
  const positionedBottom = positionSide(bottom);
  const rowHeight = rowHeightOf(fontSize);
  if (
    Math.max(sideExtent(positionedTop), sideExtent(positionedBottom)) >
    availableHeight
  ) {
    return null;
  }

  const spineLength = solveSpineLength(
    [positionedTop, positionedBottom],
    rowHeight,
    xRight,
  );
  if (spineLength === null) {
    return null;
  }
  const xLeft = xRight - spineLength;
  const maxBoneValue = bones.reduce((max, bone) => Math.max(max, bone.value), 0);

  const context: BoneRenderContext = {
    input,
    maxBoneValue,
    fontSize,
    boneFontSize,
    rowHeight,
  };

  const laidOutBones: LaidOutBone[] = [
    ...positionedTop.map(item =>
      layoutBone(item, positionedTop, {
        context,
        spineY,
        sign: -1,
        xRight,
        spineLength,
      }),
    ),
    ...positionedBottom.map(item =>
      layoutBone(item, positionedBottom, {
        context,
        spineY,
        sign: 1,
        xRight,
        spineLength,
      }),
    ),
  ];

  const layout: Omit<FishboneLayout, 'droppedRows'> = {
    spine: {
      x1: xLeft,
      y1: spineY,
      x2: xRight,
      y2: spineY,
      width: SPINE_WIDTH,
    },
    arrow: '',
    headText: headText
      ? {
          x: xRight + ARROW_LENGTH + HEAD_GAP,
          y: spineY,
          text: headText,
          fontSize: headFontSize,
          anchor: 'start',
        }
      : null,
    bones: laidOutBones,
  };

  return headPosition === 'left' ? mirror(layout, width) : withArrow(layout);
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
 * 布局分三步：
 * 1. **分侧** —— 按数值从大到小依次把大骨分给当前更空的一侧，让上下两侧
 *    的高度尽量接近，避免一侧很挤、另一侧很空。
 * 2. **分带** —— 同一侧内，占用高度小的骨骼排在靠近主干的位置，占用大的排
 *    在外侧。同一侧各骨骼的垂直带互不重叠，因此行与行之间绝不会压在一起。
 * 3. **求主干长度** —— 主干越长骨骼越舒展，但每根骨骼向左延伸的距离是确定
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
