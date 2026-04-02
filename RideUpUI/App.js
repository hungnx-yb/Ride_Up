import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Alert, Modal, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS, ROLES } from './src/config/config';
import {
  loadStoredAuth,
  logoutApi,
  onAuthExpired,
  prefetchDriverBootstrapData,
  createUserNotificationRealtimeClient,
  appendRealtimeNotification,
} from './src/services/api';

// Auth screens
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';

// Role home screens
import AdminHomeScreen from './src/screens/admin/AdminHomeScreen';
import DriverHomeScreen from './src/screens/driver/DriverHomeScreen';
import CustomerHomeScreen from './src/screens/customer/CustomerHomeScreen';
import AdminDriverApprovalScreen from './src/screens/admin/AdminDriverApprovalScreen';
import ManageUsersScreen from './src/screens/admin/ManageUsersScreen';
import ReportsScreen from './src/screens/admin/ReportsScreen';
import SettingsScreen from './src/screens/admin/SettingsScreen';

// Driver sub-screens
import CreateTripScreen from './src/screens/driver/CreateTripScreen';
import AllTripsScreen from './src/screens/driver/AllTripsScreen';
import DriverProfileScreen from './src/screens/driver/DriverProfileScreen';
import TripDetailScreen from './src/screens/driver/TripDetailScreen';
import DriverMessagesScreen from './src/screens/driver/DriverMessagesScreen';
import NotificationCenterScreen from './src/screens/common/NotificationCenterScreen';
import LoginTransitionOverlay from './src/components/LoginTransitionOverlay';

const Stack = createNativeStackNavigator();
const navRef = createNavigationContainerRef();

/** Trả về role ưu tiên cao nhất từ mảng roles */
const getPrimaryRole = (roles = []) => {
  if (roles.includes(ROLES.ADMIN)) return ROLES.ADMIN;
  if (roles.includes(ROLES.DRIVER)) return ROLES.DRIVER;
  if (roles.includes(ROLES.CUSTOMER)) return ROLES.CUSTOMER;
  return null;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loginTransitionVisible, setLoginTransitionVisible] = useState(false);
  const [transitionUserName, setTransitionUserName] = useState('');
  const [transitionMinDone, setTransitionMinDone] = useState(false);
  const [postLoginSettled, setPostLoginSettled] = useState(false);
  const prefetchedForUserIdRef = useRef('');
  const notificationRealtimeRef = useRef(null);
  const seenNotificationIdsRef = useRef(new Set());
  const [paymentNoticeModal, setPaymentNoticeModal] = useState({
    visible: false,
    title: '',
    message: '',
  });

  const closePaymentNoticeModal = () => {
    setPaymentNoticeModal({ visible: false, title: '', message: '' });
  };

  const goToCustomerMyTrips = () => {
    closePaymentNoticeModal();
    if (!navRef.isReady()) {
      return;
    }
    navRef.navigate('CustomerHome', {
      initialTab: 'myTrips',
      forceReloadAt: Date.now(),
    });
  };

  const isVnpayPaymentNotice = (payload) => {
    const type = String(payload?.type || '').toUpperCase();
    const title = String(payload?.title || '').toLowerCase();
    const message = String(payload?.message || '').toLowerCase();

    if (type.includes('VNPAY') || type.includes('REFUND') || type.includes('PAYMENT')) {
      return true;
    }

    const combined = `${title} ${message}`;
    return combined.includes('vnpay')
      || combined.includes('thanh toán')
      || combined.includes('hoàn tiền')
      || combined.includes('refund');
  };

  // Khôi phục session khi mở app
  useEffect(() => {
    loadStoredAuth().then((storedUser) => {
      if (storedUser) {
        setUser(storedUser);
      }
    }).finally(() => setBootstrapping(false));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      Alert.alert('Phiên đăng nhập hết hạn', 'Vui lòng đăng nhập lại để tiếp tục.');
      setUser(null);
      setToken(null);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const userId = user?.id;
    const isDriver = (user?.roles || []).includes(ROLES.DRIVER);

    if (!userId || !isDriver) {
      return;
    }

    if (prefetchedForUserIdRef.current === userId) {
      return;
    }

    prefetchedForUserIdRef.current = userId;
    prefetchDriverBootstrapData().catch(() => {});
  }, [user]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      if (notificationRealtimeRef.current) {
        notificationRealtimeRef.current.disconnect();
        notificationRealtimeRef.current = null;
      }
      seenNotificationIdsRef.current = new Set();
      return;
    }

    if (notificationRealtimeRef.current) {
      notificationRealtimeRef.current.disconnect();
      notificationRealtimeRef.current = null;
    }

    notificationRealtimeRef.current = createUserNotificationRealtimeClient({
      userId,
      onNotification: (payload) => {
        const id = String(payload?.id || `${payload?.type || 'EVENT'}:${payload?.referenceId || Date.now()}`);
        if (seenNotificationIdsRef.current.has(id)) {
          return;
        }
        seenNotificationIdsRef.current.add(id);
        if (seenNotificationIdsRef.current.size > 150) {
          const ids = Array.from(seenNotificationIdsRef.current);
          seenNotificationIdsRef.current = new Set(ids.slice(ids.length - 80));
        }

        appendRealtimeNotification(payload);

        const title = payload?.title || 'Thông báo RideUp';
        const message = payload?.message || 'Bạn có cập nhật mới.';

        if (isVnpayPaymentNotice(payload)) {
          setPaymentNoticeModal({
            visible: true,
            title,
            message,
          });
          return;
        }

        // Non-payment notifications are surfaced via bottom-nav red dots and notification center.
      },
      onError: () => {
        // Keep silent for notification channel errors to avoid alert spam.
      },
    });

    return () => {
      if (notificationRealtimeRef.current) {
        notificationRealtimeRef.current.disconnect();
        notificationRealtimeRef.current = null;
      }
    };
  }, [user?.id]);

  const handleLoginSuccess = (userData, authToken) => {
    setTransitionUserName(userData?.fullName || 'ban');
    setTransitionMinDone(false);
    setPostLoginSettled(false);
    setLoginTransitionVisible(true);
    setUser(userData);
    setToken(authToken);

    if ((userData?.roles || []).includes(ROLES.DRIVER)) {
      prefetchDriverBootstrapData().catch(() => {});
    }

    setTimeout(() => {
      setTransitionMinDone(true);
    }, 1500);
  };

  useEffect(() => {
    if (loginTransitionVisible && transitionMinDone && postLoginSettled) {
      setLoginTransitionVisible(false);
    }
  }, [loginTransitionVisible, transitionMinDone, postLoginSettled]);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch (e) {
      // Local logout still has to happen even if server revoke fails.
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  // Hiển thị spinner khi đang khôi phục session
  if (bootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Chọn màn hình home theo role
  const getRoleHome = () => {
    const role = getPrimaryRole(user?.roles ?? []);
    switch (role) {
      case ROLES.ADMIN:
        return (
          <>
            <Stack.Screen name="AdminHome">
              {(props) => <AdminHomeScreen {...props} user={user} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen name="AdminDriverApproval" component={AdminDriverApprovalScreen} />
            <Stack.Screen name="ManageUsers" component={ManageUsersScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </>
        );
      case ROLES.DRIVER:
        return (
          <>
            <Stack.Screen name="DriverHome">
              {(props) => <DriverHomeScreen {...props} user={user} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
            <Stack.Screen name="AllTrips" component={AllTripsScreen} />
            <Stack.Screen name="DriverMessages" component={DriverMessagesScreen} />
            <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
            <Stack.Screen name="TripDetail" component={TripDetailScreen} />
            <Stack.Screen name="NotificationCenter">
              {(props) => <NotificationCenterScreen {...props} role="DRIVER" />}
            </Stack.Screen>
          </>
        );
      case ROLES.CUSTOMER:
        return (
          <>
            <Stack.Screen name="CustomerHome">
              {(props) => <CustomerHomeScreen {...props} user={user} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen name="NotificationCenter">
              {(props) => <NotificationCenterScreen {...props} role="CUSTOMER" />}
            </Stack.Screen>
          </>
        );
      default:
        // Không có role hợp lệ → quay về Login
        return null;
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer
        ref={navRef}
        onStateChange={() => {
          if (user !== null) {
            setPostLoginSettled(true);
          }
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user === null ? (
            // ── Chưa đăng nhập: hiển thị Auth stack ──
            <>
              <Stack.Screen name="Login">
                {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
              </Stack.Screen>
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            // ── Đã đăng nhập: hiển thị màn hình theo role ──
            getRoleHome()
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <LoginTransitionOverlay
        visible={loginTransitionVisible}
        userName={transitionUserName}
      />
      <Modal
        visible={paymentNoticeModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closePaymentNoticeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBadge}>VNPAY</Text>
            <Text style={styles.modalTitle}>{paymentNoticeModal.title || 'Thông báo thanh toán'}</Text>
            <Text style={styles.modalMessage}>{paymentNoticeModal.message || 'Giao dịch của bạn đã được cập nhật.'}</Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalGhostButton}
                onPress={closePaymentNoticeModal}
                activeOpacity={0.9}
              >
                <Text style={styles.modalGhostButtonText}>Đã hiểu</Text>
              </TouchableOpacity>
              {(user?.roles || []).includes(ROLES.CUSTOMER) && (
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={goToCustomerMyTrips}
                  activeOpacity={0.9}
                >
                  <Text style={styles.modalButtonText}>Chuyến của tôi</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modalBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  modalActionRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  modalGhostButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalGhostButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  modalButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
