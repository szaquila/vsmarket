import * as vscode from 'vscode';

export class Logger {
    private static outputChannel: vscode.OutputChannel;

    public static initialize() {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('VSMarket');
        }
    }

    public static log(message: string) {
        if (!this.outputChannel) {
            this.initialize();
        }
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    public static logObject(prefix: string, obj: any) {
        this.log(`${prefix}: ${JSON.stringify(obj, null, 2)}`);
    }

    public static dispose() {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
}
