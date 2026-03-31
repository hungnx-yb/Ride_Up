import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS, ROLES } from './src/config/config';
import { loadStoredAuth, logoutApi, onAuthExpired } from './src/services/api';

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
import LoginTransitionOverlay from './src/components/LoginTransitionOverlay';

const Stack = createNativeStackNavigator();

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

  const handleLoginSuccess = (userData, authToken) => {
    setTransitionUserName(userData?.fullName || 'ban');
    setTransitionMinDone(false);
    setPostLoginSettled(false);
    setLoginTransitionVisible(true);
    setUser(userData);
    setToken(authToken);

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
          </>
        );
      case ROLES.CUSTOMER:
        return (
          <Stack.Screen name="CustomerHome">
            {() => <CustomerHomeScreen user={user} onLogout={handleLogout} />}
          </Stack.Screen>
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
    </>
  );
}
