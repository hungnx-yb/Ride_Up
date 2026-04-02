import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const SkeletonShimmer = ({ style }) => {
  const translateAnim = useRef(new Animated.Value(-180)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(translateAnim, {
        toValue: 280,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();

    return () => {
      loop.stop();
    };
  }, [translateAnim]);

  return (
    <View style={[styles.base, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shimmer,
          {
            transform: [{ translateX: translateAnim }, { rotate: '12deg' }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    backgroundColor: '#E9EDF3',
  },
  shimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 56,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});

export default SkeletonShimmer;
