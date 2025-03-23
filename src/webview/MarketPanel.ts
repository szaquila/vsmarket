import * as vscode from 'vscode'
import { ExtensionData } from '../api/client'

interface WebviewMessage {
  command: 'search' | 'install' | 'update' | 'uninstall' | 'list'
  text?: string
  extensionId?: string
}

export class MarketPanel {
  public static currentPanel: MarketPanel | undefined
  private readonly _panel: vscode.WebviewPanel
  private _disposables: vscode.Disposable[] = []

  public get webview(): vscode.Webview {
    return this._panel.webview
  }

  public onDidReceiveMessage(listener: (message: WebviewMessage) => void, thisArg?: any, disposables?: vscode.Disposable[]): vscode.Disposable {
    return this._panel.webview.onDidReceiveMessage(listener, thisArg, disposables)
  }

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)
    this._panel.webview.html = this._getWebviewContent()
    // 初始化时获取已安装插件列表
    // this.listInstalledExtensions()
    this.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'search':
            if (!message.text?.trim()) {
              // 搜索框为空时返回已安装插件列表
              this.listInstalledExtensions()
            }
            break
          case 'install':
            // Handle install request
            break
          case 'update':
            // Handle update request
            break
        }
      },
      undefined,
      this._disposables
    )
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined

    if (MarketPanel.currentPanel) {
      MarketPanel.currentPanel._panel.reveal(column)
      return
    }

    const panel = vscode.window.createWebviewPanel('vsmarket', 'VSCode插件市场', column || vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true
    })

    MarketPanel.currentPanel = new MarketPanel(panel)
  }

  public updateExtensionList(extensions: ExtensionData[]) {
    this._panel.webview.postMessage({
      command: 'updateExtensions',
      extensions
    })
  }

  private listInstalledExtensions() {
    const extensions = vscode.extensions.all
    const extensionList = extensions.map(ext => ({
      extensionId: ext.id,
      displayName: ext.packageJSON.displayName || ext.packageJSON.name,
      shortDescription: ext.packageJSON.description,
      publisher: ext.packageJSON.publisher,
      version: ext.packageJSON.version,
      lastUpdated: ext.packageJSON.date || new Date().toISOString(),
      downloadCount: 0,
      rating: 0,
      installed: true
    }))
    this.updateExtensionList(extensionList)
  }

  private _getWebviewContent() {
    const fs = require('fs')
    const path = require('path')
    const htmlPath = path.join(__dirname, 'market-panel.html')
    return fs.readFileSync(htmlPath, 'utf8')
  }

  public dispose() {
    MarketPanel.currentPanel = undefined
    this._panel.dispose()
    while (this._disposables.length) {
      const disposable = this._disposables.pop()
      if (disposable) {
        disposable.dispose()
      }
    }
  }
}
