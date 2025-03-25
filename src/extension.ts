import * as vscode from 'vscode'
import { VSCodeMarketplaceClient } from './api/client'
import { SidebarProvider } from './webview/SidebarProvider'

import { Logger } from './utils/logger'

export function activate(context: vscode.ExtensionContext) {
  Logger.initialize()
  Logger.log('VSCode Market extension is now active!')

  const sidebarProvider = new SidebarProvider(context.extensionUri)
  const sidebarView = vscode.window.registerWebviewViewProvider('vsmarket-extensions', sidebarProvider)

  const refreshCommand = vscode.commands.registerCommand('vsmarket.refreshSidebar', () => {
    sidebarProvider.refresh()
  })

  const searchCommand = vscode.commands.registerCommand('vsmarket.searchExtensions', async (query: string) => {
    try {
      return await VSCodeMarketplaceClient.searchExtensions({
        query,
        pageSize: 20
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      vscode.window.showErrorMessage(`Failed to search extensions: ${errorMessage}`)
      throw error
    }
  })

  const installCommand = vscode.commands.registerCommand('vsmarket.installExtension', async (extensionId: string, extensionFile: string) => {
    try {
      Logger.logObject('installCommand', { extensionId, extensionFile })

      await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionId)
      vscode.window.showInformationMessage(`Successfully installed extension: ${extensionId}`)
      return true
    } catch (error) {
      try {
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logger.logObject('Failed to install extension: ', errorMessage)

        if (extensionFile.startsWith('http')) {
          const os = await import('os')
          const path = await import('path')
          const fs = await import('fs/promises')

          // Download extension file to temp directory
          const response = await fetch(extensionFile)
          if (!response.ok) {
            throw new Error(`Failed to download extension: ${response.statusText}`)
          }

          const tempDir = os.tmpdir()
          const tempFile = path.join(tempDir, `extension-${Date.now()}.vsix`)
          const buffer = await response.arrayBuffer()
          await fs.writeFile(tempFile, Buffer.from(buffer))

          // Install from local file
          const uri = vscode.Uri.file(tempFile)
          await vscode.commands.executeCommand('workbench.extensions.installExtension', uri)
          await fs.unlink(tempFile)
        } else {
          await vscode.commands.executeCommand('workbench.extensions.installExtension', extensionFile)
        }
        vscode.window.showInformationMessage(`Successfully installed extension: ${extensionId}`)
        return true
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        vscode.window.showErrorMessage(`Failed to install extension: ${errorMessage}`)
        throw error
      }
    }
  })

  const uninstallCommand = vscode.commands.registerCommand('vsmarket.uninstallExtension', async (extensionId: string) => {
    try {
      await vscode.commands.executeCommand('workbench.extensions.uninstallExtension', extensionId)
      vscode.window.showInformationMessage(`Successfully uninstalled extension: ${extensionId}`)
      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      vscode.window.showErrorMessage(`Failed to uninstall extension: ${errorMessage}`)
      throw error
    }
  })

  context.subscriptions.push(sidebarView, refreshCommand, searchCommand, installCommand, uninstallCommand)
}

export function deactivate() {
  // Clean up resources
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
