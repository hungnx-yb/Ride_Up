import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';

const { width } = Dimensions.get('window');

const LoginTransitionOverlay = ({ visible, userName }) => {
  const [rendered, setRendered] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const linePhase = useRef(new Animated.Value(0)).current;
  const lightSweep = useRef(new Animated.Value(0)).current;
  const carFloat = useRef(new Animated.Value(0)).current;
  const carTilt = useRef(new Animated.Value(0)).current;
  const wheelSpin = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0)).current;

  const lineLoopRef = useRef(null);
  const sweepLoopRef = useRef(null);
  const floatLoopRef = useRef(null);
  const wheelLoopRef = useRef(null);
  const glowLoopRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      overlayOpacity.setValue(0);
      linePhase.setValue(0);
      lightSweep.setValue(0);
      carFloat.setValue(0);
      carTilt.setValue(0);
      wheelSpin.setValue(0);
      glowPulse.setValue(0);

      lineLoopRef.current?.stop();
      sweepLoopRef.current?.stop();
      floatLoopRef.current?.stop();
      wheelLoopRef.current?.stop();
      glowLoopRef.current?.stop();

      lineLoopRef.current = Animated.loop(
        Animated.timing(linePhase, {
          toValue: 1,
          duration: 680,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      sweepLoopRef.current = Animated.loop(
        Animated.timing(lightSweep, {
          toValue: 1,
          duration: 1300,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      floatLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(carFloat, {
              toValue: -4,
              duration: 300,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(carTilt, {
              toValue: -2,
              duration: 300,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(carFloat, {
              toValue: 3,
              duration: 300,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(carTilt, {
              toValue: 2,
              duration: 300,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      wheelLoopRef.current = Animated.loop(
        Animated.timing(wheelSpin, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );

      glowLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(glowPulse, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );

      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      lineLoopRef.current.start();
      sweepLoopRef.current.start();
      floatLoopRef.current.start();
      wheelLoopRef.current.start();
      glowLoopRef.current.start();
    } else if (rendered) {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        lineLoopRef.current?.stop();
        sweepLoopRef.current?.stop();
        floatLoopRef.current?.stop();
        wheelLoopRef.current?.stop();
        glowLoopRef.current?.stop();
        setRendered(false);
      });
    }

    return () => {
      lineLoopRef.current?.stop();
      sweepLoopRef.current?.stop();
      floatLoopRef.current?.stop();
      wheelLoopRef.current?.stop();
      glowLoopRef.current?.stop();
    };
  }, [
    visible,
    rendered,
    overlayOpacity,
    linePhase,
    lightSweep,
    carFloat,
    carTilt,
    wheelSpin,
    glowPulse,
  ]);

  if (!rendered) {
    return null;
  }

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: overlayOpacity }]}>
      <View style={styles.bgGradientTop} />
      <View style={styles.bgGradientBottom} />

      <Animated.View
        style={[
          styles.sweep,
          {
            transform: [{ translateX: lightSweep.interpolate({ inputRange: [0, 1], outputRange: [-width, width] }) }],
          },
        ]}
      />

      <Animated.View style={[styles.captionWrap, { opacity: overlayOpacity }]}> 
        <Text style={styles.captionTop}>RideUp</Text>
        <Text style={styles.captionBottom}>Dang dua {userName || 'ban'} vao hanh trinh...</Text>
      </Animated.View>

      <View style={styles.road}>
        {[0, 1, 2, 3, 4].map((idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.roadDash,
              {
                transform: [{
                  translateX: linePhase.interpolate({
                    inputRange: [0, 1],
                    outputRange: [idx * 90, idx * 90 - 90],
                  }),
                }],
              },
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[
          styles.trailGlow,
          {
            opacity: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.62] }),
            transform: [{ scaleX: glowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.carWrap,
          {
            transform: [
              { translateY: carFloat },
              { rotate: carTilt.interpolate({ inputRange: [-4, 4], outputRange: ['-4deg', '4deg'] }) },
            ],
          },
        ]}
      >
        <View style={styles.carBody}>
          <View style={styles.carCabin} />
          <View style={styles.carWindow} />
          <View style={styles.carHeadlight} />
        </View>
        <View style={styles.wheelRow}>
          <Animated.View
            style={[
              styles.wheel,
              {
                transform: [{ rotate: wheelSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
              },
            ]}
          >
            <View style={styles.wheelInner} />
          </Animated.View>
          <Animated.View
            style={[
              styles.wheel,
              {
                transform: [{ rotate: wheelSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
              },
            ]}
          >
            <View style={styles.wheelInner} />
          </Animated.View>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bgGradientTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#082032',
  },
  bgGradientBottom: {
    ...StyleSheet.absoluteFillObject,
    top: '35%',
    backgroundColor: '#0F4C5C',
    opacity: 0.75,
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 140,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  captionWrap: {
    position: 'absolute',
    top: '20%',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  captionTop: {
    color: '#F8FAFC',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  captionBottom: {
    marginTop: 8,
    color: '#D1E9FF',
    fontSize: 14,
    fontWeight: '600',
  },
  road: {
    position: 'absolute',
    bottom: '17%',
    flexDirection: 'row',
    alignItems: 'center',
    width: width + 120,
    left: -40,
    overflow: 'hidden',
  },
  roadDash: {
    position: 'absolute',
    width: 56,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(236,253,245,0.7)',
  },
  trailGlow: {
    position: 'absolute',
    bottom: '16.8%',
    width: 220,
    height: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(110,231,183,0.7)',
  },
  carWrap: {
    position: 'absolute',
    bottom: '17%',
    left: width * 0.5 - 70,
    width: 140,
    alignItems: 'center',
  },
  carBody: {
    width: 124,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#BBF7D0',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  carCabin: {
    position: 'absolute',
    top: -16,
    left: 28,
    width: 56,
    height: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#86EFAC',
  },
  carWindow: {
    marginTop: 6,
    width: 16,
    height: 10,
    borderRadius: 4,
    backgroundColor: '#DBEAFE',
  },
  carHeadlight: {
    position: 'absolute',
    right: -2,
    top: 10,
    width: 6,
    height: 10,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: '#FEF08A',
  },
  wheelRow: {
    marginTop: -2,
    width: 108,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wheel: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
});

export default LoginTransitionOverlay;
