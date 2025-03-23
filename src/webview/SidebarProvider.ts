import * as vscode from 'vscode'
import { ExtensionData, VSCodeMarketplaceClient } from '../api/client'

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView

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
            const extensions = await VSCodeMarketplaceClient.searchExtensions({
              query: data.text,
              pageSize: 20
            })
            this._view?.webview.postMessage({ command: 'updateExtensions', extensions })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            vscode.window.showErrorMessage(`Failed to search extensions: ${errorMessage}`)
          }
          break
        }
        case 'install': {
          try {
            await vscode.commands.executeCommand('workbench.extensions.installExtension', data.extensionId)
            vscode.window.showInformationMessage(`Successfully installed extension: ${data.extensionId}`)
            this._view?.webview.postMessage({ command: 'installSuccess', extensionId: data.extensionId })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            vscode.window.showErrorMessage(`Failed to install extension: ${errorMessage}`)
          }
          break
        }

        case 'uninstall':
          try {
            await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', data.extensionId)
            vscode.window.showInformationMessage(`Successfully uninstalled extension: ${data.extensionId}`)
            this._view?.webview.postMessage({ command: 'uninstallSuccess', extensionId: data.extensionId })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            vscode.window.showErrorMessage(`Failed to uninstall extension: ${errorMessage}`)
          }
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
