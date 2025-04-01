import * as vscode from 'vscode'
import { ExtensionData, VSCodeMarketplaceClient } from '../api/client'
import { Logger } from '../utils/logger'

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView
  private _disposables: vscode.Disposable[] = []
  private static _previewPanel: vscode.WebviewPanel | undefined

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

        case 'showDetails': {
          const extension = data.extension
          Logger.logObject('showDetails', extension)

          // 如果预览面板已存在，则在同一个面板中显示新的扩展详情
          if (SidebarProvider._previewPanel) {
            SidebarProvider._previewPanel.title = extension.displayName
            const fs = require('fs')
            const detailsPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'extension-details.html')
            const detailsContent = fs.readFileSync(detailsPath.fsPath, 'utf8')
            SidebarProvider._previewPanel.webview.html = detailsContent
            SidebarProvider._previewPanel.webview.postMessage({
              command: 'updateExtension',
              extension: extension
            })
            return
          }

          // 创建新的预览面板
          const panel = vscode.window.createWebviewPanel(
            'extensionDetails',
            extension.displayName,
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              retainContextWhenHidden: true
            }
          )

          // 保存预览面板的引用
          SidebarProvider._previewPanel = panel

          // 当面板被关闭时清除引用
          panel.onDidDispose(() => {
            SidebarProvider._previewPanel = undefined
          })

          const fs = require('fs')
          const detailsPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'extension-details.html')
          const detailsContent = fs.readFileSync(detailsPath.fsPath, 'utf8')

          panel.webview.html = detailsContent

          // 发送插件数据到webview
          panel.webview.postMessage({
            command: 'updateExtension',
            extension: extension
          })

          // 处理详情页面的消息
          panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
              case 'install':
                try {
                  const success = await vscode.commands.executeCommand('vsmarket.installExtension', message.extensionId, message.extensionFile)
                  if (success) {
                    panel.webview.postMessage({ command: 'installSuccess' })
                  }
                } catch (error) {
                  vscode.window.showErrorMessage(`安装失败: ${error}`)
                }
                break
              case 'uninstall':
                try {
                  const success = await vscode.commands.executeCommand('vsmarket.uninstallExtension', message.extensionId)
                  if (success) {
                    panel.webview.postMessage({ command: 'uninstallSuccess' })
                  }
                } catch (error) {
                  vscode.window.showErrorMessage(`卸载失败: ${error}`)
                }
                break
              case 'renderMarkdown':
                try {
                  let content = message.content
                  if (message.content.startsWith('http')) {
                    const response = await fetch(message.content)
                    content = await response.text()
                  }
                  const renderedContent = await vscode.commands.executeCommand('markdown.api.render', content)
                  panel.webview.postMessage({
                    command: 'markdownRendered',
                    content: message.content,
                    renderedContent: renderedContent
                  })
                } catch (error) {
                  vscode.window.showErrorMessage(`Markdown渲染失败: ${error}`)
                  panel.webview.postMessage({
                    command: 'markdownRendered',
                    content: message.content,
                    renderedContent: '加载内容失败'
                  })
                }
                break
            }
          })
          break
        }
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
