import {ReplaySubject, Subject, take} from 'rxjs';

export interface InData {
  port: number;
  uuid: string;
  event: any;
  info: any;
  actionInfo: any;
}

export const createWebsocket = () => {
  let websocket: WebSocket;

  let inData: InData;
  const connect$ = new ReplaySubject<InData>(0);
  const message$ = new Subject<MessageEvent>();
  const close$ = new Subject<void>();

  const connect = (port: number, uuid: string, event: any, info: any, actionInfo: any) => {
    inData = {port, uuid, event, info, actionInfo};
    websocket = new WebSocket("ws://localhost:" + port);

    websocket.onopen = () => {
      websocket.send(JSON.stringify({
        event,
        uuid,
      }));
      connect$.next(inData);
    };
    websocket.onmessage = (evt) => {
      message$.next(evt);
    }
    websocket.onclose = () => close$.next();
  };

  const sendMessage = (event: string, args: {payload?: Record<string, any>; context?: string } = {}) => {
    if (!websocket) {
      connect$.pipe(take(1)).subscribe(() => sendMessage(event, args));
      return;
    }
    const json = {
      event,
      ...args,
      context: args.context ?? inData.uuid,
    };

    websocket.send(JSON.stringify(json));
  }

  return {
    websocket,
    connect,
    message$: message$.asObservable(),
    connect$: connect$.asObservable(),
    close$: close$.asObservable(),
    sendMessage,
  }
}
