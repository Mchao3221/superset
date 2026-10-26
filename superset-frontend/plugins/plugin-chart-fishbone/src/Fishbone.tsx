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
import { MouseEvent, useCallback, useId, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { FishboneProps, LaidOutRow } from './types';

/** 引线加粗后的命中宽度：引线本身只有 1.5px，直接悬停很难点中。 */
const HIT_STROKE_WIDTH = 10;
/** tooltip 与鼠标之间的间隙。 */
const TOOLTIP_OFFSET = 14;
/** tooltip 距离容器边缘的最小留白。 */
const TOOLTIP_MARGIN = 8;
/** tooltip 的估算宽度，仅用于把它从右边缘推回来。 */
const TOOLTIP_ESTIMATED_WIDTH = 240;

interface HoverState {
  /** 第一行：这条原因的完整路径，或主骨自身的名字。 */
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
 * 悬停只弹 tooltip 看完整路径与数值，不改变任何图元的样式。
 */
export default function Fishbone({
  width,
  height,
  layout,
  tailColor,
  headColor,
  badgeColor,
  boneColors,
  pillTextColor,
  labelColor,
  valueColor,
  noDataText,
}: FishboneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  // 同一页面可能有多个鱼骨图，渐变 id 必须逐实例唯一。
  const gradientId = `fishbone-body-${useId().replace(/:/g, '')}`;
  const bodyPaint = `url(#${gradientId})`;

  const moveTooltip = useCallback(
    (event: MouseEvent, title: string, detail: string | null) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const rawX = event.clientX - (rect?.left ?? 0) + TOOLTIP_OFFSET;
      const rawY = event.clientY - (rect?.top ?? 0) + TOOLTIP_OFFSET;
      const maxX = Math.max(
        TOOLTIP_MARGIN,
        width - TOOLTIP_ESTIMATED_WIDTH - TOOLTIP_MARGIN,
      );
      setHover({
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
  const hoverProps = (title: string, detail: string | null) => ({
    onMouseEnter: (event: MouseEvent) => moveTooltip(event, title, detail),
    onMouseMove: (event: MouseEvent) => moveTooltip(event, title, detail),
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
  const ariaLabel =
    layout.effectLines.map(line => line.text).join(' ') || t('Fishbone');

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
        aria-label={ariaLabel}
        height={height}
        role="img"
        style={{ display: 'block', overflow: 'visible' }}
        width={width}
      >
        {/* 鱼身渐变：从鱼尾的亮蓝过渡到鱼头的深藏青。 */}
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={gradientId}
            x1={layout.spine.x1}
            x2={layout.spine.x2}
            y1={layout.spine.y1}
            y2={layout.spine.y2}
          >
            <stop offset="0%" stopColor={tailColor} />
            <stop offset="60%" stopColor="#1851a6" />
            <stop offset="100%" stopColor={headColor} />
          </linearGradient>
        </defs>
        {/* 鱼尾、主干与鱼头：整条鱼指向被分析的问题。 */}
        <path d={layout.tailPath} fill={bodyPaint} />
        <line
          stroke={bodyPaint}
          strokeLinecap="round"
          strokeWidth={layout.spine.width}
          x1={layout.spine.x1}
          x2={layout.spine.x2}
          y1={layout.spine.y1}
          y2={layout.spine.y2}
        />
        <path d={layout.headPath} fill={bodyPaint} />
        {/* 鱼鳃：浅色弧线，让鱼头更有立体感。 */}
        {layout.headGill && (
          <path
            d={layout.headGill}
            fill="none"
            stroke={pillTextColor}
            strokeLinecap="round"
            strokeOpacity={0.4}
            strokeWidth={Math.max(1.5, layout.headEye.r * 0.3)}
          />
        )}
        <circle
          cx={layout.headEye.cx}
          cy={layout.headEye.cy}
          fill="#ffffff"
          r={layout.headEye.r}
        />
        {/* 瞳孔，和鱼身同色。 */}
        <circle
          cx={layout.headEye.cx}
          cy={layout.headEye.cy}
          fill={headColor}
          r={Math.max(1, layout.headEye.r * 0.45)}
        />

        {/* 问题气泡：深色底白字，压在鱼头上方的角上。 */}
        {layout.effectBubble && (
          <rect
            fill={badgeColor}
            height={layout.effectBubble.height}
            rx={layout.effectBubble.radius}
            ry={layout.effectBubble.radius}
            width={layout.effectBubble.width}
            x={layout.effectBubble.x}
            y={layout.effectBubble.y}
          />
        )}
        {/* 气泡尾巴，向下指向鱼头。 */}
        {layout.effectTail && <path d={layout.effectTail} fill={badgeColor} />}
        {layout.effectLines.map(line => (
          <text
            dominantBaseline="middle"
            fill={pillTextColor}
            fontSize={line.fontSize}
            fontWeight={400}
            key={`${line.y}-${line.text}`}
            textAnchor={line.anchor}
            x={line.x}
            y={line.y}
          >
            {line.text}
          </text>
        ))}

        {layout.bones.map(bone => {
          const boneColor = boneColors[bone.key] ?? badgeColor;
          return (
            <g key={bone.key}>
              {/* 大骨汇入主干处的箭头，与主干留出间隙。 */}
              {bone.baseArrow && <path d={bone.baseArrow} fill={boneColor} />}
              {/* 主骨本身：从主干斜向伸出，末端是分类胶囊。 */}
              <line
                stroke={boneColor}
                strokeLinecap="round"
                strokeWidth={bone.bone.width}
                x1={bone.bone.x1}
                x2={bone.bone.x2}
                y1={bone.bone.y1}
                y2={bone.bone.y2}
              />
              <rect
                fill={boneColor}
                height={bone.pill.box.height}
                rx={bone.pill.box.radius}
                ry={bone.pill.box.radius}
                width={bone.pill.box.width}
                x={bone.pill.box.x}
                y={bone.pill.box.y}
              />
              <text
                dominantBaseline="central"
                fill={pillTextColor}
                fontSize={bone.pill.text.fontSize}
                fontWeight={600}
                style={{ cursor: 'default' }}
                textAnchor={bone.pill.text.anchor}
                x={bone.pill.text.x}
                y={bone.pill.text.y}
                {...hoverProps(bone.label, bone.formattedValue)}
              >
                {bone.pill.text.text}
              </text>

              {bone.rows.map(row => (
                <g key={row.key}>
                  <line
                    stroke={boneColor}
                    strokeLinecap="round"
                    strokeWidth={row.leader.width}
                    x1={row.leader.x1}
                    x2={row.leader.x2}
                    y1={row.leader.y1}
                    y2={row.leader.y2}
                  />
                  {/* 箭头指向主骨，表示原因汇入骨骼。 */}
                  <path d={row.arrow} fill={boneColor} />
                  <line
                    stroke="transparent"
                    strokeWidth={HIT_STROKE_WIDTH}
                    style={{ cursor: 'default' }}
                    x1={row.leader.x1}
                    x2={row.leader.x2}
                    y1={row.leader.y1}
                    y2={row.leader.y2}
                    {...hoverProps(rowTitle(row), row.valueText?.text ?? null)}
                  />
                  <text
                    dominantBaseline="middle"
                    fill={labelColor}
                    fontSize={row.labelText.fontSize}
                    style={{ cursor: 'default' }}
                    textAnchor={row.labelText.anchor}
                    x={row.labelText.x}
                    y={row.labelText.y}
                    {...hoverProps(rowTitle(row), row.valueText?.text ?? null)}
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
                      {...hoverProps(rowTitle(row), row.valueText.text)}
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
          {hover.detail && <div style={{ opacity: 0.75 }}>{hover.detail}</div>}
        </div>
      )}
    </div>
  );
}
