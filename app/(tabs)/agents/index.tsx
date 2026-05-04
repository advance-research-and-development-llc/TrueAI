import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Text,
} from 'react-native';
import { Plus, Trash2, CreditCard as Edit2, X } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export default function AgentsScreen() {
  const theme = useAppStore((state) => state.theme);
  const themeColors = colors[theme];
  const userId = useAppStore((state) => state.userId);
  const agents = useAppStore((state) => state.agents);
  const setAgents = useAppStore((state) => state.setAgents);
  const addAgent = useAppStore((state) => state.addAgent);
  const removeAgent = useAppStore((state) => state.removeAgent);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    if (userId) {
      loadAgents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadAgents = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.from('agents').select('*').eq('user_id', userId);
      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const handleSaveAgent = async () => {
    if (!name.trim() || !userId) {
      Alert.alert('Error', 'Agent name is required');
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('agents')
          .update({
            name,
            description,
            system_prompt: systemPrompt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('agents')
          .insert({
            user_id: userId,
            name,
            description,
            system_prompt: systemPrompt,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) addAgent(data);
      }

      resetForm();
      setShowModal(false);
      loadAgents();
    } catch (error) {
      Alert.alert('Error', 'Failed to save agent');
      console.error(error);
    }
  };

  const handleDeleteAgent = async (id: string, agentName: string) => {
    Alert.alert('Delete Agent', `Are you sure you want to delete "${agentName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('agents').delete().eq('id', id);
            if (error) throw error;
            removeAgent(id);
          } catch (error) {
            Alert.alert('Error', 'Failed to delete agent');
            console.error(error);
          }
        },
      },
    ]);
  };

  const handleEditAgent = (agent: any) => {
    setEditingId(agent.id);
    setName(agent.name);
    setDescription(agent.description || '');
    setSystemPrompt(agent.system_prompt || '');
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setSystemPrompt('');
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>AI Agents</Text>
        <TouchableOpacity
          onPress={handleOpenCreate}
          style={[styles.createButton, { backgroundColor: themeColors.primary }]}>
          <Plus color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.agentCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.agentInfo}>
              <Text style={[styles.agentName, { color: themeColors.text }]}>{item.name}</Text>
              {item.description && (
                <Text style={[styles.agentDescription, { color: themeColors.textSecondary }]}>
                  {item.description}
                </Text>
              )}
              <View style={styles.toolsBadges}>
                {item.tools_enabled?.slice(0, 3).map((tool, idx) => (
                  <View key={idx} style={[styles.toolBadge, { backgroundColor: themeColors.primary + '20' }]}>
                    <Text style={[styles.toolBadgeText, { color: themeColors.primary }]}>
                      {tool}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={() => handleEditAgent(item)}
                style={[styles.actionButton, { backgroundColor: themeColors.primary + '20' }]}>
                <Edit2 color={themeColors.primary} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteAgent(item.id, item.name)}
                style={[styles.actionButton, { backgroundColor: colors[theme].error + '20' }]}>
                <Trash2 color={colors[theme].error} size={18} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
            No agents created yet. Tap + to create one.
          </Text>
        }
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <SafeAreaView style={[styles.modal, { backgroundColor: themeColors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {editingId ? 'Edit Agent' : 'New Agent'}
            </Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <X color={themeColors.text} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formContent}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: themeColors.text }]}>Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: themeColors.text, borderColor: themeColors.border, backgroundColor: themeColors.surface },
                ]}
                placeholder="Agent name"
                placeholderTextColor={themeColors.textTertiary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: themeColors.text }]}>Description</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: themeColors.text,
                    borderColor: themeColors.border,
                    backgroundColor: themeColors.surface,
                    height: 80,
                  },
                ]}
                placeholder="Agent description"
                placeholderTextColor={themeColors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: themeColors.text }]}>System Prompt</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: themeColors.text,
                    borderColor: themeColors.border,
                    backgroundColor: themeColors.surface,
                    height: 120,
                  },
                ]}
                placeholder="System prompt for the agent"
                placeholderTextColor={themeColors.textTertiary}
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                multiline
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveAgent}
              style={[styles.saveButton, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.saveButtonText}>Save Agent</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  agentCard: {
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  agentDescription: {
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  toolsBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  toolBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  formContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  saveButton: {
    paddingVertical: spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
