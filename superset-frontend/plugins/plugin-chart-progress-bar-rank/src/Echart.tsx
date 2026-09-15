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
import { useEffect, useRef } from 'react';
import { EChartsType, init, use } from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Register only what this chart draws. `use` is additive and idempotent, so
// running alongside the other echarts plugins in the app is safe.
// eslint-disable-next-line react-hooks/rules-of-hooks -- This is ECharts' use function, not a React hook
use([
  CanvasRenderer,
  BarChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
]);

interface EchartProps {
  echartOptions: EChartsCoreOption;
  height: number;
  width: number;
}

/**
 * Minimal self-contained echarts renderer. The upstream
 * `@superset-ui/plugin-chart-echarts` has an equivalent component but does not
 * export it, and it is coupled to the Explore redux store; keeping a local copy
 * means this plugin stays self-contained and publishable.
 */
export default function Echart({ echartOptions, height, width }: EchartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }
    const chart = init(container);
    chartRef.current = chart;
    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    // `true` replaces the previous option outright, so series or axes dropped
    // between renders (e.g. rows filtered out by the vital-few threshold)
    // disappear instead of lingering.
    chartRef.current?.setOption(echartOptions, true);
  }, [echartOptions]);

  useEffect(() => {
    chartRef.current?.resize();
  }, [height, width]);

  return <div ref={containerRef} style={{ height, width }} />;
}