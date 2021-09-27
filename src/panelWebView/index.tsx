import * as React from "react";
import { render } from "react-dom";
import { ViewPanel } from "./ViewPanel";

// require('@vscode/codicons/dist/codicon.css');
import '@bendera/vscode-webview-elements/dist/vscode-table';
import '@bendera/vscode-webview-elements/dist/vscode-table-header';
import '@bendera/vscode-webview-elements/dist/vscode-table-header-cell';
import '@bendera/vscode-webview-elements/dist/vscode-table-body';
import '@bendera/vscode-webview-elements/dist/vscode-table-row';
import '@bendera/vscode-webview-elements/dist/vscode-table-cell';
import '@bendera/vscode-webview-elements/dist/vscode-collapsible';
import '@bendera/vscode-webview-elements/dist/vscode-checkbox';
import '@bendera/vscode-webview-elements/dist/vscode-label';

declare const acquireVsCodeApi: <T = unknown>() => {
  getState: () => T;
  setState: (data: T) => void;
  postMessage: (msg: unknown) => void;
};

const elm = document.querySelector("#app");
render(<ViewPanel />, elm);