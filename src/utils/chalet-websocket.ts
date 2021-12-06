import {Observable} from 'rxjs';

let websocket: EventSource;
let url: string;
let onOpen = [];
let onMessage = [];
let onError = [];

const create = () => {
  websocket = new window.EventSource(url);

  websocket.onopen = (evt) => {
    onOpen.forEach(cb => cb(evt));
  }
  websocket.onmessage = (evt) => {
    onMessage.forEach(cb => cb(evt));
  }
  websocket.onerror = (evt) => {
    onError.forEach(cb => cb(evt));
  }
};
const createObservable = (connect?: () => void) => new Observable<MessageEvent>(subscriber => {
  const handler = (evt) => subscriber.next(evt);
  const errorHandler = (evt) => subscriber.error(evt);
  onMessage.push(handler);
  onError.push(errorHandler);
  (connect ?? (() => undefined))();
});

export const createChaletListener = (host: string): Observable<MessageEvent> => {
  const currentUrl = `http://${host}/_/events`;

  if (url === currentUrl) {
    return createObservable();
  }
  url = currentUrl;

  if (!!websocket) {
    websocket.close();
    create();
    return createObservable();
  }

  return createObservable(() => create());
}
