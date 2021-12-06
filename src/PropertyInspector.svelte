<script lang="ts">
  import type {InData} from './utils/elgato-websocket';
  import {onMount} from 'svelte';
  import {debounceTime, filter, map, Observable, pluck, Subject, takeUntil} from 'rxjs';

  export let connect$: Observable<InData>;
  export let message$: Observable<MessageEvent>;
  export let sendMessage: (event: string, payload?: Record<string, any>) => void;

  let context: string;
  let settings: Record<string, any> = {};
  let globalSettings: Record<string, any> = {};
  const destroyed$ = new Subject<void>();

  const updateSettings$ = new Subject<void>();
  const updateGlobalSettings$ = new Subject<void>();

  const updateGlobalSettings = () => updateGlobalSettings$.next(undefined);
  const updateSettings = () => updateSettings$.next(undefined);

  onMount(() => {
    connect$
      .pipe(
        takeUntil(destroyed$),
      )
      .subscribe(({actionInfo: inActionInfo}: InData) => {
        const actionInfo = JSON.parse(inActionInfo);

        settings = actionInfo.payload.settings;
      });

    const parsedMessage$ = message$
      .pipe(
        map(event => JSON.parse(event.data)),
      );
    parsedMessage$
      .pipe(
        filter(data => data.event === 'didReceiveGlobalSettings'),
        takeUntil(destroyed$),
      )
      .subscribe(({payload}) => {
        globalSettings = payload.settings;
      });
    parsedMessage$
      .pipe(
        map(event => JSON.parse(event.data)),
        filter(data => data.event === 'didReceiveSettings'),
        takeUntil(destroyed$),
      )
      .subscribe(({payload}) => {
        settings = payload.settings;
      });

    sendMessage('getGlobalSettings');
    sendMessage('getSettings');

    updateGlobalSettings$
      .pipe(
        debounceTime(750),
        filter(() => globalSettings?.host?.trim().length >= 4)
      )
      .subscribe(() => {
        sendMessage('setGlobalSettings', {payload: globalSettings});
        sendMessage('sendToPlugin', {payload: {updateGlobalSettings: true}});
      });
    updateSettings$
      .pipe(
        debounceTime(750),
        filter(() => settings?.monitor?.trim().length >= 1)
      )
      .subscribe(() => {
        sendMessage('setSettings', {payload: settings});
        sendMessage('sendToPlugin', {payload: {updateSettings: true}});
      });

    return () => destroyed$.next(undefined);
  });
</script>

<div class="sdpi-wrapper">
    <div class="sdpi-item">
        <div class="sdpi-item-label">Host</div>
        <input class="sdpi-item-value" id="host" placeholder="localhost:2000" minlength="4" required
               bind:value={globalSettings.host} on:input={updateGlobalSettings}>
    </div>
    <div class="sdpi-item">
        <div class="sdpi-item-label">Monitor</div>
        <input class="sdpi-item-value" id="monitor" placeholder="monitor-name" minlength="1" required
               bind:value={settings.monitor} on:input={updateSettings}>
    </div>
</div>
