import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

const SPLASH_MS = 2000;

type Props = {
  onDone: () => void;
};

export const AppSplash: React.FC<Props> = ({ onDone }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: SPLASH_MS,
      useNativeDriver: false,
    });
    const timer = setTimeout(onDone, SPLASH_MS);

    animation.start();

    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [onDone, progress]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Image
          source={require("../../assets/patrol-splash-logo.png")}
          style={styles.logo}
        />
      </View>
      <Text style={styles.title}>Guard Patrol Scanner</Text>
      <View style={styles.loaderTrack}>
        <Animated.View style={[styles.loaderFill, { width }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17202a",
    padding: 32,
  },
  logoWrap: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logo: {
    width: 132,
    height: 132,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#f7f9fb",
    marginBottom: 28,
  },
  loaderTrack: {
    width: "72%",
    maxWidth: 320,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(247, 249, 251, 0.22)",
  },
  loaderFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#157f59",
  },
});
