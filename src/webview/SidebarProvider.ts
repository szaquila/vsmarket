import * as vscode from 'vscode'
import { ExtensionData, VSCodeMarketplaceClient } from '../api/client'
import { Logger } from '../utils/logger'

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView
  private _disposables: vscode.Disposable[] = []

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken) {
    this._view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    }

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview)

    webviewView.webview.onDidReceiveMessage(async data => {
      switch (data.command) {
        case 'search': {
          try {
            const extensions = await vscode.commands.executeCommand('vsmarket.searchExtensions', data.text)
            this._view?.webview.postMessage({ command: 'updateExtensions', extensions })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            vscode.window.showErrorMessage(`Failed to search extensions: ${errorMessage}`)
          }
          break
        }
        case 'install': {
          try {
            const success = await vscode.commands.executeCommand('vsmarket.installExtension', data.extensionId, data.extensionFile)
            if (success) {
              this._view?.webview.postMessage({ command: 'installSuccess', extensionId: data.extensionId })
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            vscode.window.showErrorMessage(`Failed to install extension: ${errorMessage}`)
          }
          break
        }

        case 'uninstall':
          try {
            const success = await vscode.commands.executeCommand('vsmarket.uninstallExtension', data.extensionId)
            if (success) {
              this._view?.webview.postMessage({ command: 'uninstallSuccess', extensionId: data.extensionId })
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            vscode.window.showErrorMessage(`Failed to uninstall extension: ${errorMessage}`)
          }
          break

        case 'log':
            Logger.logObject('updateViewportWidth', data.width)
            break
      }
    })
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const fs = require('fs')
    const sidebarPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'sidebar-panel.html')
    const sidebarContent = fs.readFileSync(sidebarPath.fsPath, 'utf8')
    return sidebarContent
  }

  public refresh() {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'refresh'
      })
    }
  }
}
