import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Text,
} from 'react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { getInferenceEngine, setInferenceEngineUrl } from '@/lib/inference';
import { getNotificationsService } from '@/lib/notifications';

export default function SettingsScreen() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const ollamaUrl = useAppStore((state) => state.ollamaUrl);
  const setOllamaUrl = useAppStore((state) => state.setOllamaUrl);
  const userId = useAppStore((state) => state.userId);
  const setUserId = useAppStore((state) => state.setUserId);

  const themeColors = colors[theme];
  const [tempOllamaUrl, setTempOllamaUrl] = useState(ollamaUrl);
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    testOllamaConnection();
    checkNotificationPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaUrl]);

  const checkNotificationPermissions = async () => {
    const notifService = getNotificationsService();
    const enabled = await notifService.areNotificationsEnabled();
    setNotificationsEnabled(enabled);
  };

  const testOllamaConnection = async () => {
    try {
      const engine = getInferenceEngine(ollamaUrl);
      const connected = await engine.checkConnectivity();
      setOllamaConnected(connected);
    } catch {
      setOllamaConnected(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const engine = getInferenceEngine(tempOllamaUrl);
      const connected = await engine.checkConnectivity();
      if (connected) {
        setOllamaUrl(tempOllamaUrl);
        setInferenceEngineUrl(tempOllamaUrl);
        setOllamaConnected(true);
        Alert.alert('Success', 'Connected to Ollama server');
      } else {
        Alert.alert('Error', 'Failed to connect to Ollama server');
      }
    } catch {
      Alert.alert('Error', 'Invalid URL or connection failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            setUserId(null);
          } catch {
            Alert.alert('Error', 'Failed to sign out');
          }
        },
      },
    ]);
  };

  const handleToggleNotifications = async (value: boolean) => {
    const notifService = getNotificationsService();
    if (value) {
      const granted = await notifService.requestPermissions();
      if (granted) {
        setNotificationsEnabled(true);
        Alert.alert('Success', 'Notifications enabled');
      } else {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings');
      }
    } else {
      setNotificationsEnabled(false);
      Alert.alert('Notifications Disabled', 'You will no longer receive notifications');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Appearance</Text>

        <View style={[styles.settingCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Dark Mode</Text>
            <Switch
              value={theme === 'dark'}
              onValueChange={(value) => setTheme(value ? 'dark' : 'light')}
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: spacing.lg }]}>
          Model Sources
        </Text>

        <View style={[styles.settingCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.cardLabel, { color: themeColors.text }]}>Ollama Server</Text>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.text,
                borderColor: themeColors.border,
                backgroundColor: themeColors.background,
              },
            ]}
            placeholder="http://localhost:11434"
            placeholderTextColor={themeColors.textTertiary}
            value={tempOllamaUrl}
            onChangeText={setTempOllamaUrl}
            editable={!testing}
          />

          <View style={styles.connectionStatus}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: ollamaConnected ? colors[theme].success : colors[theme].error },
              ]}
            />
            <Text style={[styles.statusText, { color: themeColors.textSecondary }]}>
              {ollamaConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleTestConnection}
            disabled={testing}
            style={[styles.testButton, { backgroundColor: themeColors.primary, opacity: testing ? 0.5 : 1 }]}>
            <Text style={styles.testButtonText}>{testing ? 'Testing...' : 'Test Connection'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: spacing.lg }]}>
          Inference Settings
        </Text>

        <View style={[styles.settingCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Default Temperature</Text>
            <Text style={[styles.settingValue, { color: themeColors.textSecondary }]}>0.7</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Max Tokens</Text>
            <Text style={[styles.settingValue, { color: themeColors.textSecondary }]}>2000</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Top P</Text>
            <Text style={[styles.settingValue, { color: themeColors.textSecondary }]}>0.9</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: spacing.lg }]}>
          Privacy & Data
        </Text>

        <View style={[styles.settingCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Cloud Sync</Text>
            <Switch
              value={true}
              disabled
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
            />
          </View>
          <Text style={[styles.settingDescription, { color: themeColors.textTertiary }]}>
            Sync conversations and settings with Supabase
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: spacing.lg }]}>
          Notifications
        </Text>

        <View style={[styles.settingCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Enable Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
            />
          </View>
          <Text style={[styles.settingDescription, { color: themeColors.textTertiary }]}>
            Receive notifications for completed tasks, workflows, and benchmarks
          </Text>
        </View>

        {userId && (
          <>
            <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: spacing.lg }]}>
              Account
            </Text>

            <TouchableOpacity
              onPress={handleSignOut}
              style={[styles.signOutButton, { backgroundColor: colors[theme].error + '20' }]}>
              <Text style={[styles.signOutText, { color: colors[theme].error }]}>Sign Out</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: themeColors.text, marginTop: spacing.lg }]}>
          About
        </Text>

        <View style={[styles.settingCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: themeColors.text }]}>Version</Text>
            <Text style={[styles.settingValue, { color: themeColors.textSecondary }]}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  settingCard: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
  },
  settingDescription: {
    fontSize: 12,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
  },
  testButton: {
    paddingVertical: spacing.sm,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  signOutButton: {
    paddingVertical: spacing.md,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
