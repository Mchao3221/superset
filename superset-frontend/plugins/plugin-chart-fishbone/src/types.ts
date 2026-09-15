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

/** 标签字号档位，落到具体像素值见 utils/fishboneLayout。 */
export type FontSizeKey = 's' | 'm' | 'l';

/** 大骨基准线宽档位。 */
export type BoneThicknessKey = 'thin' | 'medium' | 'thick';

/** 每一档对应的像素值，控件与布局共用同一份定义。 */
export const FONT_SIZE_PX: Record<FontSizeKey, number> = {
  s: 12,
  m: 14,
  l: 16,
};

export const BONE_THICKNESS_PX: Record<BoneThicknessKey, number> = {
  thin: 1.5,
  medium: 2.5,
  thick: 3.5,
};

/**
 * 控件面板里声明的原始表单数据，key 与控件名一致（snake_case）。
 * 这是 `buildQuery` 收到的形态。
 */
export interface FishboneQueryFormData extends QueryFormData {
  /**
   * 层级维度，按顺序构成鱼骨的层级：
   * 第 1 列 → 大骨（原因分类），第 2 列 → 中骨，第 3 列及以后 → 小骨。
   */
  groupby?: string[];
  /** 度量，决定同层内的排序、标签上的数值，以及骨骼粗细。 */
  metric?: QueryFormMetric;
  /** 鱼头上写的文字，即要分析的问题，如「交期延误」。 */
  effect_name?: string;
  head_position?: HeadPosition;
  show_values?: boolean;
  font_size?: FontSizeKey;
  bone_thickness?: BoneThicknessKey;
  color_scheme?: string;
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
  colorScheme?: string;
  yAxisFormat?: string;
  /** 图表 id，用来让同一份配色在不同图表间保持稳定。 */
  sliceId?: number;
}

/** 鱼骨上的一个原因节点，由数据行聚合而来。 */
export interface CauseNode {
  name: string;
  /** 该节点自身及其所有后代的值之和。 */
  value: number;
  children: CauseNode[];
}

/** 挂在某根大骨上的一行原因（中骨或小骨）。 */
export interface FishboneRow {
  key: string;
  label: string;
  /** 1 = 中骨（第二层维度），2 = 小骨（第三层及更深）。 */
  depth: number;
  value: number;
  /** 从大骨标签到本行的完整路径，用于 tooltip 与悬停高亮。 */
  path: string[];
}

/** 一根大骨（第一层维度）及其下挂载的所有原因行。 */
export interface FishboneBone {
  key: string;
  label: string;
  /** 该大骨下所有行的值之和，决定骨骼粗细。 */
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
  /** 该文字所属大骨的 key，用于悬停高亮联动。 */
  boneKey?: string;
}

export interface LaidOutRow {
  key: string;
  /** 完整标签（不截断），用于 tooltip 与悬停高亮。 */
  label: string;
  depth: number;
  value: number;
  path: string[];
  /** 从大骨引到本行文字的水平引线。 */
  leader: LaidOutLine;
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
  strokeWidth: number;
  color: string;
  /** 从主干锚点斜向伸出的骨骼。 */
  bone: LaidOutLine;
  /** 骨骼末端的分类标签。 */
  labelText: LaidOutText;
  rows: LaidOutRow[];
}

export interface FishboneLayout {
  spine: LaidOutLine;
  /** 主干末端的箭头。 */
  arrow: string;
  headText: LaidOutText | null;
  bones: LaidOutBone[];
  /** 空间不足时被丢弃的原因行数，0 表示完整展示。 */
  droppedRows: number;
}

/** 渲染组件（Fishbone.tsx）的 props。 */
export interface FishboneProps {
  width: number;
  height: number;
  layout: FishboneLayout;
  /** 主干配色。 */
  spineColor: string;
  /** 行标签与数值的文字配色。 */
  labelColor: string;
  /** 数值文字配色，比标签弱一档。 */
  valueColor: string;
  /** 无数据时的占位文案。 */
  noDataText: string;
  /** 因空间不足被丢弃的行数提示，已插值好；无需提示时为 null。 */
  droppedRowsNotice: string | null;
}

/** `buildFishboneBones` 的入参。 */
export interface BuildBonesInput {
  rows: DataRecord[];
  /** 层级列名，按大骨 → 中骨 → 小骨的顺序。 */
  levelColumns: string[];
  /** 度量列名；为 null 时所有值按 0 处理，仅保留层级结构。 */
  metricColumn: string | null;
}
