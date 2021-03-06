/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

export type CodeHighlightProvider = {
  highlight(
    editor: atom$TextEditor,
    bufferPosition: atom$Point,
  ): Promise<?Array<atom$Range>>,
  priority: number,
  grammarScopes: Array<string>,
};
