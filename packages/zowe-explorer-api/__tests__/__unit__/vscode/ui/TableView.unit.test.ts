/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import { join } from "path";
import { Table, TableBuilder, WebView } from "../../../../src";
import { env, EventEmitter, Uri, window } from "vscode";
import * as crypto from "crypto";
import { diff } from "deep-object-diff";

function createGlobalMocks() {
    const mockPanel = {
        dispose: jest.fn(),
        onDidDispose: jest.fn(),
        webview: { asWebviewUri: (uri) => uri.toString(), onDidReceiveMessage: jest.fn(), postMessage: jest.fn() },
    };
    // Mock `vscode.window.createWebviewPanel` to return a usable panel object
    const createWebviewPanelMock = jest.spyOn(window, "createWebviewPanel").mockReturnValueOnce(mockPanel as any);

    return {
        createWebviewPanelMock,
        context: {
            extensionPath: "/a/b/c/zowe-explorer",
            extension: {
                id: "Zowe.vscode-extension-for-zowe",
            },
        },
        updateWebviewMock: jest.spyOn((Table.View as any).prototype, "updateWebview"),
    };
}

// Table.View unit tests
describe("Table.View", () => {
    describe("constructor", () => {
        it("handles a missing title in the data object", () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, {} as any);
            expect((view as any).title).toBe("Table view");
        });
    });

    describe("getUris", () => {
        it("returns the URIs from the WebView base class", () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table" } as any);
            const buildPath = join(globalMocks.context.extensionPath, "src", "webviews");
            const scriptPath = join(buildPath, "dist", "table-view", "table-view.js");
            expect(view.getUris()).toStrictEqual({
                disk: {
                    build: Uri.parse(buildPath),
                    script: Uri.parse(scriptPath),
                    css: undefined,
                },
                resource: {
                    build: buildPath,
                    script: scriptPath,
                    css: undefined,
                },
            });
        });
    });

    describe("getHtml", () => {
        it("returns the HTML content generated by the WebView base class", () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table" } as any);
            expect(view.getHtml()).toStrictEqual(view.panel.webview.html);
        });
    });

    describe("updateWebview", () => {
        it("calls postMessage on the panel and sends the data to the webview", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table" } as any);

            // case 1: Post message was not successful; updateWebview returns false
            const postMessageMock = jest.spyOn(view.panel.webview, "postMessage").mockResolvedValueOnce(false);
            await expect((view as any).updateWebview()).resolves.toBe(false);
            expect(postMessageMock).toHaveBeenCalledWith({
                command: "ondatachanged",
                data: { title: "Table" },
            });

            // case 2: Post message was successful; updateWebview returns true and event is fired
            const emitterFireMock = jest.spyOn(EventEmitter.prototype, "fire");
            postMessageMock.mockResolvedValueOnce(true);
            await expect((view as any).updateWebview()).resolves.toBe(true);
            expect(postMessageMock).toHaveBeenCalledWith({
                command: "ondatachanged",
                data: { title: "Table" },
            });
            expect(emitterFireMock).toHaveBeenCalledWith({ title: "Table" });
            postMessageMock.mockRestore();
            emitterFireMock.mockClear();

            // case 2: Post message was successful; updateWebview was previously called
            // result: Uses lastUpdated cache, returns true and fires the event
            postMessageMock.mockResolvedValueOnce(true);
            const mockNewRow = { a: 3, b: 2, c: 1 };
            (view as any).data.rows = [mockNewRow];
            await expect((view as any).updateWebview()).resolves.toBe(true);
            expect(postMessageMock).toHaveBeenCalledWith({
                command: "ondatachanged",
                data: { title: "Table", rows: [mockNewRow] },
            });
            expect(emitterFireMock).toHaveBeenCalledWith(diff((view as any).lastUpdated, (view as any).data));
            postMessageMock.mockRestore();
        });
    });

    describe("getId", () => {
        it("returns a valid ID for the table view", () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table" } as any);
            const randomUuidMock = jest.spyOn(crypto, "randomUUID").mockReturnValueOnce("foo-bar-baz-qux-quux");
            expect(view.getId()).toBe("Table-foo##Zowe.vscode-extension-for-zowe");
            expect(randomUuidMock).toHaveBeenCalled();
        });
    });

    describe("setTitle", () => {
        it("returns false if it was unable to send the new title", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Stable Table of Cables" } as any);
            globalMocks.updateWebviewMock.mockResolvedValueOnce(false);
            await expect(view.setTitle("Unstable Table of Cables")).resolves.toBe(false);
        });

        it("returns true if it successfully sent the new title", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Stable Table of Cables" } as any);
            globalMocks.updateWebviewMock.mockResolvedValueOnce(true);
            await expect(view.setTitle("Unstable Table of Cables")).resolves.toBe(true);
            expect((view as any).data.title).toBe("Unstable Table of Cables");
        });
    });

    describe("setOptions", () => {
        it("returns false if it was unable to send the new options", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table" } as any);
            globalMocks.updateWebviewMock.mockResolvedValueOnce(false);
            await expect(
                view.setOptions({
                    debug: true,
                    pagination: false,
                })
            ).resolves.toBe(false);
        });

        it("returns true if it successfully sent the new options", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Stable Table of Cables" } as any);
            globalMocks.updateWebviewMock.mockResolvedValueOnce(true);
            await expect(
                view.setOptions({
                    debug: true,
                    pagination: false,
                })
            ).resolves.toBe(true);
            expect((view as any).data.debug).toBe(true);
            expect((view as any).data.pagination).toBe(false);
        });
    });

    describe("setColumns", () => {
        it("returns false if it was unable to send the new columns", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table" } as any);
            globalMocks.updateWebviewMock.mockResolvedValueOnce(false);
            await expect(view.setColumns([{ field: "apple" }, { field: "banana" }, { field: "orange" }])).resolves.toBe(false);
        });

        it("returns true if it successfully sent the new options", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Stable Table of Cables" } as any);
            globalMocks.updateWebviewMock.mockResolvedValueOnce(true);
            const cols = [
                { field: "apple", valueFormatter: (data: { value: Table.CellData }) => `${data.value.toString()} apples` },
                { field: "banana", comparator: (valueA, valueB, nodeA, nodeB, isDescending) => -1, colSpan: (params) => 2 },
                { field: "orange", rowSpan: (params) => 2 },
            ];
            await expect(view.setColumns(cols)).resolves.toBe(true);
            expect((view as any).data.columns).toStrictEqual(
                cols.map((col) => ({
                    ...col,
                    colSpan: col.colSpan?.toString(),
                    comparator: col.comparator?.toString(),
                    rowSpan: col.rowSpan?.toString(),
                    valueFormatter: col.valueFormatter?.toString(),
                }))
            );
        });
    });

    describe("onMessageReceived", () => {
        it("does nothing if no command is provided", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table w/ changing display" } as any);
            const onTableDisplayChangedFireMock = jest.spyOn((view as any).onTableDisplayChangedEmitter, "fire");
            globalMocks.updateWebviewMock.mockClear();
            const tableData = { rows: [{ a: 1, b: 1, c: 1 }] };
            await view.onMessageReceived({
                data: tableData,
            });
            expect(onTableDisplayChangedFireMock).not.toHaveBeenCalledWith(tableData);
            expect(globalMocks.updateWebviewMock).not.toHaveBeenCalled();
        });

        it("fires the onTableDisplayChanged event when handling the 'ondisplaychanged' command", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table w/ changing display" } as any);
            const onTableDisplayChangedFireMock = jest.spyOn((view as any).onTableDisplayChangedEmitter, "fire");
            const tableData = { rows: [{ a: 1, b: 1, c: 1 }] };
            await view.onMessageReceived({
                command: "ondisplaychanged",
                data: tableData,
            });
            expect(onTableDisplayChangedFireMock).toHaveBeenCalledWith(tableData);
        });

        it("calls updateWebview when handling the 'ready' command", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table w/ changing display" } as any);
            globalMocks.updateWebviewMock.mockImplementation();
            await view.onMessageReceived({
                command: "ready",
            });
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            globalMocks.updateWebviewMock.mockRestore();
        });

        it("calls vscode.env.clipboard.writeText when handling the 'copy' command", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table w/ copy" } as any);
            const writeTextMock = jest.spyOn(env.clipboard, "writeText").mockImplementation();
            const mockWebviewMsg = {
                command: "copy",
                data: { row: { a: 1, b: 1, c: 1 } },
            };
            await view.onMessageReceived(mockWebviewMsg);
            expect(writeTextMock).toHaveBeenCalledWith(JSON.stringify(mockWebviewMsg.data.row));
            writeTextMock.mockRestore();
        });

        it("calls vscode.env.clipboard.writeText when handling the 'copy-cell' command", async () => {
            const globalMocks = createGlobalMocks();
            const view = new Table.View(globalMocks.context as any, { title: "Table w/ copy-cell" } as any);
            const writeTextMock = jest.spyOn(env.clipboard, "writeText").mockImplementation();
            const mockWebviewMsg = {
                command: "copy-cell",
                data: { cell: 1, row: { a: 1, b: 1, c: 1 } },
            };
            await view.onMessageReceived(mockWebviewMsg);
            expect(writeTextMock).toHaveBeenCalledWith(mockWebviewMsg.data.cell);
            writeTextMock.mockRestore();
        });

        it("does nothing for a command that doesn't exist as a context option or row action", async () => {
            const globalMocks = createGlobalMocks();
            const data = {
                title: "Some table",
                rows: [{ a: 1, b: 1, c: 1 }],
                columns: [],
                contextOpts: {
                    all: [],
                },
                actions: {
                    all: [],
                },
            };
            const view = new Table.View(globalMocks.context as any, data);
            const writeTextMock = jest.spyOn(env.clipboard, "writeText");
            const mockWebviewMsg = {
                command: "nonexistent-action",
                data: { row: data.rows[0] },
            };
            await view.onMessageReceived(mockWebviewMsg);
            expect(writeTextMock).not.toHaveBeenCalled();
            expect(globalMocks.updateWebviewMock).not.toHaveBeenCalled();
        });

        it("runs the callback for an action that exists", async () => {
            const globalMocks = createGlobalMocks();
            const allCallbackMock = jest.fn();
            const zeroCallbackMock = jest.fn();
            const data = {
                title: "Some table",
                rows: [{ a: 1, b: 1, c: 1 }],
                columns: [],
                contextOpts: {
                    all: [],
                },
                actions: {
                    all: [
                        {
                            title: "Some action",
                            command: "some-action",
                            callback: {
                                typ: "cell",
                                fn: (_cell: Table.CellData) => {
                                    allCallbackMock();
                                },
                            },
                        } as Table.Action,
                    ],
                    1: [
                        {
                            title: "Zero action",
                            command: "zero-action",
                            callback: {
                                typ: "cell",
                                fn: (_cell: Table.CellData) => {
                                    zeroCallbackMock();
                                },
                            },
                        } as Table.Action,
                    ],
                },
            };
            const view = new Table.View(globalMocks.context as any, data);
            const writeTextMock = jest.spyOn(env.clipboard, "writeText");
            // case 1: An action that exists for all rows
            const mockWebviewMsg = {
                command: "some-action",
                data: { cell: data.rows[0].a, row: data.rows[0] },
                rowIndex: 1,
            };
            await view.onMessageReceived(mockWebviewMsg);
            expect(writeTextMock).not.toHaveBeenCalled();
            expect(globalMocks.updateWebviewMock).not.toHaveBeenCalled();
            expect(allCallbackMock).toHaveBeenCalled();
            // case 2: An action that exists for one row
            const mockNextWebviewMsg = {
                command: "zero-action",
                data: { cell: data.rows[0].a, row: data.rows[0] },
                rowIndex: 1,
            };
            await view.onMessageReceived(mockNextWebviewMsg);
            expect(writeTextMock).not.toHaveBeenCalled();
            expect(globalMocks.updateWebviewMock).not.toHaveBeenCalled();
            expect(zeroCallbackMock).toHaveBeenCalled();
        });
    });

    describe("setContent", () => {
        it("sets the rows on the internal data structure and calls updateWebview", async () => {
            const globalMocks = createGlobalMocks();
            const mockRow = { red: 255, green: 0, blue: 255 };
            const data = { title: "Table w/ content", rows: [] };
            const view = new Table.View(globalMocks.context as any, data as any);
            globalMocks.updateWebviewMock.mockImplementation();
            await view.setContent([mockRow]);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.rows[0]).toStrictEqual(mockRow);
            globalMocks.updateWebviewMock.mockRestore();
        });
    });

    describe("addColumns", () => {
        it("sets the columns on the internal data structure and calls updateWebview", async () => {
            const globalMocks = createGlobalMocks();
            const mockCols = [
                { field: "name", sort: "desc", colSpan: (params) => 2, rowSpan: (params) => 2 },
                {
                    field: "address",
                    sort: "asc",
                    comparator: (valueA, valueB, nodeA, nodeB, isDescending) => 1,
                    valueFormatter: (data: { value }) => `Located at ${data.value.toString()}`,
                },
            ] as Table.ColumnOpts[];
            const data = { title: "Table w/ cols", columns: [], rows: [] };
            const view = new Table.View(globalMocks.context as any, data as any);
            globalMocks.updateWebviewMock.mockImplementation();
            await view.addColumns(...mockCols);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.columns).toStrictEqual(
                mockCols.map((col) => ({
                    ...col,
                    colSpan: col.colSpan?.toString(),
                    comparator: col.comparator?.toString(),
                    rowSpan: col.rowSpan?.toString(),
                    valueFormatter: col.valueFormatter?.toString(),
                }))
            );
            globalMocks.updateWebviewMock.mockRestore();
        });
    });

    describe("addContent", () => {
        it("adds the rows to the internal data structure and calls updateWebview", async () => {
            const globalMocks = createGlobalMocks();
            const mockRow = { blue: true, yellow: false, violet: true };
            const data = { title: "Table w/ no initial rows", rows: [] };
            const view = new Table.View(globalMocks.context as any, data as any);
            globalMocks.updateWebviewMock.mockImplementation();
            await view.addContent(mockRow);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.rows[0]).toStrictEqual(mockRow);
            globalMocks.updateWebviewMock.mockRestore();
        });
    });

    describe("addContextOption", () => {
        it("adds the context option with conditional to the internal data structure and calls updateWebview", async () => {
            const globalMocks = createGlobalMocks();
            const data = { title: "Table w/ no initial rows", contextOpts: { all: [] }, rows: [] };
            const view = new Table.View(globalMocks.context as any, data as any);
            globalMocks.updateWebviewMock.mockImplementation();

            // case 1: Adding a context menu option with conditional to all rows
            const contextOpt = {
                title: "Add to cart",
                command: "add-to-cart",
                callback: {
                    typ: "row",
                    fn: (_data) => {},
                },
                condition: (_data) => true,
            } as Table.ContextMenuOpts;
            await view.addContextOption("all", contextOpt);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.contextOpts["all"]).toStrictEqual([{ ...contextOpt, condition: contextOpt.condition?.toString() }]);

            // case 2: Adding a context menu option with conditional to one row
            const singleRowContextOpt = {
                title: "Save for later",
                command: "save-for-later",
                callback: {
                    typ: "row",
                    fn: (_data) => {},
                },
                condition: (_data) => true,
            } as Table.ContextMenuOpts;
            await view.addContextOption(1, singleRowContextOpt);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.contextOpts[1]).toStrictEqual([
                { ...singleRowContextOpt, condition: singleRowContextOpt.condition?.toString() },
            ]);
            globalMocks.updateWebviewMock.mockRestore();
        });

        it("adds the context option without conditional to the internal data structure and calls updateWebview", async () => {
            const globalMocks = createGlobalMocks();
            const data = { title: "Table w/ no initial rows", contextOpts: { all: [] }, rows: [] };
            const view = new Table.View(globalMocks.context as any, data as any);
            globalMocks.updateWebviewMock.mockImplementation();

            // case 1: Adding a context menu option without conditional to all rows
            const contextOpt = {
                title: "Remove from cart",
                command: "rm-from-cart",
                callback: {
                    typ: "row",
                    fn: (_data) => {},
                },
            } as Table.ContextMenuOpts;
            await view.addContextOption("all", contextOpt);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.contextOpts["all"]).toStrictEqual([{ ...contextOpt, condition: contextOpt.condition?.toString() }]);

            // case 2: Adding a context menu option without conditional to one row
            const singleRowContextOpt = {
                title: "Add to wishlist",
                command: "add-to-wishlist",
                callback: {
                    typ: "row",
                    fn: (_data) => {},
                },
            } as Table.ContextMenuOpts;
            await view.addContextOption(1, singleRowContextOpt);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.contextOpts[1]).toStrictEqual([
                { ...singleRowContextOpt, condition: singleRowContextOpt.condition?.toString() },
            ]);
            globalMocks.updateWebviewMock.mockRestore();
        });
    });

    describe("addAction", () => {
        it("adds the action with conditional to the internal data structure and calls updateWebview", async () => {
            const globalMocks = createGlobalMocks();
            const data = { title: "Table w/ no initial rows", actions: { all: [] }, rows: [] };
            const view = new Table.View(globalMocks.context as any, data as any);
            globalMocks.updateWebviewMock.mockImplementation();

            // case 1: Adding an action to all rows
            const action = {
                title: "Add to wishlist",
                command: "add-to-wishlist",
                callback: {
                    typ: "row",
                    fn: (_data) => {},
                },
                condition: (_data) => true,
            } as Table.ContextMenuOpts;
            await view.addAction("all", action);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.actions["all"]).toStrictEqual([{ ...action, condition: action.condition?.toString() }]);

            // case 2: Adding an action to one row
            const singleRowAction = {
                title: "Learn more",
                command: "learn-more",
                callback: {
                    typ: "row",
                    fn: (_data) => {},
                },
                condition: (_data) => true,
            } as Table.ContextMenuOpts;
            await view.addAction(2, singleRowAction);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.actions[2]).toStrictEqual([{ ...singleRowAction, condition: singleRowAction.condition?.toString() }]);
            globalMocks.updateWebviewMock.mockRestore();
        });

        it("adds the action without conditional to the internal data structure and calls updateWebview", async () => {
            const globalMocks = createGlobalMocks();
            const data = { title: "Table w/ no initial rows", actions: { all: [] }, rows: [] };
            const view = new Table.View(globalMocks.context as any, data as any);
            globalMocks.updateWebviewMock.mockImplementation();

            // case 1: Adding an action without conditional to all rows
            const action = {
                title: "Remove from wishlist",
                command: "rm-from-wishlist",
                callback: {
                    typ: "row",
                    fn: (_data) => {},
                },
            } as Table.ContextMenuOpts;
            await view.addAction("all", action);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.actions["all"]).toStrictEqual([{ ...action, condition: action.condition?.toString() }]);

            // case 2: Adding an action without conditional to one row
            const singleRowAction = {
                title: "Learn less",
                command: "learn-less",
                callback: {
                    typ: "row",
                    fn: (_data) => {},
                },
            } as Table.ContextMenuOpts;
            await view.addAction(2, singleRowAction);
            expect(globalMocks.updateWebviewMock).toHaveBeenCalled();
            expect((view as any).data.actions[2]).toStrictEqual([{ ...singleRowAction, condition: singleRowAction.condition?.toString() }]);
            globalMocks.updateWebviewMock.mockRestore();
        });
    });
});

// Table.Instance unit tests
describe("Table.Instance", () => {
    describe("dispose", () => {
        it("disposes of the table view using the function in the base class", () => {
            const globalMocks = createGlobalMocks();
            const builder = new TableBuilder(globalMocks.context as any)
                .addRows([
                    { a: 1, b: 2, c: 3, d: false, e: 5 },
                    { a: 3, b: 2, c: 1, d: true, e: 6 },
                ])
                .addColumns([{ field: "a" }, { field: "b" }, { field: "c" }, { field: "d" }, { field: "e" }]);
            const instance = builder.build();
            const disposeMock = jest.spyOn((WebView as any).prototype, "dispose");
            instance.dispose();
            expect(disposeMock).toHaveBeenCalled();
        });
    });
});
