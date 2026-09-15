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
import { MouseEvent, useCallback, useRef, useState } from 'react';
import { FishboneProps, LaidOutRow } from './types';

/** 悬停时非高亮分支保留的不透明度。 */
const DIMMED_OPACITY = 0.28;
/** 引线加粗后的命中宽度：引线本身只有 1px，直接悬停很难点中。 */
const HIT_STROKE_WIDTH = 10;
/** tooltip 与鼠标之间的间隙。 */
const TOOLTIP_OFFSET = 14;
/** tooltip 距离容器边缘的最小留白。 */
const TOOLTIP_MARGIN = 8;
/** tooltip 的估算宽度，仅用于把它从右边缘推回来。 */
const TOOLTIP_ESTIMATED_WIDTH = 240;

interface HoverState {
  boneKey: string;
  /** 第一行：这条原因的完整路径，或大骨自身的名字。 */
  title: string;
  /** 第二行：数值，没有度量时为 null。 */
  detail: string | null;
  x: number;
  y: number;
}

/**
 * 鱼骨图渲染器。
 *
 * 用纯 SVG 而不是 ECharts：鱼骨没有对应的原生图形，用 graphic 元素硬拼反而
 * 更啰嗦，而 SVG 的坐标就是布局算出来的坐标，一一对应，导出图片也更稳。
 * 悬停高亮通过切换分支透明度实现，不需要额外画一层。
 */
export default function Fishbone({
  width,
  height,
  layout,
  spineColor,
  labelColor,
  valueColor,
  noDataText,
  droppedRowsNotice,
}: FishboneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const moveTooltip = useCallback(
    (
      event: MouseEvent,
      boneKey: string,
      title: string,
      detail: string | null,
    ) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const rawX = event.clientX - (rect?.left ?? 0) + TOOLTIP_OFFSET;
      const rawY = event.clientY - (rect?.top ?? 0) + TOOLTIP_OFFSET;
      const maxX = Math.max(
        TOOLTIP_MARGIN,
        width - TOOLTIP_ESTIMATED_WIDTH - TOOLTIP_MARGIN,
      );
      setHover({
        boneKey,
        title,
        detail,
        x: Math.min(Math.max(TOOLTIP_MARGIN, rawX), maxX),
        y: Math.min(
          Math.max(TOOLTIP_MARGIN, rawY),
          Math.max(TOOLTIP_MARGIN, height - TOOLTIP_MARGIN),
        ),
      });
    },
    [height, width],
  );

  /** 同一份悬停逻辑要挂在引线、标签、数值三处，抽成一个可展开的对象。 */
  const hoverProps = (boneKey: string, title: string, detail: string | null) => ({
    onMouseEnter: (event: MouseEvent) =>
      moveTooltip(event, boneKey, title, detail),
    onMouseMove: (event: MouseEvent) =>
      moveTooltip(event, boneKey, title, detail),
  });

  if (!layout.bones.length) {
    return (
      <div
        style={{
          alignItems: 'center',
          color: valueColor,
          display: 'flex',
          fontSize: 14,
          height,
          justifyContent: 'center',
          width,
        }}
      >
        {noDataText}
      </div>
    );
  }

  const rowTitle = (row: LaidOutRow) => row.path.join(' → ');

  return (
    <div
      ref={containerRef}
      onMouseLeave={() => setHover(null)}
      style={{ height, position: 'relative', width }}
    >
      {/* 这是运行时生成的 SVG，没有可供 <img> 引用的静态资源，用 role="img"
          加可访问名才是正确的读屏语义，因此对这一段关闭该规则。 */}
      {/* eslint-disable jsx-a11y/prefer-tag-over-role -- 生成的图表只能用 SVG 表达 */}
      <svg
        aria-label={layout.headText?.text}
        height={height}
        role="img"
        style={{ display: 'block', overflow: 'visible' }}
        width={width}
      >
        {/* 主干与鱼头：鱼头就是被分析的问题，箭头指向它。 */}
        <line
          stroke={spineColor}
          strokeLinecap="round"
          strokeWidth={layout.spine.width}
          x1={layout.spine.x1}
          x2={layout.spine.x2}
          y1={layout.spine.y1}
          y2={layout.spine.y2}
        />
        <path d={layout.arrow} fill={spineColor} />
        {layout.headText && (
          <text
            dominantBaseline="middle"
            fill={labelColor}
            fontSize={layout.headText.fontSize}
            fontWeight={600}
            textAnchor={layout.headText.anchor}
            x={layout.headText.x}
            y={layout.headText.y}
          >
            {layout.headText.text}
          </text>
        )}

        {layout.bones.map(bone => {
          const dimmed = hover !== null && hover.boneKey !== bone.key;
          return (
            <g
              key={bone.key}
              onMouseLeave={() => setHover(null)}
              style={{ opacity: dimmed ? DIMMED_OPACITY : 1 }}
            >
              {/* 骨骼本体：线宽随该分支的合计值变化。 */}
              <line
                stroke={bone.color}
                strokeLinecap="round"
                strokeWidth={bone.bone.width}
                x1={bone.bone.x1}
                x2={bone.bone.x2}
                y1={bone.bone.y1}
                y2={bone.bone.y2}
              />
              <text
                dominantBaseline="middle"
                fill={labelColor}
                fontSize={bone.labelText.fontSize}
                fontWeight={600}
                style={{ cursor: 'default' }}
                textAnchor={bone.labelText.anchor}
                x={bone.labelText.x}
                y={bone.labelText.y}
                {...hoverProps(bone.key, bone.label, bone.formattedValue)}
              >
                {bone.labelText.text}
              </text>

              {bone.rows.map(row => (
                <g key={row.key}>
                  <line
                    stroke={bone.color}
                    strokeLinecap="round"
                    strokeWidth={row.leader.width}
                    x1={row.leader.x1}
                    x2={row.leader.x2}
                    y1={row.leader.y1}
                    y2={row.leader.y2}
                  />
                  <line
                    stroke="transparent"
                    strokeWidth={HIT_STROKE_WIDTH}
                    style={{ cursor: 'default' }}
                    x1={row.leader.x1}
                    x2={row.leader.x2}
                    y1={row.leader.y1}
                    y2={row.leader.y2}
                    {...hoverProps(bone.key, rowTitle(row), row.valueText?.text ?? null)}
                  />
                  <text
                    dominantBaseline="middle"
                    fill={labelColor}
                    fontSize={row.labelText.fontSize}
                    style={{ cursor: 'default' }}
                    textAnchor={row.labelText.anchor}
                    x={row.labelText.x}
                    y={row.labelText.y}
                    {...hoverProps(bone.key, rowTitle(row), row.valueText?.text ?? null)}
                  >
                    {row.labelText.text}
                  </text>
                  {row.valueText && (
                    <text
                      dominantBaseline="middle"
                      fill={valueColor}
                      fontSize={row.valueText.fontSize}
                      style={{ cursor: 'default' }}
                      textAnchor={row.valueText.anchor}
                      x={row.valueText.x}
                      y={row.valueText.y}
                      {...hoverProps(
                        bone.key,
                        rowTitle(row),
                        row.valueText.text,
                      )}
                    >
                      {row.valueText.text}
                    </text>
                  )}
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      {/* eslint-enable jsx-a11y/prefer-tag-over-role */}

      {droppedRowsNotice && (
        <div
          style={{
            bottom: 0,
            color: valueColor,
            fontSize: 11,
            position: 'absolute',
            right: 0,
          }}
        >
          {droppedRowsNotice}
        </div>
      )}

      {hover && (
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.82)',
            borderRadius: 4,
            color: '#fff',
            fontSize: 12,
            left: hover.x,
            lineHeight: 1.5,
            maxWidth: TOOLTIP_ESTIMATED_WIDTH,
            padding: '6px 8px',
            pointerEvents: 'none',
            position: 'absolute',
            top: hover.y,
            wordBreak: 'break-word',
            zIndex: 10,
          }}
        >
          <div>{hover.title}</div>
          {hover.detail && (
            <div style={{ opacity: 0.75 }}>{hover.detail}</div>
          )}
        </div>
      )}
    </div>
  );
}
