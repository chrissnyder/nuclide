/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  FileVersion,
  FileOpenEvent,
  FileCloseEvent,
  FileEditEvent,
} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from '../../nuclide-textedit/lib/rpc-types';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {
  Definition,
  DefinitionQueryResult,
} from '../../nuclide-definition-service/lib/rpc-types';
import type {
  Outline,
  OutlineTree,
} from '../../nuclide-outline-view/lib/rpc-types';
import type {TokenizedText} from '../../commons-node/tokenizedText-rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  FindReferencesReturn,
  Reference,
} from '../../nuclide-find-references/lib/rpc-types';
import type {
  DiagnosticProviderUpdate,
  FileDiagnosticMessage,
  FileDiagnosticUpdate,
  MessageType,
} from '../../nuclide-diagnostics-common/lib/rpc-types';
import type {
  AutocompleteResult,
  Completion,
  SymbolResult,
} from '../../nuclide-language-service/lib/LanguageService';
import type {
  HostServices,
} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {
  NuclideEvaluationExpression,
} from '../../nuclide-debugger-interfaces/rpc-types';
import type {ConnectableObservable} from 'rxjs';
import type {
  InitializeParams,
  ServerCapabilities,
  TextDocumentIdentifier,
  Position,
  Range,
  Location,
  PublishDiagnosticsParams,
  DidOpenTextDocumentParams,
  DidCloseTextDocumentParams,
  DidChangeTextDocumentParams,
  TextDocumentContentChangeEvent,
  Diagnostic,
  CompletionItem,
  TextDocumentPositionParams,
  SymbolInformation,
  UncoveredRange,
} from './protocol';
import type {CategoryLogger} from '../../nuclide-logging';
import type {JsonRpcConnection} from './jsonrpc';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {collect} from 'nuclide-commons/collection';
import {wordAtPositionFromBuffer} from 'nuclide-commons/range';
import {
  FileCache,
  FileVersionNotifier,
  FileEventKind,
} from '../../nuclide-open-files-rpc';
import * as rpc from 'vscode-jsonrpc';
import {Observable} from 'rxjs';
import {Point, Range as atom$Range} from 'simple-text-buffer';
import {LanguageServerV2} from './languageserver';
import {TextDocumentSyncKind, DiagnosticSeverity, SymbolKind} from './protocol';
import {
  className,
  method,
  constructor,
  string,
  plain,
} from '../../commons-node/tokenizedText';

// Marshals messages from Nuclide's LanguageService
// to VS Code's Language Server Protocol
export class LanguageServerProtocolProcess {
  _projectRoot: string;
  _fileCache: FileCache; // tracks which fileversions we've received from Nuclide client
  _host: HostServices;
  _lspFileVersionNotifier: FileVersionNotifier; // tracks which fileversions we've sent to LSP
  _fileEventSubscription: rxjs$ISubscription;
  _createProcess: () => Promise<child_process$ChildProcess>;
  _process: LspProcess;
  _fileExtensions: Array<string>;
  _logger: CategoryLogger;

  constructor(
    logger: CategoryLogger,
    fileCache: FileCache,
    host: HostServices,
    createProcess: () => Promise<child_process$ChildProcess>,
    projectRoot: string,
    fileExtensions: Array<string>,
  ) {
    this._logger = logger;
    this._fileCache = fileCache;
    this._host = host;
    this._lspFileVersionNotifier = new FileVersionNotifier();
    this._projectRoot = projectRoot;
    this._createProcess = createProcess;
    this._fileExtensions = fileExtensions;
  }

  static async create(
    logger: CategoryLogger,
    fileCache: FileCache,
    host: HostServices,
    createProcess: () => Promise<child_process$ChildProcess>,
    projectRoot: string,
    fileExtensions: Array<string>,
  ): Promise<LanguageServerProtocolProcess> {
    const result = new LanguageServerProtocolProcess(
      logger,
      fileCache,
      host,
      createProcess,
      projectRoot,
      fileExtensions,
    );
    await result._ensureProcess();
    return result;
  }

  _subscribeToFileEvents(): void {
    // This code's goal is to keep the LSP process aware of the current status of opened
    // files. Challenge: LSP has no insight into fileversion: it relies wholly upon us
    // to give a correct sequence of versions in didChange events and can't even verify them.
    //
    // The _lspFileVersionNotifier tracks which fileversion we've sent downstream to LSP so far.
    //
    // The _fileCache tracks our upstream connection to the Nuclide editor, and from that
    // synthesizes a sequential consistent stream of Open/Edit/Close events.
    // If the (potentially flakey) connection temporarily goes down, the _fileCache
    // recovers, resyncs, and synthesizes for us an appropriate whole-document Edit event.
    // Therefore, it's okay for us to simply send _fileCache's sequential stream of edits
    // directly on to the LSP server.
    //
    this._fileEventSubscription = this._fileCache
      .observeFileEvents()
      // TODO: Filter on projectRoot
      .filter(fileEvent => {
        const fileExtension = nuclideUri.extname(
          fileEvent.fileVersion.filePath,
        );
        return this._fileExtensions.indexOf(fileExtension) !== -1;
      })
      .subscribe(fileEvent => {
        invariant(fileEvent.fileVersion.notifier === this._fileCache);
        // This invariant just self-documents that _fileCache is asked on observe file
        // events about fileVersions that themselves point directly back to the _fileCache.
        // (It's a convenience so that folks can pass around just a fileVersion on its own.)
        switch (fileEvent.kind) {
          case FileEventKind.OPEN:
            this._fileOpen(fileEvent);
            break;
          case FileEventKind.CLOSE:
            this._fileClose(fileEvent);
            break;
          case FileEventKind.EDIT:
            this._fileEdit(fileEvent);
            break;
          default:
            this._logger.logError(
              'Unrecognized fileEvent ' + JSON.stringify(fileEvent),
            );
        }
        this._lspFileVersionNotifier.onEvent(fileEvent);
      });
  }

  // TODO: Handle the process termination/restart.
  async _ensureProcess(): Promise<void> {
    try {
      const proc = await this._createProcess();
      this._process = await LspProcess.create(
        this._logger,
        proc,
        this._projectRoot,
      );
      this._subscribeToFileEvents();
    } catch (e) {
      this._logger.logError(
        'LanguageServerProtocolProcess - error spawning child process: ' + e,
      );
      throw e;
    }
  }

  _onNotification(message: Object): void {
    this._logger.logError(
      `LanguageServerProtocolProcess - onNotification: ${JSON.stringify(message)}`,
    );
    // TODO: Handle incoming messages
  }

  getRoot(): string {
    return this._projectRoot;
  }

  async tryGetBufferWhenWeAndLspAtSameVersion(
    fileVersion: FileVersion,
  ): Promise<?simpleTextBuffer$TextBuffer> {
    // Await until we have received this exact version from the client.
    // (Might be null in the case the user had already typed further
    // before we got a chance to be called.)
    const buffer = await this._fileCache.getBufferAtVersion(fileVersion);
    invariant(buffer == null || buffer.changeCount === fileVersion.version);

    // Await until this exact version has been pushed to LSP too.
    if (
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      if (buffer != null) {
        // Invariant: LSP is never ahead of our fileCache.
        // Therefore it will eventually catch up.
        this._logger.logError(
          'LSP.version - could not catch up to version=' + fileVersion.version,
        );
      }
      return null;
    }

    // During that second await, if the server received further edits from the client,
    // then the buffer object might have been mutated in place, so its file-verion will
    // no longer match. In this case we return null.
    return buffer != null && buffer.changeCount === fileVersion.version
      ? buffer
      : null;
  }

  _fileOpen(fileEvent: FileOpenEvent): void {
    if (!this._process._derivedCapabilities.serverWantsOpenClose) {
      return;
    }
    const params: DidOpenTextDocumentParams = {
      textDocument: {
        uri: fileEvent.fileVersion.filePath,
        languageId: 'python', // TODO
        version: fileEvent.fileVersion.version,
        text: fileEvent.contents,
      },
    };
    this._process._connection.didOpenTextDocument(params);
  }

  _fileClose(fileEvent: FileCloseEvent): void {
    if (!this._process._derivedCapabilities.serverWantsOpenClose) {
      return;
    }
    const params: DidCloseTextDocumentParams = {
      textDocument: {
        uri: fileEvent.fileVersion.filePath,
      },
    };
    this._process._connection.didCloseTextDocument(params);
  }

  _fileEdit(fileEvent: FileEditEvent): void {
    let contentChange: TextDocumentContentChangeEvent;
    switch (this._process._derivedCapabilities.serverWantsChange) {
      case 'incremental':
        contentChange = {
          range: atomRangeToRange(fileEvent.oldRange),
          text: fileEvent.newText,
        };
        break;
      case 'full':
        const buffer = this._fileCache.getBufferForFileEdit(fileEvent);
        contentChange = {
          text: buffer.getText(),
        };
        break;
      case 'none':
        return;
      default:
        invariant(false); // unreachable
    }

    const params: DidChangeTextDocumentParams = {
      textDocument: {
        uri: fileEvent.fileVersion.filePath,
        version: fileEvent.fileVersion.version,
      },
      contentChanges: [contentChange],
    };
    // eslint-disable-next-line max-len
    this._logger.logInfo(
      `-->LSP ${this._process._derivedCapabilities.serverWantsChange} edit ${JSON.stringify(params)}`,
    );
    this._process._connection.didChangeTextDocument(params);
  }

  getDiagnostics(fileVersion: FileVersion): Promise<?DiagnosticProviderUpdate> {
    this._logger.logError('NYI: getDiagnostics');
    return Promise.resolve(null);
  }

  observeDiagnostics(): ConnectableObservable<FileDiagnosticUpdate> {
    const con = this._process._connection;
    return (Observable.fromEventPattern(
      con.onDiagnosticsNotification.bind(con),
      () => undefined,
    ): Observable<PublishDiagnosticsParams>)
      .map(convertDiagnostics)
      .publish();
  }

  async getAutocompleteSuggestions(
    fileVersion: FileVersion,
    position: atom$Point,
    activatedManually: boolean,
    prefix: string,
  ): Promise<?AutocompleteResult> {
    if (this._process._capabilities.completionProvider == null) {
      return null;
    }
    if (
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
      // If the user typed more characters before we ended up being invoked, then there's
      // no way we can fulfill the request.
    }
    const params = createTextDocumentPositionParams(
      fileVersion.filePath,
      position,
    );
    const result = await this._process._connection.completion(params);
    if (Array.isArray(result)) {
      return {
        isIncomplete: false,
        items: result.map(convertCompletion),
      };
    } else {
      return {
        isIncomplete: result.isIncomplete,
        items: result.items.map(convertCompletion),
      };
    }
  }

  async getDefinition(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    if (!this._process._capabilities.definitionProvider) {
      return null;
    }
    if (
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
      // If the user typed more characters before we ended up being invoked, then there's
      // no way we can fulfill the request.
    }
    const params = createTextDocumentPositionParams(
      fileVersion.filePath,
      position,
    );
    const result = await this._process._connection.gotoDefinition(params);
    return {
      // TODO: use wordAtPos to determine queryrange
      queryRange: [new atom$Range(position, position)],
      definitions: this.locationsDefinitions(result),
    };
  }

  getDefinitionById(file: NuclideUri, id: string): Promise<?Definition> {
    this._logger.logError('NYI: getDefinitionById');
    return Promise.resolve(null);
  }

  async findReferences(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    if (!this._process._capabilities.referencesProvider) {
      return null;
    }
    if (
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
      // If the user typed more characters before we ended up being invoked, then there's
      // no way we can fulfill the request.
    }
    const buffer = await this._fileCache.getBufferAtVersion(fileVersion);
    // buffer may still be null despite the above check. We do handle that!

    const positionParams = createTextDocumentPositionParams(
      fileVersion.filePath,
      position,
    );
    const params = {...positionParams, context: {includeDeclaration: true}};
    // ReferenceParams is like TextDocumentPositionParams but with one extra field.
    const response = await this._process._connection.findReferences(params);
    const references = response.map(this.locationToFindReference);

    // We want to know the name of the symbol. The best we can do is reconstruct
    // this from the range of one (any) of the references we got back. We're only
    // willing to do this for references in files already in the filecache, but
    // thanks to includeDeclaration:true then the file where the user clicked will
    // assuredly be in the cache!
    let referencedSymbolName = null;
    // The very best we can do is if we and LSP were in sync at the moment the
    // request was dispatched, and buffer still hasn't been modified since then,
    // so we can guarantee that the ranges returned by LSP are identical
    // to what we have in hand.
    if (buffer != null) {
      const refInBuffer = references.find(
        ref => ref.uri === fileVersion.filePath,
      );
      if (refInBuffer != null) {
        referencedSymbolName = buffer.getTextInRange(refInBuffer.range);
      }
    }
    // Failing that, if any of the buffers are open we'll use them (even if we
    // have no guarantees about which version our buffers are at compared to
    // the ranges that LSP sent us back, so it might be a little off.)
    if (referencedSymbolName == null) {
      for (const ref of references) {
        const refBuffer = this._fileCache.getBuffer(ref.uri);
        if (refBuffer != null) {
          referencedSymbolName = refBuffer.getTextInRange(ref.range);
          break;
        }
      }
    }
    // Failing that we'll try using a regexp on the buffer. (belt and braces!)
    if (referencedSymbolName == null && buffer != null) {
      const WORD_REGEX = /\w+/gi;
      const match = wordAtPositionFromBuffer(buffer, position, WORD_REGEX);
      if (match != null && match.wordMatch.length > 0) {
        referencedSymbolName = match.wordMatch[0];
      }
    }
    // Failing that ...
    if (referencedSymbolName == null) {
      referencedSymbolName = 'symbol';
    }

    return {
      type: 'data',
      baseUri: this._process._projectRoot,
      referencedSymbolName,
      references,
    };
  }

  async getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    if (!this._process._capabilities.typeCoverageProvider) {
      return null;
    }
    const params = {textDocument: toTextDocumentIdentifier(filePath)};
    const response = await this._process._connection.typeCoverage(params);

    const convertUncovered = (uncovered: UncoveredRange) => ({
      range: rangeToAtomRange(uncovered.range),
      message: uncovered.message,
    });
    return {
      percentage: response.coveredPercent,
      uncoveredRegions: response.uncoveredRanges.map(convertUncovered),
    };
  }

  async getOutline(fileVersion: FileVersion): Promise<?Outline> {
    if (!this._process._capabilities.documentSymbolProvider) {
      return null;
    }
    if (
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
      // If the user typed more characters before we ended up being invoked, then there's
      // no way we can fulfill the request.
    }
    const params = {
      textDocument: toTextDocumentIdentifier(fileVersion.filePath),
    };
    const response = await this._process._connection.documentSymbol(params);

    // The response is a flat list of SymbolInformation, which has location+name+containerName.
    // We're going to reconstruct a tree out of them. This can't be done with 100% accuracy in
    // all cases, but it can be done accurately in *almost* all cases.

    // For each symbolInfo in the list, we have exactly one corresponding tree node.
    // We'll also sort the nodes in lexical order of occurrence in the source
    // document. This is useful because containers always come lexically before their
    // children. (This isn't a LSP guarantee; just a heuristic.)
    const list: Array<
      [SymbolInformation, OutlineTree],
    > = response.map(symbol => [
      symbol,
      {
        icon: symbolKindToAtomIcon(symbol.kind),
        tokenizedText: symbolToTokenizedText(symbol),
        startPosition: positionToPoint(symbol.location.range.start),
        children: [],
      },
    ]);
    list.sort(([, aNode], [, bNode]) =>
      aNode.startPosition.compare(bNode.startPosition),
    );

    // We'll need to look up for parents by name, so construct a map from names to nodes
    // of that name. Note: an undefined SymbolInformation.containerName means root,
    // but it's easier for us to represent with ''.
    const mapElements = list.map(([symbol, node]) => [symbol.name, node]);
    const map: Map<string, Array<OutlineTree>> = collect(mapElements);
    if (map.has('')) {
      this._logger.logError(
        'Outline textDocument/documentSymbol returned an empty symbol name',
      );
    }

    // The algorithm for reconstructing the tree out of list items rests on identifying
    // an item's parent based on the item's containerName. It's easy if there's only one
    // parent of that name. But if there are multiple parent candidates, we'll try to pick
    // the one that comes immediately lexically before the item. (If there are no parent
    // candidates, we've been given a malformed item, so we'll just ignore it.)
    const root: OutlineTree = {
      plainText: '',
      startPosition: new Point(0, 0),
      children: [],
    };
    map.set('', [root]);
    for (const [symbol, node] of list) {
      const parentName = symbol.containerName || '';
      const parentCandidates = map.get(parentName);
      if (parentCandidates == null) {
        this._logger.logError(
          `Outline textDocument/documentSymbol ${symbol.name} is missing container ${parentName}`,
        );
      } else {
        invariant(parentCandidates.length > 0);
        // Find the first candidate that's lexically *after* our symbol.
        const symbolPos = positionToPoint(symbol.location.range.start);
        const iAfter = parentCandidates.findIndex(
          p => p.startPosition.compare(symbolPos) > 0,
        );
        if (iAfter === -1) {
          // No candidates after item? Then item's parent is the last candidate.
          parentCandidates[parentCandidates.length - 1].children.push(node);
        } else if (iAfter === 0) {
          // All candidates after item? That's an error! We'll arbitrarily pick first one.
          parentCandidates[0].children.push(node);
          this._logger.logError(
            `Outline textDocument/documentSymbol ${symbol.name} comes after its container`,
          );
        } else {
          // Some candidates before+after? Then item's parent is the last candidate before.
          parentCandidates[iAfter - 1].children.push(node);
        }
      }
    }

    return {outlineTrees: root.children};
  }

  async typeHint(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?TypeHint> {
    if (!this._process._capabilities.hoverProvider) {
      return null;
    }
    if (
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
      // If the user typed more characters before we ended up being invoked, then there's
      // no way we can fulfill the request.
    }
    const params = createTextDocumentPositionParams(
      fileVersion.filePath,
      position,
    );
    const response = await this._process._connection.hover(params);

    let hint = response.contents;
    if (Array.isArray(hint)) {
      hint = hint.length > 0 ? hint[0] : '';
      // TODO: render multiple hints at once with a thin divider between them
    }
    if (typeof hint === 'string') {
      // TODO: convert markdown to text
    } else {
      hint = hint.value;
      // TODO: colorize code if possible. (is hard without knowing its context)
    }

    let range = new atom$Range(position, position);
    if (response.range) {
      range = rangeToAtomRange(response.range);
    }

    return hint ? {hint, range} : null;
  }

  async highlight(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    if (!this._process._capabilities.documentHighlightProvider) {
      return null;
    }
    if (
      !await this._lspFileVersionNotifier.waitForBufferAtVersion(fileVersion)
    ) {
      return null;
      // If the user typed more characters before we ended up being invoked, then there's
      // no way we can fulfill the request.
    }
    const params = createTextDocumentPositionParams(
      fileVersion.filePath,
      position,
    );
    const response = await this._process._connection.documentHighlight(params);
    const convertHighlight = highlight => rangeToAtomRange(highlight.range);
    return response.map(convertHighlight);
  }

  async formatSource(
    fileVersion: FileVersion,
    atomRange: atom$Range,
  ): Promise<?Array<TextEdit>> {
    // In general, what should happen if we request a reformat but the user does typing
    // while we're waiting for the reformat results to be (asynchronously) delivered?
    // This is entirely handled by our upstream caller in CodeFormatManager.js which
    // verifies that the buffer's contents haven't changed between asking for reformat and
    // applying it; if they have, then it displays an error message to the user.
    // So: this function doesn't need to do any such verification itself.

    // But we do need the buffer, to know whether atomRange covers the whole document.
    // And if we can't get it for reasons of syncing, then we'll have to bail by reporting
    // the same error as that upstream caller.
    const buffer = await this.tryGetBufferWhenWeAndLspAtSameVersion(
      fileVersion,
    );
    if (buffer == null) {
      this._logger.logError(
        'LSP.formatSource - buffer changed before we could format',
      );
      return null;
    }
    const options = {tabSize: 2, insertSpaces: true};
    // TODO: from where should we pick up these options? Can we omit them?
    const params = {
      textDocument: toTextDocumentIdentifier(fileVersion.filePath),
      options,
    };
    let edits;

    // The user might have requested to format either some or all of the buffer.
    // And the LSP server might have the capability to format some or all.
    // We'll match up the request+capability as best we can...
    const canAll = Boolean(
      this._process._capabilities.documentFormattingProvider,
    );
    const canRange = Boolean(
      this._process._capabilities.documentRangeFormattingProvider,
    );
    const wantAll = buffer.getRange().compare(atomRange) === 0;
    if (canAll && (wantAll || !canRange)) {
      edits = await this._process._connection.documentFormatting(params);
    } else if (canRange) {
      // Range is exclusive, and Nuclide snaps it to entire rows. So range.start
      // is character 0 of the start line, and range.end is character 0 of the
      // first line AFTER the selection.
      const range = atomRangeToRange(atomRange);
      edits = await this._process._connection.documentRangeFormattting({
        ...params,
        range,
      });
    } else {
      this._logger.logError('LSP.formatSource - not supported by server');
      return null;
    }

    // As mentioned, the user might have done further typing during that 'await', but if so then
    // our upstream caller will catch it and report an error: no need to re-verify here.

    const convertRange = lspTextEdit => ({
      oldRange: rangeToAtomRange(lspTextEdit.range),
      newText: lspTextEdit.newText,
    });
    return edits.map(convertRange);
  }

  formatEntireFile(
    fileVersion: FileVersion,
    range: atom$Range,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }> {
    // A language service implements either formatSource or formatEntireFile,
    // and we should pick formatSource in our AtomLanguageServiceConfig.
    this._logger.logError(
      'LSP CodeFormat providers should use formatEntireFile: false',
    );
    return Promise.resolve(null);
  }

  getEvaluationExpression(
    fileVersion: FileVersion,
    position: atom$Point,
  ): Promise<?NuclideEvaluationExpression> {
    this._logger.logError('NYI: getEvaluationExpression');
    return Promise.resolve(null);
  }

  supportsSymbolSearch(directories: Array<NuclideUri>): Promise<boolean> {
    return Promise.resolve(
      Boolean(this._process._capabilities.workspaceSymbolProvider),
    );
  }

  async symbolSearch(
    query: string,
    directories: Array<NuclideUri>,
  ): Promise<?Array<SymbolResult>> {
    if (!this._process._capabilities.workspaceSymbolProvider) {
      return null;
    }
    const result = await this._process._connection.workspaceSymbol({query});
    return result.map(convertSearchResult);
  }

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri> {
    this._logger.logError('NYI: getProjectRoot');
    return Promise.resolve(null);
  }

  isFileInProject(fileUri: NuclideUri): Promise<boolean> {
    this._logger.logError('NYI: isFileInProject');
    return Promise.resolve(false);
  }

  dispose(): void {
    this._process.dispose();
    /* TODO
    if (!this.isDisposed()) {
      this._host.dispose();
      // Atempt to send disconnect message before shutting down connection
      try {
        this._logger.logTrace(
          'Attempting to disconnect cleanly from LanguageServerProtocolProcess');
        this.getConnectionService().disconnect();
      } catch (e) {
        // Failing to send the shutdown is not fatal...
        // ... continue with shutdown.
        this._logger.logError('Hack Process died before disconnect() could be sent.');
      }
      super.dispose();
      this._lspFileVersionNotifier.dispose();
      this._fileEventSubscription.unsubscribe();
      if (processes.has(this._fileCache)) {
        processes.get(this._fileCache).delete(this._projectRoot);
      }
    } else {
      this._logger.logInfo(
        `LanguageServerProtocolProcess attempt to shut down already disposed ${this.getRoot()}.`);
    }
    */
  }

  locationToFindReference(location: Location): Reference {
    return {
      uri: location.uri,
      name: null,
      range: rangeToAtomRange(location.range),
    };
  }

  locationToDefinition(location: Location): Definition {
    return {
      path: location.uri,
      position: positionToPoint(location.range.start),
      language: 'Python', // TODO
      projectRoot: this._projectRoot,
    };
  }

  locationsDefinitions(locations: Location | Location[]): Array<Definition> {
    if (Array.isArray(locations)) {
      return locations.map(this.locationToDefinition.bind(this));
    } else {
      return [this.locationToDefinition(locations)];
    }
  }
}

class DerivedServerCapabilities {
  serverWantsOpenClose: boolean;
  serverWantsChange: 'full' | 'incremental' | 'none';

  constructor(capabilities: ServerCapabilities, logger: CategoryLogger) {
    let syncKind;

    // capabilities.textDocumentSync is either a number (protocol v2)
    // or an object (protocol v3) or absent (indicating no capabilities).
    const sync = capabilities.textDocumentSync;
    if (typeof sync === 'number') {
      this.serverWantsOpenClose = true;
      syncKind = sync;
    } else if (typeof sync === 'object') {
      this.serverWantsOpenClose = Boolean(sync.openClose);
      syncKind = Number(sync.change);
    } else {
      this.serverWantsOpenClose = false;
      syncKind = TextDocumentSyncKind.None;
      if (sync != null) {
        logger.logError(
          'LSP - invalid capabilities.textDocumentSync from server: ' +
            JSON.stringify(sync),
        );
      }
    }

    // The syncKind is a number, supposed to fall in the TextDocumentSyncKind
    // enumeration, so we verify that here:
    if (syncKind === TextDocumentSyncKind.Full) {
      this.serverWantsChange = 'full';
    } else if (syncKind === TextDocumentSyncKind.Incremental) {
      this.serverWantsChange = 'incremental';
    } else if (syncKind === TextDocumentSyncKind.None) {
      this.serverWantsChange = 'none';
    } else {
      logger.logError('LSP initialize: invalid TextDocumentSyncKind');
      this.serverWantsChange = 'none';
    }
  }
}

// Encapsulates an LSP process
class LspProcess {
  _logger: CategoryLogger;
  _process: child_process$ChildProcess;
  _connection: LanguageServerV2;
  _capabilities: ServerCapabilities;
  _derivedCapabilities: DerivedServerCapabilities;
  _projectRoot: NuclideUri;

  constructor(
    logger: CategoryLogger,
    process: child_process$ChildProcess,
    projectRoot: NuclideUri,
    isIpc: boolean,
  ) {
    this._logger = logger;
    this._process = process;
    this._projectRoot = projectRoot;

    this._logger.logInfo(
      'LanguageServerProtocolProcess - created child process with PID: ' +
        process.pid,
    );

    process.stdin.on('error', error => {
      this._logger.logError(
        'LanguageServerProtocolProcess - error writing data: ' + error,
      );
    });

    let reader;
    let writer;
    if (isIpc) {
      reader = new rpc.IPCMessageReader(process);
      writer = new rpc.IPCMessageWriter(process);
    } else {
      reader = new rpc.StreamMessageReader(process.stdout);
      writer = new rpc.StreamMessageWriter(process.stdin);
    }

    const rpc_logger = {
      error(message) {
        logger.logError('JsonRpc ' + message);
      },
      warn(message) {
        logger.logInfo('JsonRpc ' + message);
      },
      info(message) {
        logger.logInfo('JsonRpc ' + message);
      },
      log(message) {
        logger.logInfo('JsonRpc ' + message);
      },
    };

    const connection: JsonRpcConnection = rpc.createMessageConnection(
      reader,
      writer,
      rpc_logger,
    );

    connection.listen();
    // TODO: connection.onNotification(this._onNotification.bind(this));

    this._connection = new LanguageServerV2(this._logger, connection);
  }

  // Creates the connection and initializes capabilities
  static async create(
    logger: CategoryLogger,
    process: child_process$ChildProcess,
    projectRoot: NuclideUri,
  ): Promise<LspProcess> {
    const lspProcess = new LspProcess(logger, process, projectRoot, false);

    const params: InitializeParams = {
      // TODO:
      initializationOptions: {},
      processId: process.pid,
      rootPath: projectRoot,
      capabilities: {},
      // TODO: capabilities
      /*
      capabilities: {
        workspace: {},
        textDocument: {
          definition: {
            dynamicRegistration: true,
          },
        },
        experimental: {},
      },
      */
    };

    const result = await lspProcess._connection.initialize(params);
    lspProcess._capabilities = result.capabilities;
    lspProcess._derivedCapabilities = new DerivedServerCapabilities(
      result.capabilities,
      logger,
    );
    return lspProcess;
  }

  _onNotification(message: Object): void {
    this._logger.logError(
      `LanguageServerProtocolProcess - onNotification: ${JSON.stringify(message)}`,
    );
    // TODO: Handle incoming messages
  }

  dispose(): void {
    // TODO
  }
}

export function toTextDocumentIdentifier(
  filePath: NuclideUri,
): TextDocumentIdentifier {
  return {
    uri: filePath,
  };
}

export function pointToPosition(position: atom$Point): Position {
  return {
    line: position.row,
    character: position.column,
  };
}

export function positionToPoint(position: Position): atom$Point {
  return new Point(position.line, position.character);
}

export function rangeToAtomRange(range: Range): atom$Range {
  return new atom$Range(
    positionToPoint(range.start),
    positionToPoint(range.end),
  );
}

export function atomRangeToRange(range: atom$Range): Range {
  return {
    start: pointToPosition(range.start),
    end: pointToPosition(range.end),
  };
}

export function convertDiagnostics(
  params: PublishDiagnosticsParams,
): FileDiagnosticUpdate {
  return {
    filePath: params.uri,
    messages: params.diagnostics.map(diagnostic =>
      convertDiagnostic(params.uri, diagnostic),
    ),
  };
}

export function convertDiagnostic(
  filePath: NuclideUri,
  diagnostic: Diagnostic,
): FileDiagnosticMessage {
  return {
    // TODO: diagnostic.code
    scope: 'file',
    providerName: diagnostic.source || 'TODO: VSCode LSP',
    type: convertSeverity(diagnostic.severity),
    filePath,
    text: diagnostic.message,
    range: rangeToAtomRange(diagnostic.range),
  };
}

export function convertSeverity(severity?: number): MessageType {
  switch (severity) {
    case null:
    case undefined:
    case DiagnosticSeverity.Error:
    default:
      return 'Error';
    case DiagnosticSeverity.Warning:
    case DiagnosticSeverity.Information:
    case DiagnosticSeverity.Hint:
      return 'Warning';
  }
}

export function createTextDocumentPositionParams(
  filePath: string,
  position: atom$Point,
): TextDocumentPositionParams {
  return {
    textDocument: toTextDocumentIdentifier(filePath),
    position: pointToPosition(position),
  };
}

export function convertCompletion(item: CompletionItem): Completion {
  return {
    text: item.insertText || item.label,
    displayText: item.label,
    type: item.detail,
    description: item.documentation,
  };
}

// Converts an LSP SymbolInformation.kind number into an Atom icon
// from https://github.com/atom/atom/blob/master/static/octicons.less -
// you can see the pictures at https://octicons.github.com/
function symbolKindToAtomIcon(kind: number): string {
  // for reference, vscode: https://github.com/Microsoft/vscode/blob/be08f9f3a1010354ae2d8b84af017ed1043570e7/src/vs/editor/contrib/suggest/browser/media/suggest.css#L135
  // for reference, hack: https://github.com/facebook/nuclide/blob/20cf17dca439e02a64f4365f3a52b0f26cf53726/pkg/nuclide-hack-rpc/lib/SymbolSearch.js#L120
  switch (kind) {
    case SymbolKind.File:
      return 'file';
    case SymbolKind.Module:
      return 'file-submodule';
    case SymbolKind.Namespace:
      return 'file-submodule';
    case SymbolKind.Package:
      return 'package';
    case SymbolKind.Class:
      return 'code';
    case SymbolKind.Method:
      return 'zap';
    case SymbolKind.Property:
      return 'key';
    case SymbolKind.Field:
      return 'key';
    case SymbolKind.Constructor:
      return 'zap';
    case SymbolKind.Enum:
      return 'file-binary';
    case SymbolKind.Interface:
      return 'puzzle';
    case SymbolKind.Function:
      return 'zap';
    case SymbolKind.Variable:
      return 'pencil';
    case SymbolKind.Constant:
      return 'quote';
    case SymbolKind.String:
      return 'quote';
    case SymbolKind.Number:
      return 'quote';
    case SymbolKind.Boolean:
      return 'quote';
    case SymbolKind.Array:
      return 'list-ordered';
    default:
      return 'question';
  }
}

// Converts an LSP SymbolInformation into TokenizedText
function symbolToTokenizedText(symbol: SymbolInformation): TokenizedText {
  const tokens = [];

  // The TokenizedText ontology is deliberately small, much smaller than
  // SymbolInformation.kind, because it's used for colorization and you don't
  // want your colorized text looking like a fruit salad.
  switch (symbol.kind) {
    case SymbolKind.File:
    case SymbolKind.Module:
    case SymbolKind.Package:
    case SymbolKind.Namespace:
      tokens.push(plain(symbol.name));
      break;
    case SymbolKind.Class:
    case SymbolKind.Interface:
      tokens.push(className(symbol.name));
      break;
    case SymbolKind.Constructor:
      tokens.push(constructor(symbol.name));
      break;
    case SymbolKind.Method:
    case SymbolKind.Property:
    case SymbolKind.Field:
    case SymbolKind.Enum:
    case SymbolKind.Function:
    case SymbolKind.Constant:
    case SymbolKind.Variable:
    case SymbolKind.Array:
      tokens.push(method(symbol.name));
      break;
    case SymbolKind.String:
    case SymbolKind.Number:
    case SymbolKind.Boolean:
      tokens.push(string(symbol.name));
      break;
    default:
      tokens.push(plain(symbol.name));
  }

  return tokens;
}

export function convertSearchResult(info: SymbolInformation): SymbolResult {
  let hoverText = 'unknown';
  for (const key in SymbolKind) {
    if (info.kind === SymbolKind[key]) {
      hoverText = key;
    }
  }
  return {
    path: info.location.uri,
    line: info.location.range.start.line,
    column: info.location.range.start.character,
    name: info.name,
    containerName: info.containerName,
    icon: symbolKindToAtomIcon(info.kind),
    hoverText,
  };
}
