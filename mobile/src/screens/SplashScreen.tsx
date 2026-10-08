import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LoadingSpinner } from '../components/Loading';
import { Screen } from '../components/Screen';

export default function SplashScreen(): React.JSX.Element {
  return (
    <Screen scroll={false} style={styles.center}>
      <View style={styles.logoWrap}>
        <Image
          source={require('../../assets/logo-tile.png')}
          style={styles.logo}
          accessibilityLabel="Fleet Fuel Manager logo"
        />
      </View>
      <LoadingSpinner label="Signing you in…" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center'
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 16
  },
  logo: {
    width: 96,
    height: 96
  }
});
