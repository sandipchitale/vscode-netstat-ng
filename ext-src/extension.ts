import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

interface NetstatRecord {
  proto: string,
  localAddress: string,
  localPort: number,
  foreignAddress: string,
  foreignPort: number,
  state: string,
  pid: number
}

export interface PORT_STATES {
  LISTENING: boolean,
  ESTABLISHED: boolean,
  TIME_WAIT: boolean,
  CLOSE_WAIT: boolean,
}
class NetstatViewProvider implements vscode.WebviewViewProvider {

  public static readonly viewType = 'vscode-netstat-ng.netstat';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,

      localResourceRoots: [
        this._extensionUri
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.command) {
        case 'netstat':
          this.netstat(data.portStates, data.ports);
          break;
        case 'killProcess':
          this.killOwnerProcess(data.pid);
          break;
      }
    });
  }

  netstat(portStates: PORT_STATES, ports: string[], ) {
    const netstatRecords: Array<NetstatRecord> = [];
    let rawNetstatBuffer = '';
    const dirProcess = child_process.spawn(
      'cmd',
      [
        '/C'
        ,'netstat'
        ,'-anop'
        ,'tcp'
      ]
    );

    dirProcess.stdout.on('data', (data) => {
      rawNetstatBuffer += data;
    });

    dirProcess.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
    dirProcess.on('exit', (code) => {
      const netstatRecordLines = rawNetstatBuffer.split('\n')
        .filter(line => line.trim().startsWith('TCP'))
        .map(line => line.trim())
        .forEach(line => {
          const localParts = line.substring(7, 29).trim().split(/[:]/);
          const localAddress = localParts[0];
          const localPort = parseInt(localParts[1], 10);

          if (ports.length > 0 && !ports.includes('' + localPort)) {
            return;
          }

          const foreignParts = line.substring(30, 52).trim().split(/[:]/);
          const foreignAddress = foreignParts[0];
          const foreignPort = parseInt(foreignParts[1]);
          const state = line.substring(53, 68).trim();
          const pid = parseInt(line.substring(69).trim());
          const aNetstatObject = {
            proto: 'TCP',
            localAddress,
            localPort,
            foreignAddress,
            foreignPort,
            state,
            pid
          };
          if (portStates.LISTENING && state === 'LISTENING') {
            netstatRecords.push(aNetstatObject);
          } if (portStates.ESTABLISHED && state === 'ESTABLISHED') {
            netstatRecords.push(aNetstatObject);
          } if (portStates.TIME_WAIT && state === 'TIME_WAIT') {
            netstatRecords.push(aNetstatObject);
          } else if (portStates.CLOSE_WAIT && state === 'CLOSE_WAIT') {
            netstatRecords.push(aNetstatObject);
          }
        });
      this._view?.webview.postMessage({
        command: 'netstat',
        netstatRecords: netstatRecords
      });
    });
  }

  killOwnerProcess(pid: number) {
    if (pid) {
      vscode.window.showInformationMessage(`Kill process id: ${pid}`, 'No', 'Yes').then(response => {
        if (response === 'Yes') {
          const dirProcess = child_process.spawn(
            'cmd',
            [
              '/C'
              ,'taskkill'
              ,'/F'
              ,'/PID'
              ,`${pid}`
            ]
          );
          dirProcess.on('exit', (code) => {
            this.refreshView();
          });
        }
      });
    }
  }

  setColorTheme(colorTheme: vscode.ColorTheme) {
    this._view?.webview.postMessage({
      command: 'colorTheme',
      colorTheme
    });
  }

  refreshView() {
    this._view?.webview.postMessage({
      command: 'refreshView'
    });
  }

  /**
   * Returns html of the start page (index.html)
   */
  private _getHtmlForWebview(webview: vscode.Webview) {
    // URI to dist folder
    const appDistUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist'));;

    // path as uri
    const baseUri = webview.asWebviewUri(appDistUri);

    // get path to index.html file from dist folder
    const indexPath = path.join(appDistUri.fsPath, 'index.html');

    // read index file from file system
    let indexHtml = fs.readFileSync(indexPath, { encoding: 'utf8' });

    // update the base URI tag
    indexHtml = indexHtml.replace('<base href="/">', `<base href="${String(baseUri)}/">`);

    return indexHtml;
  }
}

let extensionPath: string;
let outputChannel: vscode.OutputChannel;

/**
 * Activates extension
 * @param context vscode extension context
 */
export function activate(context: vscode.ExtensionContext) {
  extensionPath = context.extensionPath;

  outputChannel = vscode.window.createOutputChannel(context.extension.id.replace('sandipchitale.', ''));

  const provider = new NetstatViewProvider(context.extensionUri);

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(NetstatViewProvider.viewType, provider));

  vscode.window.onDidChangeActiveColorTheme((colorTheme: vscode.ColorTheme) => {
    provider.setColorTheme(colorTheme);
  });
}


