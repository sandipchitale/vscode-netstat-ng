import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import { PORT_STATES } from './port-states';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  vscode: any;
  _message = new Subject();

  constructor() {
    this.vscode = window['acquireVsCodeApi']();

    window.addEventListener('message', event => {
      const message = event.data; // The JSON data our extension sent
      this._message.next(message);
    });
  }

  get messageFromExtension() {
    return this._message.asObservable();
  }

  netstat(portStates: PORT_STATES, ports: string[]) {
    this.vscode.postMessage({
      command: 'netstat',
      portStates,
      ports
    });
  }

  killProcess(pid: number) {
    this.vscode.postMessage({
      command: 'killProcess',
      pid: pid
    });
  }
}
