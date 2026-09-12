import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { theme } from '../utils/theme';

// Shared Screens
import ProfileScreen from '../screens/shared/ProfileScreen';
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';
import VisitDetailScreen from '../screens/shared/VisitDetailScreen';

// Faculty Screens
import FacultyDashboardScreen from '../screens/faculty/FacultyDashboardScreen';
import StartVisitScreen from '../screens/faculty/StartVisitScreen';
import EndVisitScreen from '../screens/faculty/EndVisitScreen';
import VisitHistoryScreen from '../screens/faculty/VisitHistoryScreen';
import FormSelectionScreen from '../screens/faculty/FormSelectionScreen';
import FormFillScreen from '../screens/faculty/FormFillScreen';
import FacultyScheduleScreen from '../screens/faculty/FacultyScheduleScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import ManageUsersScreen from '../screens/admin/ManageUsersScreen';
import ManageHostelsScreen from '../screens/admin/ManageHostelsScreen';
import ReportsScreen from '../screens/admin/ReportsScreen';
import CreateUserScreen from '../screens/admin/CreateUserScreen';
import CreateHostelScreen from '../screens/admin/CreateHostelScreen';
import AllVisitsScreen from '../screens/admin/AllVisitsScreen';
import ImportScheduleScreen from '../screens/admin/ImportScheduleScreen';
import ScheduleManagementScreen from '../screens/admin/ScheduleManagementScreen';

// Warden Screens
import WardenDashboardScreen from '../screens/warden/WardenDashboardScreen';
import WardenVisitsScreen from '../screens/warden/WardenVisitsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const tabBarStyle = {
  backgroundColor: theme.colors.surface,
  borderTopColor: theme.colors.border,
  borderTopWidth: 1,
  height: 64,
  paddingBottom: 8,
  paddingTop: 6,
  ...theme.shadow.md,
};

// ─── Faculty Tabs ─────────────────────────────────────────────────────────────
function FacultyTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Dashboard: focused ? 'home' : 'home-outline',
            Schedule:  focused ? 'calendar' : 'calendar-outline',
            Visits:    focused ? 'document-text' : 'document-text-outline',
            Profile:   focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={FacultyDashboardScreen} />
      <Tab.Screen name="Schedule"  component={FacultyScheduleScreen} />
      <Tab.Screen name="Visits"    component={VisitHistoryScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Admin Tabs ───────────────────────────────────────────────────────────────
function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Dashboard: focused ? 'grid' : 'grid-outline',
            Users: focused ? 'people' : 'people-outline',
            Hostels: focused ? 'business' : 'business-outline',
            Reports: focused ? 'bar-chart' : 'bar-chart-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Users" component={ManageUsersScreen} />
      <Tab.Screen name="Hostels" component={ManageHostelsScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Warden Tabs ──────────────────────────────────────────────────────────────
function WardenTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: theme.colors.roleWarden,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Dashboard: focused ? 'home' : 'home-outline',
            'Hostel Visits': focused ? 'list' : 'list-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={WardenDashboardScreen} />
      <Tab.Screen name="Hostel Visits" component={WardenVisitsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Root Stack ───────────────────────────────────────────────────────────────
export default function MainNavigator() {
  const { user } = useAuth();

  const TabsComponent =
    user?.role === 'admin'
      ? AdminTabs
      : user?.role === 'warden'
      ? WardenTabs
      : FacultyTabs;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabsComponent} />

      {/* Visit screens */}
      <Stack.Screen name="StartVisit" component={StartVisitScreen} />
      <Stack.Screen name="EndVisit" component={EndVisitScreen} />
      <Stack.Screen name="VisitDetail" component={VisitDetailScreen} />

      {/* ── Form screens (NEW) ── */}
      <Stack.Screen name="FormSelection" component={FormSelectionScreen} />
      <Stack.Screen name="FormFill" component={FormFillScreen} />

      {/* Faculty schedule */}
      <Stack.Screen name="FacultySchedule" component={FacultyScheduleScreen} />

      {/* Admin screens */}
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="CreateUser" component={CreateUserScreen} />
      <Stack.Screen name="CreateHostel" component={CreateHostelScreen} />
      <Stack.Screen name="AllVisits" component={AllVisitsScreen} />
      <Stack.Screen name="ImportSchedule" component={ImportScheduleScreen} />
      <Stack.Screen name="ScheduleManagement" component={ScheduleManagementScreen} />
    </Stack.Navigator>
  );
}
