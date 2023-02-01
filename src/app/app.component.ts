import { AfterViewInit, Component, Inject, OnInit, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AppService } from './app.service';

import { MenuItem } from 'primeng/api';
import { DOCUMENT } from '@angular/common';

import { PORT_STATES } from './port-states';

interface NetstatRecord {
  proto: string,
  localAddress: string,
  localPort: number,
  foreignAddress: string,
  foreignPort: number,
  state: string,
  pid: number
}

interface PortState {
  icon: string,
  mode: string
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, AfterViewInit {

  @ViewChild('main')
  mainElement;

  public busy = false;

  _ports = '';
  autoRefresh = false;
  netstatRecords: Array<NetstatRecord> = [];
  selectedNetstatRecords: Array<NetstatRecord> = [];

  public portStates: PortState[] = [
    { icon: 'pi pi-inbox', mode: 'LISTENING'},
    { icon: 'pi pi-thumbs-up', mode: 'ESTABLISHED' },
    { icon: 'pi pi-clock', mode: 'TIME_WAIT' },
    { icon: 'pi pi-power-off', mode: 'CLOSE_WAIT' },
  ]
  public listening = this.portStates[0];
  public established = this.portStates[1];
  public timeWait = this.portStates[2];
  public closeWait = this.portStates[3];

  public selectedPortStates = [
    this.listening
  ];


  constructor(
    private translate: TranslateService,
    private appService: AppService,
    @Inject(DOCUMENT) private document: Document
  ) {
    this.translate.setDefaultLang('en');

    this.appService.messageFromExtension.subscribe((message: any) => {
      switch (message.command) {
        case 'colorTheme':
          this.adjustTheme();
          break;
        case 'netstat':
          try {
            this.netstatRecords = message.netstatRecords;
          } finally {
            this.busy = false;
          }
          break;
        case 'refreshView':
            this.netstat();
            break;
      }
    });
  }

  ngOnInit(): void {
    this.netstat();
  }

  ngAfterViewInit(): void {
    this.adjustTheme();
  }

  get isListening() {
    return this.selectedPortStates.includes(this.listening);
  }

  get isEstablished() {
    return this.selectedPortStates.includes(this.established);
  }

  get isTimeWait() {
    return this.selectedPortStates.includes(this.timeWait);
  }

  get isCloseWait() {
    return this.selectedPortStates.includes(this.closeWait);
  }

  get ports(): string {
    return this._ports;
  }

  set ports(p: string) {
    this._ports = p;
  }

  adjustTheme() {
    let theme = "md-light-indigo";
    if (document.body.classList.contains("vscode-light")) {
      theme = "md-light-indigo";
    } else if (document.body.classList.contains("vscode-dark")) {
      theme = "md-dark-indigo";
    }
    let themeLink = this.document.getElementById('app-theme') as HTMLLinkElement;
    if (themeLink) {
        themeLink.href = theme + '.css';
    }
  }

  netstat() {
    let portsArray = [];
    const ports = this.ports.trim();
    if (ports.length !== 0) {
      portsArray = ports.split(',').filter((port) => port !== '');
    }

    this.appService.netstat({
      LISTENING: this.isListening,
      ESTABLISHED: this.isEstablished,
      TIME_WAIT: this.isTimeWait,
      CLOSE_WAIT: this.isCloseWait
    }, portsArray);
  }

  killProcess(pid: number) {
    this.appService.killProcess(pid);
  }
}
