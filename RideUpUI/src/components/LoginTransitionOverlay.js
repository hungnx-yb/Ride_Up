import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const LoginTransitionOverlay = ({ visible, userName }) => {
  const [rendered, setRendered] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const panelRise = useRef(new Animated.Value(16)).current;
  const panelFade = useRef(new Animated.Value(0)).current;
  const blobDriftA = useRef(new Animated.Value(0)).current;
  const blobDriftB = useRef(new Animated.Value(0)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const progressFlow = useRef(new Animated.Value(0)).current;

  const blobLoopARef = useRef(null);
  const blobLoopBRef = useRef(null);
  const ringLoopRef = useRef(null);
  const pulseLoopRef = useRef(null);
  const progressLoopRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setRendered(true);

      overlayOpacity.setValue(0);
      panelRise.setValue(16);
      panelFade.setValue(0);
      blobDriftA.setValue(0);
      blobDriftB.setValue(0);
      ringRotate.setValue(0);
      pulse.setValue(0);
      progressFlow.setValue(0);

      blobLoopARef.current?.stop();
      blobLoopBRef.current?.stop();
      ringLoopRef.current?.stop();
      pulseLoopRef.current?.stop();
      progressLoopRef.current?.stop();

      blobLoopARef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(blobDriftA, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(blobDriftA, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ])
      );

      blobLoopBRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(blobDriftB, {
            toValue: 1,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(blobDriftB, {
            toValue: 0,
            duration: 2200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ])
      );

      ringLoopRef.current = Animated.loop(
        Animated.timing(ringRotate, {
          toValue: 1,
          duration: 2600,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        })
      );

      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
            isInteraction: false,
          }),
        ])
      );

      progressLoopRef.current = Animated.loop(
        Animated.timing(progressFlow, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        })
      );

      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(panelRise, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(panelFade, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      blobLoopARef.current.start();
      blobLoopBRef.current.start();
      ringLoopRef.current.start();
      pulseLoopRef.current.start();
      progressLoopRef.current.start();
    } else if (rendered) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        blobLoopARef.current?.stop();
        blobLoopBRef.current?.stop();
        ringLoopRef.current?.stop();
        pulseLoopRef.current?.stop();
        progressLoopRef.current?.stop();
        setRendered(false);
      });
    }

    return () => {
      blobLoopARef.current?.stop();
      blobLoopBRef.current?.stop();
      ringLoopRef.current?.stop();
      pulseLoopRef.current?.stop();
      progressLoopRef.current?.stop();
    };
  }, [
    visible,
    rendered,
    overlayOpacity,
    panelRise,
    panelFade,
    blobDriftA,
    blobDriftB,
    ringRotate,
    pulse,
    progressFlow,
  ]);

  if (!rendered) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: overlayOpacity }]}>
      <View style={styles.bgLayerTop} />
      <View style={styles.bgLayerBottom} />

      <Animated.View
        style={[
          styles.blobA,
          {
            transform: [
              { translateX: blobDriftA.interpolate({ inputRange: [0, 1], outputRange: [-24, 24] }) },
              { translateY: blobDriftA.interpolate({ inputRange: [0, 1], outputRange: [16, -16] }) },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.blobB,
          {
            transform: [
              { translateX: blobDriftB.interpolate({ inputRange: [0, 1], outputRange: [18, -18] }) },
              { translateY: blobDriftB.interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }) },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.panel,
          {
            opacity: panelFade,
            transform: [{ translateY: panelRise }],
          },
        ]}
      >
        <Text style={styles.brand}>RideUp</Text>
        <Text style={styles.subtitle}>Dang ket noi hanh trinh cho {userName || 'ban'}</Text>

        <View style={styles.orbitWrap}>
          <Animated.View
            style={[
              styles.outerRing,
              {
                transform: [
                  { rotate: ringRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                  { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
                ],
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
              },
            ]}
          />
          <View style={styles.core} />
          <View style={styles.dotA} />
          <View style={styles.dotB} />
        </View>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressGlow,
              {
                transform: [
                  {
                    translateX: progressFlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-96, 220],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgLayerTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B132B',
  },
  bgLayerBottom: {
    ...StyleSheet.absoluteFillObject,
    top: '34%',
    backgroundColor: '#1C2541',
    opacity: 0.92,
  },
  blobA: {
    position: 'absolute',
    width: width * 0.82,
    height: width * 0.82,
    borderRadius: 999,
    backgroundColor: 'rgba(60, 100, 255, 0.24)',
    top: -width * 0.25,
    left: -width * 0.2,
  },
  blobB: {
    position: 'absolute',
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: 999,
    backgroundColor: 'rgba(44, 182, 125, 0.18)',
    bottom: -width * 0.28,
    right: -width * 0.16,
  },
  panel: {
    width: Math.min(width - 42, 360),
    minHeight: 260,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: '#F8FAFC',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 8,
    color: '#C7D2FE',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  orbitWrap: {
    marginTop: 22,
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    borderColor: '#60A5FA',
    borderTopColor: '#34D399',
    borderRightColor: '#22D3EE',
  },
  core: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#93C5FD',
  },
  dotA: {
    position: 'absolute',
    top: 20,
    right: 26,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  dotB: {
    position: 'absolute',
    bottom: 22,
    left: 24,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FBBF24',
  },
  progressTrack: {
    marginTop: 24,
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.26)',
    overflow: 'hidden',
  },
  progressGlow: {
    width: 96,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});

export default LoginTransitionOverlay;
