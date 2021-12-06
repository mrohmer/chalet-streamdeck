import {createWebsocket} from './utils/elgato-websocket';
import {createChaletListener} from './utils/chalet-websocket';
import {
  catchError,
  combineLatest, concatMap,
  distinctUntilChanged,
  filter,
  map,
  NEVER,
  Observable,
  of,
  pluck,
  race,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
  withLatestFrom
} from 'rxjs';
import {toggle} from './utils/chalet-server';

const {connect, message$, close$, sendMessage} = createWebsocket();


const parsedMessage$: Observable<{ action: string, payload?: Record<string, any>, event: string, context: string }> = message$
  .pipe(
    map(evt => JSON.parse(
      evt.data
    )),
  );

const keyDown$ = parsedMessage$
  .pipe(
    filter(({event}) => ['keyDown'].includes(event)),
  );
const keyUp$ = parsedMessage$
  .pipe(
    filter(({event}) => ['keyUp'].includes(event)),
  );

const longPress$ = keyDown$
  .pipe(
    switchMap((data) => race(
      timer(750).pipe(take(1), map(() => ({state: true, data}))),
      keyUp$.pipe(take(1), map(() => ({state: false, data}))),
    )),
    filter(({state}) => state),
    switchMap(() => keyUp$.pipe(concatMap((value, index) => index === 0 ? of(value) : NEVER))),
  );
const shortPress$ = keyDown$
  .pipe(
    switchMap((data) => race(
      timer(1000).pipe(take(1), map(() => ({state: false, data}))),
      keyUp$.pipe(take(1), map(() => ({state: true, data}))),
    )),
    filter(({state}) => state),
    map(({data}) => data)
  );

const context$ = parsedMessage$
  .pipe(
    pluck('context'),
    filter(context => !!context),
  );

const host$ = parsedMessage$
  .pipe(
    filter(({event}) => ['didReceiveGlobalSettings'].includes(event)),
    pluck('payload', 'settings', 'host'),
    distinctUntilChanged(),
  );
const chaletEvents$ = host$
  .pipe(
    switchMap((host) => !!host ? createChaletListener(host).pipe(catchError(err => {
      console.error(err);
      return of(null);
    })) : NEVER),
    map(evt => evt ? JSON.parse(evt.data) : evt),
  );

const monitor$ = parsedMessage$
  .pipe(
    filter(({event}) => ['willAppear', 'keyUp', 'didReceiveSettings'].includes(event)),
    pluck('payload', 'settings', 'monitor'),
    distinctUntilChanged(),
  );

combineLatest([
  monitor$,
  chaletEvents$,
])
  .pipe(
    withLatestFrom(context$),
    takeUntil(close$),
  )
  .subscribe(([[monitor, state], context]) => {
    if (!monitor) {
      sendMessage('setTitle', {
        context,
        payload: {
          title: '',
          target: 0,
        }
      });
      return;
    }
    if (state === null) {
      sendMessage('setTitle', {
        context,
        payload: {
          title: 'connection\nerror',
          target: 0,
        }
      });
      return;
    }
    if (!(monitor in state)) {
      sendMessage('setTitle', {
        context,
        payload: {
          title: 'unknown',
          target: 0,
        }
      });
      return;
    }

    sendMessage('setTitle', {
      context,
      payload: {
        title: state[monitor].status,
        target: 0,
      }
    });
  });

parsedMessage$
  .pipe(
    filter(({event}) => ['sendToPlugin'].includes(event)),
    filter(({payload}) => payload?.updateGlobalSettings === true),
    startWith(true),
    switchMap(() => timer(0, 1000)),
    takeUntil(close$),
  )
  .subscribe(() => {
    sendMessage('getGlobalSettings');
  });
parsedMessage$
  .pipe(
    filter(({event}) => ['sendToPlugin'].includes(event)),
    filter(({payload}) => payload?.updateSettings === true),
    startWith(true),
    takeUntil(close$),
  )
  .subscribe(() => {
    sendMessage('getSettings');
  });

longPress$
  .pipe(
    takeUntil(close$),
    withLatestFrom(host$, monitor$),
    filter(([, host, monitor]) => !!host && !!monitor),
    map(([, host, monitor]) => `http://${host}/${monitor}`)
  )
  .subscribe((url) => {
    sendMessage('openUrl', {payload: {url}})
  });

shortPress$
  .pipe(
    takeUntil(close$),
    withLatestFrom(host$, monitor$),
    filter(([, host, monitor]) => !!host && !!monitor),
    switchMap(([, host, monitor]) => toggle(host, monitor)),
  )
  .subscribe(() => undefined);


(window as any).connectElgatoStreamDeckSocket = connect;
