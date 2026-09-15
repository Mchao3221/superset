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

/**
 * CJK 汉字、假名、谚文与全角标点等「一个字占一个字号宽」的字符。
 * 逐段覆盖：谚文字母、CJK 部首与符号、假名、谚文兼容字母、CJK 扩展 A、
 * CJK 基本区、彝文、谚文音节、CJK 兼容表意文字与全角字符区。
 */
const FULL_WIDTH =
  /[\u1100-\u115F\u2E80-\u303F\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7AF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/;

/** 半角字符的平均宽度，经验值，取自常见无衬线字体的字宽均值。 */
const HALF_WIDTH_RATIO = 0.55;

/** 空格更窄，单独给一个比例，避免长句被高估太多。 */
const SPACE_RATIO = 0.28;

/**
 * 估算一段文字排成一行时的像素宽度。
 *
 * 布局必须知道文字多宽才能决定主干留多少边距、字号要缩到多小，而
 * `transformProps` 是纯函数、拿不到 DOM，量不了真实字宽，所以这里按
 * 「全角一个字号宽、半角 0.55 个字宽」估算。
 *
 * 估算偏保守（略宽于实际），宁可多留白也不让文字压线或溢出。
 */
export default function estimateTextWidth(
  text: string,
  fontSize: number,
): number {
  let width = 0;
  // 用展开运算符按码点遍历，避免把代理对（emoji 等）拆成两个字符。
  for (const char of text) {
    if (FULL_WIDTH.test(char)) {
      width += fontSize;
    } else if (char === ' ') {
      width += fontSize * SPACE_RATIO;
    } else {
      width += fontSize * HALF_WIDTH_RATIO;
    }
  }
  return width;
}

/** 超长标签被截断时追加的省略号。 */
const ELLIPSIS = '…';

/**
 * 把文字截断到不超过 `maxWidth`，放不下时以省略号收尾。
 *
 * 截断只作用于画在画布上的文字，完整原文仍保留在布局结果里供 tooltip 使用，
 * 因此信息不会真的丢失。
 */
export function truncateToWidth(
  text: string,
  fontSize: number,
  maxWidth: number,
): string {
  if (maxWidth <= 0) {
    return ELLIPSIS;
  }
  if (estimateTextWidth(text, fontSize) <= maxWidth) {
    return text;
  }
  const ellipsisWidth = estimateTextWidth(ELLIPSIS, fontSize);
  let kept = '';
  let width = 0;
  for (const char of text) {
    const charWidth = estimateTextWidth(char, fontSize);
    if (width + charWidth + ellipsisWidth > maxWidth) {
      break;
    }
    kept += char;
    width += charWidth;
  }
  return kept.length ? `${kept}${ELLIPSIS}` : ELLIPSIS;
}
