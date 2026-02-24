/**
 * WebView ↔ Native bridge message protocol.
 * All messages use JSON: { type: string, payload: any }
 */

export interface BridgeMessage {
  type: string;
  payload: unknown;
}

export function parseBridgeMessage(data: string): BridgeMessage | null {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'type' in parsed &&
      typeof (parsed as BridgeMessage).type === 'string'
    ) {
      return {
        type: (parsed as BridgeMessage).type,
        payload: (parsed as BridgeMessage).payload,
      };
    }
  } catch {
    // ignore invalid JSON
  }
  return null;
}

export function createBridgeMessage(type: string, payload: unknown): BridgeMessage {
  return { type, payload };
}
