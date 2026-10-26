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
  BuildBonesInput,
  BuildBonesResult,
  CauseNode,
  FIXED_BONE_LABELS,
  FishboneBone,
  FishboneRow,
  FixedBoneLabel,
} from '../types';

/** 层级路径的连接符，取 ASCII 单元分隔符，正常数据里不会出现。 */
const KEY_SEPARATOR = '\u001F';

/**
 * 第一层维度的取值到固定分类的别名。
 *
 * 数据里的分类名很少与「人、物、法、环」逐字一致，常见的是「人员」「设备」
 * 「方法」「环境」这类写法。这里把常见的同义写法归到四个固定分类上；命中
 * 不了的取值不参与绘制，数量在右下角提示。
 */
const BONE_ALIASES: Record<FixedBoneLabel, string[]> = {
  人: ['人', '人员', '人为', '人因', '人员因素', '人为因素'],
  物: [
    '物',
    '物料',
    '物资',
    '物品',
    '设备',
    '机器',
    '机',
    '材料',
    '料',
    '设备因素',
    '物料因素',
  ],
  法: [
    '法',
    '方法',
    '制度',
    '流程',
    '规范',
    '程序',
    '管理',
    '法律法规',
    '方法因素',
  ],
  环: ['环', '环境', '外部环境', '环境因素'],
};

/**
 * 把任意值强制转成有限数字。null、undefined、非数字字符串和 NaN 一律归 0，
 * 这样一行脏数据不会让整根骨骼的粗细变成 NaN。
 */
export function toFiniteNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * 维度值转成展示用文字。空值统一成空字符串 —— 调用方据此判断这一层是否
 * 真的存在，而不是把 `null` 渲染成字面量。
 */
export function toLabel(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/**
 * 把第一层维度的取值归入固定分类。
 *
 * 先按「完全一致」匹配分类名与别名，避免「法人」这类同时含两个字的值被
 * 误判；完全一致都落空时，才退回到「标签里只出现一个分类字」的判断，
 * 用于「人的因素」这种自由写法。两个及以上分类字同时出现视为无法判断。
 */
export function resolveFixedBone(raw: string): FixedBoneLabel | null {
  const label = raw.trim();
  if (!label) {
    return null;
  }

  const exact = FIXED_BONE_LABELS.find(
    bone => label === bone || BONE_ALIASES[bone].includes(label),
  );
  if (exact) {
    return exact;
  }

  const hits = FIXED_BONE_LABELS.filter(bone => label.includes(bone));
  return hits.length === 1 ? hits[0] : null;
}

/** 每一层都按数值降序排列；没有度量时保持数据库返回的原始顺序。 */
function sortNodes(nodes: CauseNode[], sortByValue: boolean): void {
  if (sortByValue) {
    // 稳定排序，值相同时保持原有相对顺序。
    nodes.sort((a, b) => b.value - a.value);
  }
  nodes.forEach(node => sortNodes(node.children, sortByValue));
}

/**
 * 把一棵树的子节点并入另一棵树，同名节点合并后继续向下合并。
 *
 * 多个原始分类可能归入同一个固定分类（例如「人」与「人员」），合并后
 * 同名原因只保留一条，数值累加。
 */
function mergeChildren(target: CauseNode, source: CauseNode): void {
  source.children.forEach(child => {
    const existing = target.children.find(item => item.name === child.name);
    if (existing) {
      existing.value += child.value;
      mergeChildren(existing, child);
    } else {
      target.children.push(child);
    }
  });
}

/**
 * 收集叶子节点作为挂在主骨上的原因。
 *
 * 只取叶子是为了去掉「人 → 管理者 → 具体原因」这类中间分组：所有具体原因
 * 直接排在主骨两侧，不做缩进、不做分层。中间层的完整路径仍写进 `path`，
 * 悬停提示里可以看到原因是从哪一级汇总上来的。
 */
function collectLeafRows(
  node: CauseNode,
  path: string[],
  out: FishboneRow[],
): void {
  if (!node.children.length) {
    out.push({
      key: path.join(KEY_SEPARATOR),
      label: node.name,
      depth: path.length - 1,
      value: node.value,
      path: [...path],
    });
    return;
  }
  node.children.forEach(child =>
    collectLeafRows(child, [...path, child.name], out),
  );
}

/** 统计一棵树下最终会画成多少条原因（叶子数）。 */
function countLeaves(node: CauseNode): number {
  if (!node.children.length) {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * 按层级列把查询结果聚合成固定的四根主骨。
 *
 * 第一列是分类，归入「人、物、法、环」；其余列构成原因层级，只有叶子节点
 * 会画成小刺，中间分组被省略。每一行数据代表一条完整路径，同一路径的多行
 * 累加成一个节点。没有层级列时四根主骨都为空 —— 没有原因就画不出鱼骨。
 */
export default function buildFishboneBones({
  rows,
  levelColumns,
  metricColumn,
}: BuildBonesInput): BuildBonesResult {
  const empty = (): FishboneBone[] =>
    FIXED_BONE_LABELS.map(label => ({
      key: label,
      label,
      value: 0,
      rows: [],
    }));

  if (!levelColumns.length) {
    return { bones: empty(), unmatchedRows: 0 };
  }

  /** 按「已走过的原始分类路径」索引节点，避免每行都线性查找。 */
  const index = new Map<string, CauseNode>();
  /** 第一层维度的原始取值 → 该分类的根节点。 */
  const byRawCategory = new Map<string, CauseNode>();
  const sortByValue = Boolean(metricColumn);

  rows.forEach(row => {
    const value = metricColumn ? toFiniteNumber(row[metricColumn]) : 0;
    const rawCategory = toLabel(row[levelColumns[0]]);
    if (!rawCategory) {
      return;
    }

    let root = byRawCategory.get(rawCategory);
    if (!root) {
      root = { name: rawCategory, value: 0, children: [] };
      byRawCategory.set(rawCategory, root);
    }
    root.value += value;

    // 逐层往下挂。某一层为空就到此为止：数据在这一层没有更细的原因，
    // 硬造一个空节点只会在图上留下没有信息量的叶子。
    let parent = root;
    let prefix = rawCategory;
    for (let depth = 1; depth < levelColumns.length; depth += 1) {
      const name = toLabel(row[levelColumns[depth]]);
      if (!name) {
        break;
      }
      prefix = `${prefix}${KEY_SEPARATOR}${name}`;

      let node = index.get(prefix);
      if (!node) {
        node = { name, value: 0, children: [] };
        index.set(prefix, node);
        parent.children.push(node);
      }
      node.value += value;
      parent = node;
    }
  });

  /** 固定分类 → 合并后的原因树。 */
  const byFixedBone = new Map<FixedBoneLabel, CauseNode>();
  let unmatchedRows = 0;

  byRawCategory.forEach(root => {
    const fixed = resolveFixedBone(root.name);
    if (!fixed) {
      unmatchedRows += countLeaves(root);
      return;
    }
    const target = byFixedBone.get(fixed);
    if (target) {
      target.value += root.value;
      mergeChildren(target, root);
    } else {
      byFixedBone.set(fixed, root);
    }
  });

  const bones = FIXED_BONE_LABELS.map(label => {
    const root = byFixedBone.get(label);
    if (!root) {
      return { key: label, label, value: 0, rows: [] };
    }
    sortNodes(root.children, sortByValue);
    const treeRows: FishboneRow[] = [];
    root.children.forEach(child =>
      collectLeafRows(child, [root.name, child.name], treeRows),
    );
    return {
      key: label,
      // 展示文字取数据库里的原始分类值；key 仍是固定槽位，用来决定骨骼位置。
      label: root.name,
      value: root.value,
      rows: treeRows,
    };
  });

  return { bones, unmatchedRows };
}
