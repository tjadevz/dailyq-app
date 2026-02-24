import React, { useRef, useMemo } from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Button,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import WebView from 'react-native-webview';
import { WEBVIEW_URL } from '../config/url';
import { createWebViewBridge } from '../native/bridge';

export function WebViewScreen() {
  const webViewRef = useRef<WebView>(null);

  const { onMessage } = useMemo(
    () =>
      createWebViewBridge(webViewRef, (message) => {
        // Optional: handle messages from Web (e.g. switch on message.type)
        __DEV__ && console.log('Bridge message from Web:', message.type, message.payload);
      }),
    []
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="dark" />
      <WebView
        ref={webViewRef}
        source={{ uri: WEBVIEW_URL }}
        javaScriptEnabled
        domStorageEnabled
        bounces={false}
        startInLoadingState
        onMessage={onMessage}
        renderLoading={() => (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        )}
        renderError={(_errorDomain, _errorCode, _errorDesc) => (
          <View style={styles.centered}>
            <Text style={styles.errorText}>Something went wrong</Text>
            <Button title="Retry" onPress={() => webViewRef.current?.reload()} />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    marginBottom: 16,
    fontSize: 16,
  },
});
