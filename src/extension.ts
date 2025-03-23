import * as vscode from 'vscode'
import { VSCodeMarketplaceClient } from './api/client'
import { MarketPanel } from './webview/MarketPanel'
import { SidebarProvider } from './webview/SidebarProvider'

import { Logger } from './utils/logger'

export function activate(context: vscode.ExtensionContext) {
  Logger.initialize()
  Logger.log('VSCode Market extension is now active!')

  const searchCommand = vscode.commands.registerCommand('vsmarket.search', () => {
    Logger.log('Opening VSCode Market panel...')
    MarketPanel.createOrShow(context.extensionUri)
  })

  const sidebarProvider = new SidebarProvider(context.extensionUri)
  const sidebarView = vscode.window.registerWebviewViewProvider('vsmarket-extensions', sidebarProvider)

  const refreshCommand = vscode.commands.registerCommand('vsmarket.refreshSidebar', () => {
    sidebarProvider.refresh()
  })

  context.subscriptions.push(searchCommand, sidebarView, refreshCommand)

  if (MarketPanel.currentPanel) {
    const panel = MarketPanel.currentPanel
    panel.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'search':
            try {
              const extensions = await VSCodeMarketplaceClient.searchExtensions({
                query: message.text,
                pageSize: 20
              })
              panel.updateExtensionList(extensions)
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              vscode.window.showErrorMessage(`Failed to search extensions: ${errorMessage}`)
            }
            break

          case 'install':
            try {
              await vscode.commands.executeCommand('workbench.extensions.installExtension', message.extensionId)
              vscode.window.showInformationMessage(`Successfully installed extension: ${message.extensionId}`)
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              vscode.window.showErrorMessage(`Failed to install extension: ${errorMessage}`)
            }
            break

          case 'uninstall':
            try {
              await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', message.extensionId)
              vscode.window.showInformationMessage(`Successfully uninstalled extension: ${message.extensionId}`)
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              vscode.window.showErrorMessage(`Failed to uninstall extension: ${errorMessage}`)
            }
            break

          case 'list':
            try {
              const extensions = vscode.extensions.all
              const extensionList = extensions.map(ext => ({
                id: ext.id,
                displayName: ext.packageJSON.displayName || ext.packageJSON.name,
                description: ext.packageJSON.description,
                version: ext.packageJSON.version
              }))
              panel.webview.postMessage({
                command: 'updateInstalledExtensions',
                extensions: extensionList
              })
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error)
              vscode.window.showErrorMessage(`Failed to list extensions: ${errorMessage}`)
            }
            break
        }
      },
      undefined,
      context.subscriptions
    )
  }
}

export function deactivate() {
  if (MarketPanel.currentPanel) {
    MarketPanel.currentPanel.dispose()
  }
}

function getIDEType(): string {
  const env = process.env.VSCODE_PRODUCT_NAME || ''
  if (env.toLowerCase().includes('trae')) {
    return 'trae'
  } else if (env.toLowerCase().includes('cursor')) {
    return 'cursor'
  }
  return 'code'
}
