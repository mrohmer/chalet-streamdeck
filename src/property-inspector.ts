import App from './PropertyInspector.svelte';
import {createWebsocket} from './utils/elgato-websocket';

const {connect, connect$, message$, sendMessage} = createWebsocket();
(window as any).connectElgatoStreamDeckSocket = connect;

const app = new App({
	target: document.body,
	props: {
		connect$,
		message$,
		sendMessage,
	}
});

export default app;
