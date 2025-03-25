import * as https from 'https'
import * as vscode from 'vscode'
import { Logger } from '../utils/logger'

export interface ExtensionQueryOptions {
  query?: string
  category?: string
  sortBy?: 'installs' | 'rating' | 'relevance'
  pageSize?: number
  pageNumber?: number
}

export interface ExtensionData {
  extensionId: string
  extensionName: string
  displayName: string
  shortDescription: string
  publisher: string
  version: string
  lastUpdated: string
  downloadCount: number
  rating: number
  iconUrl?: string
  installed?: boolean
  extensionFile?: string
  assetUri?: string
}

export class VSCodeMarketplaceClient {
  private static readonly API_BASE_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery'
  private static readonly API_VERSION = '7.2-preview'

  private static readonly headers = {
    Accept: 'application/json;api-version=' + VSCodeMarketplaceClient.API_VERSION,
    'Content-Type': 'application/json',
    'X-Market-Client-Id': 'VSCode',
    'User-Agent': 'VSCode'
  }

  public static async searchExtensions(options: ExtensionQueryOptions): Promise<ExtensionData[]> {
    const queryParams = this.buildQueryParams(options)
    const requestOptions = {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        filters: [
          {
            criteria: [
              {
                filterType: 8,
                value: 'Microsoft.VisualStudio.Code'
              },
              options.query
                ? {
                    filterType: 10,
                    value: options.query
                  }
                : null
            ].filter(Boolean),
            pageNumber: options.pageNumber || 1,
            pageSize: options.pageSize || 10,
            sortBy: options.sortBy || 0
          }
        ],
        flags: 0x2 | 0x100
      })
    }

    try {
      const response = await this.makeRequest('/extensionquery', requestOptions)
      return this.parseExtensionData(response)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      vscode.window.showErrorMessage(`Failed to search extensions: ${errorMessage}`)
      return []
    }
  }

  private static buildQueryParams(options: ExtensionQueryOptions): string {
    const params = new URLSearchParams()
    if (options.query) {
      params.append('searchText', options.query)
    }
    if (options.category) {
      params.append('category', options.category)
    }
    return params.toString()
  }

  private static makeRequest(path: string, options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(`${this.API_BASE_URL}${path}`, options, res => {
        let data = ''
        res.on('data', chunk => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (error) {
            reject(new Error('Failed to parse response'))
          }
        })
      })

      req.on('error', reject)
      if (options.body) {
        req.write(options.body)
      }
      req.end()
    })
  }

  private static async parseExtensionData(response: any): Promise<ExtensionData[]> {
    if (!response.results?.[0]?.extensions) {
      return []
    }

    // Logger.logObject('parseExtensionData', response.results[0].extensions)
    const extensions = response.results[0].extensions.map((ext: any) => {
      const extensionName = ext.publisher.publisherName + '.' + ext.extensionName
      const extensionFile =
        'https://marketplace.visualstudio.com/_apis/public/gallery/publishers/' +
        ext.publisher.publisherName +
        '/vsextensions/' +
        ext.extensionName +
        '/' +
        ext.versions[0].version +
        '/vspackage'
      const installed = vscode.extensions.getExtension(extensionName) !== undefined
      Logger.logObject(extensionName, installed)
      return {
        extensionId: ext.extensionId,
        extensionName: extensionName,
        extensionFile: extensionFile,
        displayName: ext.displayName,
        shortDescription: ext.shortDescription,
        publisher: ext.publisher.displayName,
        version: ext.versions[0].version,
        assetUri: ext.versions[0].assetUri,
        lastUpdated: ext.lastUpdated,
        downloadCount: ext.statistics?.find((s: any) => s.statisticName === 'install')?.value || 0,
        rating: ext.statistics?.find((s: any) => s.statisticName === 'averagerating')?.value || 0,
        iconUrl: ext.versions[0].files.find((f: any) => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Default')?.source,
        installed: installed
      }
    })
    // Logger.logObject('parseExtensionData', extensions)

    return extensions
  }
}
