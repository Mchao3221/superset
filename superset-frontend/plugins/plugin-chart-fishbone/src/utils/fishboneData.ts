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
  CauseNode,
  FishboneBone,
  FishboneRow,
} from '../types';

/** 层级路径的连接符，取 ASCII 单元分隔符，正常数据里不会出现。 */
const KEY_SEPARATOR = '\u001F';

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

/** 每一层都按数值降序排列；没有度量时保持数据库返回的原始顺序。 */
function sortNodes(nodes: CauseNode[], sortByValue: boolean): void {
  if (sortByValue) {
    // 稳定排序，值相同时保持原有相对顺序。
    nodes.sort((a, b) => b.value - a.value);
  }
  nodes.forEach(node => sortNodes(node.children, sortByValue));
}

/**
 * 按层级列把查询结果聚合成大骨数组。
 *
 * 每一行数据代表一条「大骨 → 中骨 → 小骨」的完整路径，同一路径的多行会
 * 累加成一个节点。节点的值 = 自身行的值 + 所有后代的值，因此大骨的粗细
 * 反映的是它整条分支的合计，而不是只算第一层。
 *
 * 层级深度由 `levelColumns` 的长度决定：1 列只有大骨，2 列多一层中骨，
 * 3 列及以上继续往下挂小骨。没有层级列时返回空数组 —— 没有原因分类就
 * 画不出鱼骨。
 */
/**
 * 把一棵大骨下的所有后代拍平成行。
 *
 * 行的顺序沿用树的深度优先顺序（也就是每层都已按数值降序），这样行在骨骼
 * 上的排列是从最重要的分支开始逐层展开，视觉上更符合鱼骨图的读法。
 */
function flattenRows(root: CauseNode): FishboneRow[] {
  const rows: FishboneRow[] = [];
  const rootPath = [root.name];

  const walk = (node: CauseNode, depth: number, path: string[]): void => {
    rows.push({
      key: path.join(KEY_SEPARATOR),
      label: node.name,
      depth,
      value: node.value,
      path: [...path],
    });
    node.children.forEach(child =>
      walk(child, depth + 1, [...path, child.name]),
    );
  };

  root.children.forEach(child =>
    walk(child, 1, [...rootPath, child.name]),
  );

  return rows;
}

export default function buildFishboneBones({
  rows,
  levelColumns,
  metricColumn,
}: BuildBonesInput): FishboneBone[] {
  if (!levelColumns.length) {
    return [];
  }

  const roots: CauseNode[] = [];
  /** 按「已走过的层级标签」索引节点，避免每行都线性查找。 */
  const index = new Map<string, CauseNode>();

  rows.forEach(row => {
    const value = metricColumn ? toFiniteNumber(row[metricColumn]) : 0;
    let siblings = roots;
    let prefix = '';

    // 逐层往下挂。某一层的值为空就到此为止：数据在这一层没有更细的原因，
    // 硬造一个空节点只会在图上留下没有信息量的叶子。第一层就为空的行则
    // 整行跳过 —— 没有分类的原因无处安放。
    for (let depth = 0; depth < levelColumns.length; depth += 1) {
      const name = toLabel(row[levelColumns[depth]]);
      if (!name) {
        break;
      }
      prefix = depth === 0 ? name : `${prefix}${KEY_SEPARATOR}${name}`;

      let node = index.get(prefix);
      if (!node) {
        node = { name, value: 0, children: [] };
        index.set(prefix, node);
        siblings.push(node);
      }
      node.value += value;
      siblings = node.children;
    }
  });

  sortNodes(roots, Boolean(metricColumn));

  return roots.map(root => {
    const rows_ = flattenRows(root);
    return {
      key: root.name,
      label: root.name,
      value: root.value,
      rows: rows_,
    };
  });
}
