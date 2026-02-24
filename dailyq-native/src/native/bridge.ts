import type { RefObject } from 'react';
import type WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { parseBridgeMessage, type BridgeMessage } from '../config/messageProtocol';

/**
 * Creates WebView bridge: onMessage handler and sendToWebView.
 * Web page sends: window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload })).
 * Native sends: injectJavaScript dispatches 'nativeMessage' CustomEvent with { type, payload } in detail.
 */
export function createWebViewBridge(
  ref: RefObject<WebView | null>,
  onMessageFromWeb?: (message: BridgeMessage) => void
) {
  function onMessage(event: WebViewMessageEvent) {
    const message = parseBridgeMessage(event.nativeEvent.data);
    if (message && onMessageFromWeb) {
      onMessageFromWeb(message);
    }
  }

  function sendToWebView(message: BridgeMessage) {
    const script = `(function(){ window.dispatchEvent(new CustomEvent('nativeMessage', { detail: ${JSON.stringify(message)} })); })();`;
    ref.current?.injectJavaScript(script);
  }

  return { onMessage, sendToWebView };
}
