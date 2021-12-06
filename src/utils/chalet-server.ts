import {defer, filter, map, switchMap} from 'rxjs';

const start = (host: string, monitor: string) => defer(
  () => fetch(
    `http://${host}/_/servers/${monitor}/start`,
    {
      method: 'POST',
    },
  ));
const stop = (host: string, monitor: string) => defer(
  () => fetch(
    `http://${host}/_/servers/${monitor}/stop`,
    {
      method: 'POST',
    },
  ));
export const toggle = (host: string, monitor: string) => {
  return getStatus(host, monitor)
    .pipe(
      filter(status => !!status),
      switchMap(status => status === 'stopped' ? start(host, monitor) : stop(host, monitor))
    );
}
const getStatus = (host: string, monitor: string) => defer(
  () => fetch(
    `http://${host}/_/servers`,
    {
      method: 'GET',
    },
  ))
  .pipe(
    switchMap(response => defer(() => response.json())),
    map((response: any) => response[monitor]?.status),
  )
;

