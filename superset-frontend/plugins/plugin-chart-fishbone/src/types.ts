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
import { DataRecord, QueryFormData, QueryFormMetric } from '@superset-ui/core';

/** 鱼头（要分析的问题）摆在主干的哪一端。 */
export type HeadPosition = 'right' | 'left';

/**
 * 固定的四根主骨。
 *
 * 鱼骨图按经典的「人、物、法、环」四分法组织：数据第一层维度的取值会归入
 * 这四个分类之一，分类之外的取值不参与绘制。
 */
export const FIXED_BONE_LABELS = ['人', '物', '法', '环'] as const;

export type FixedBoneLabel = (typeof FIXED_BONE_LABELS)[number];

/** 标签字号档位，落到具体像素值见 utils/fishboneLayout。 */
export type FontSizeKey = 's' | 'm' | 'l';

/** 大骨基准线宽档位。 */
export type BoneThicknessKey = 'thin' | 'medium' | 'thick';

/** 每一档对应的像素值，控件与布局共用同一份定义。 */
export const FONT_SIZE_PX: Record<FontSizeKey, number> = {
  s: 16,
  m: 18,
  l: 20,
};

export const BONE_THICKNESS_PX: Record<BoneThicknessKey, number> = {
  thin: 5,
  medium: 7,
  thick: 9,
};

/**
 * 控件面板里声明的原始表单数据，key 与控件名一致（snake_case）。
 * 这是 `buildQuery` 收到的形态。
 */
export interface FishboneQueryFormData extends QueryFormData {
  /**
   * 层级维度，按顺序构成鱼骨的层级：
   * 第 1 列 → 固定主骨分类（人/物/法/环），第 2 列及以后 → 具体原因。
   */
  groupby?: string[];
  /** 度量，决定原因排序、标签上的数值。 */
  metric?: QueryFormMetric;
  /** 鱼头上写的文字，即要分析的问题，如「交期延误」。 */
  effect_name?: string;
  head_position?: HeadPosition;
  show_values?: boolean;
  font_size?: FontSizeKey;
  bone_thickness?: BoneThicknessKey;
  /** 数值格式，沿用 Superset 的 `y_axis_format` 控件。 */
  y_axis_format?: string;
}

/**
 * `transformProps` 看到的表单数据。
 *
 * `ChartProps` 在把 formData 交给图表前会跑一遍 `convertKeysToCamelCase`，
 * 所以控件里叫 `head_position`，这里读到的是 `headPosition`。
 * 按 snake_case 读会静默拿到 `undefined`，控件看起来"没反应"却不报错。
 */
export interface FishboneChartFormData {
  groupby?: string[];
  metric?: QueryFormMetric;
  effectName?: string;
  headPosition?: HeadPosition;
  showValues?: boolean;
  fontSize?: FontSizeKey;
  boneThickness?: BoneThicknessKey;
  yAxisFormat?: string;
}

/** 鱼骨上的一个原因节点，由数据行聚合而来。 */
export interface CauseNode {
  name: string;
  /** 该节点自身及其所有后代的值之和。 */
  value: number;
  children: CauseNode[];
}

/** 挂在某根主骨上的一行原因。 */
export interface FishboneRow {
  key: string;
  label: string;
  /** 原因在原始层级里的深度，仅用于提示信息。 */
  depth: number;
  value: number;
  /** 从主骨分类到本原因的完整路径，用于 tooltip。 */
  path: string[];
}

/** 一根主骨及其下挂载的所有原因行。 */
export interface FishboneBone {
  key: string;
  label: string;
  /** 该主骨下所有原因的值之和。 */
  value: number;
  rows: FishboneRow[];
}

/** 布局产出的线段，坐标为最终 SVG 用户坐标。 */
export interface LaidOutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface LaidOutText {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  /** SVG 的 text-anchor，已按鱼头方向做过镜像调整。 */
  anchor: 'start' | 'middle' | 'end';
}

/** 带圆角的矩形，左上角坐标，用于主骨胶囊标签与问题气泡。 */
export interface LaidOutBox {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface LaidOutCircle {
  cx: number;
  cy: number;
  r: number;
}

/** 主骨末端的胶囊标签。 */
export interface LaidOutPill {
  box: LaidOutBox;
  text: LaidOutText;
}

export interface LaidOutRow {
  key: string;
  /** 完整标签（不截断），用于 tooltip。 */
  label: string;
  depth: number;
  value: number;
  path: string[];
  /** 从主骨引到本行文字的横向引线。 */
  leader: LaidOutLine;
  /** 指向主骨的箭头三角形路径。 */
  arrow: string;
  /** 画在画布上的标签文字，超长时可能已截断。 */
  labelText: LaidOutText;
  /** 数值文字，`show_values` 关闭或没有度量时为 null。 */
  valueText: LaidOutText | null;
}

export interface LaidOutBone {
  key: string;
  label: string;
  value: number;
  /** 已按数值格式格式化过的合计值，供 tooltip 直接使用。 */
  formattedValue: string;
  /** 从主干锚点斜向伸出的主骨。 */
  bone: LaidOutLine;
  /** 主骨与主干连接处的箭头路径，箭头指向主干。 */
  baseArrow: string;
  /** 主骨末端的分类胶囊。 */
  pill: LaidOutPill;
  rows: LaidOutRow[];
}

export interface FishboneLayout {
  spine: LaidOutLine;
  /** 鱼头轮廓路径（含嘴部凹口）。 */
  headPath: string;
  /** 鱼眼。 */
  headEye: LaidOutCircle;
  /** 鱼鳃弧线，描边绘制。 */
  headGill: string;
  /** 鱼尾轮廓路径。 */
  tailPath: string;
  /** 问题说明气泡；没有填写问题时为 null。 */
  effectBubble: LaidOutBox | null;
  /** 气泡内的文字行。 */
  effectLines: LaidOutText[];
  /** 气泡底部指向鱼头的尾巴；没有气泡时为空字符串。 */
  effectTail: string;
  bones: LaidOutBone[];
  /** 空间不足或分类无法归位时被丢弃的原因行数，0 表示完整展示。 */
  droppedRows: number;
}

/** 渲染组件（Fishbone.tsx）的 props。 */
export interface FishboneProps {
  width: number;
  height: number;
  layout: FishboneLayout;
  /** 鱼尾颜色，也是鱼身渐变的起点。 */
  tailColor: string;
  /** 鱼头颜色，也是鱼身渐变的终点。 */
  headColor: string;
  /** 四根主骨胶囊与问题气泡的底色。 */
  badgeColor: string;
  /** 四根大骨各自的颜色，按固定槽位 key（人/物/法/环）索引。 */
  boneColors: Record<string, string>;
  /** 主骨胶囊标签的文字色。 */
  pillTextColor: string;
  /** 行标签的文字配色。 */
  labelColor: string;
  /** 数值文字配色，比标签弱一档。 */
  valueColor: string;
  /** 无数据时的占位文案。 */
  noDataText: string;
}

/** `buildFishboneBones` 的入参。 */
export interface BuildBonesInput {
  rows: DataRecord[];
  /** 层级列名，第一列为固定分类，其余为原因层级。 */
  levelColumns: string[];
  /** 度量列名；为 null 时所有值按 0 处理，仅保留层级结构。 */
  metricColumn: string | null;
}

/** `buildFishboneBones` 的产出。 */
export interface BuildBonesResult {
  /** 始终包含固定的四根主骨，缺失分类的原因行为空。 */
  bones: FishboneBone[];
  /** 第一层维度无法归入固定分类的原因行数。 */
  unmatchedRows: number;
}
