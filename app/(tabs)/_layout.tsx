import { Tabs } from 'expo-router';
import {
  MessageCircle,
  Zap,
  Settings,
  BookOpen,
  Package,
  Database,
  Target,
  Layers,
  Calendar,
  GitBranch,
  TrendingUp
} from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function TabLayout() {
  const theme = useAppStore((state: any) => state.theme);
  const themeColors = colors[theme as 'light' | 'dark'];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: themeColors.primary,
        tabBarInactiveTintColor: themeColors.textTertiary,
        tabBarStyle: {
          backgroundColor: themeColors.surface,
          borderTopColor: themeColors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
        },
      }}>
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: 'Agents',
          tabBarIcon: ({ color, size }) => <Zap color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="models"
        options={{
          title: 'Models',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="benchmark"
        options={{
          title: 'Benchmark',
          tabBarIcon: ({ color, size }) => <Target color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="ensemble"
        options={{
          title: 'Ensemble',
          tabBarIcon: ({ color, size }) => <Layers color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="scheduler"
        options={{
          title: 'Scheduler',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="workflows"
        options={{
          title: 'Workflows',
          tabBarIcon: ({ color, size }) => <GitBranch color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="extensions"
        options={{
          title: 'Extensions',
          tabBarIcon: ({ color, size }) => <Package color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: 'Knowledge',
          tabBarIcon: ({ color, size }) => <Database color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
