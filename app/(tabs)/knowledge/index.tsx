import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2, Upload, FileText, Database as DatabaseIcon } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors } from '@/lib/theme';
import { getRAGService } from '@/lib/rag';
import { DocumentParser } from '@/lib/document-parser';

export default function KnowledgeScreen() {
  const theme = useAppStore((state) => state.theme);
  const userId = useAppStore((state) => state.userId);
  const ollamaUrl = useAppStore((state) => state.ollamaUrl);
  const knowledgeBases = useAppStore((state) => state.knowledgeBases);
  const setKnowledgeBases = useAppStore((state) => state.setKnowledgeBases);
  const addKnowledgeBase = useAppStore((state) => state.addKnowledgeBase);
  const removeKnowledgeBase = useAppStore((state) => state.removeKnowledgeBase);

  const [isCreating, setIsCreating] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');

  const themeColors = colors[theme as 'light' | 'dark'];
  const ragService = getRAGService();

  useEffect(() => {
    loadKnowledgeBases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadKnowledgeBases = async () => {
    if (!userId) return;
    try {
      const bases = await ragService.listKnowledgeBases(userId);
      setKnowledgeBases(bases);
    } catch (error) {
      console.error('Error loading knowledge bases:', error);
    }
  };

  const handleCreateKnowledgeBase = async () => {
    if (!userId || !newKBName.trim()) {
      Alert.alert('Error', 'Please enter a name for the knowledge base');
      return;
    }

    try {
      const kb = await ragService.createKnowledgeBase(
        userId,
        newKBName.trim(),
        newKBDescription.trim() || null,
        'document'
      );
      addKnowledgeBase(kb);
      setNewKBName('');
      setNewKBDescription('');
      setIsCreating(false);
      Alert.alert('Success', 'Knowledge base created successfully');
    } catch (error) {
      console.error('Error creating knowledge base:', error);
      Alert.alert('Error', 'Failed to create knowledge base');
    }
  };

  const handleDeleteKnowledgeBase = async (id: string, name: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${name}"? This will remove all documents and chunks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ragService.deleteKnowledgeBase(id);
              removeKnowledgeBase(id);
              Alert.alert('Success', 'Knowledge base deleted');
            } catch (error) {
              console.error('Error deleting knowledge base:', error);
              Alert.alert('Error', 'Failed to delete knowledge base');
            }
          },
        },
      ]
    );
  };

  const handleUploadDocument = async (knowledgeBaseId: string) => {
    try {
      const result = await DocumentParser.pickDocument();

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.uri || !file.mimeType) {
        Alert.alert('Error', 'Invalid file selected');
        return;
      }

      if (!DocumentParser.isSupportedType(file.mimeType)) {
        Alert.alert('Error', `Unsupported file type: ${file.mimeType}`);
        return;
      }

      Alert.alert('Processing', 'Uploading and processing document...');

      await ragService.addDocument(
        knowledgeBaseId,
        file.uri,
        file.name,
        file.mimeType,
        ollamaUrl
      );

      await loadKnowledgeBases();
      Alert.alert('Success', 'Document uploaded and processed successfully');
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: themeColors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    content: {
      flex: 1,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.primary,
      margin: 20,
      padding: 16,
      borderRadius: 12,
      gap: 8,
    },
    createButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    createForm: {
      backgroundColor: themeColors.surface,
      margin: 20,
      padding: 20,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    input: {
      backgroundColor: themeColors.background,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      color: themeColors.text,
      fontSize: 16,
    },
    formButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    formButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: themeColors.primary,
    },
    secondaryButton: {
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    buttonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    secondaryButtonText: {
      color: themeColors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    knowledgeBaseCard: {
      backgroundColor: themeColors.surface,
      margin: 20,
      marginTop: 10,
      marginBottom: 10,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    kbHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    kbInfo: {
      flex: 1,
    },
    kbName: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 4,
    },
    kbDescription: {
      fontSize: 14,
      color: themeColors.textSecondary,
      marginBottom: 8,
    },
    kbStats: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 12,
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statText: {
      fontSize: 12,
      color: themeColors.textSecondary,
    },
    kbActions: {
      flexDirection: 'row',
      gap: 8,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      gap: 6,
      backgroundColor: themeColors.background,
    },
    actionButtonText: {
      fontSize: 12,
      color: themeColors.text,
      fontWeight: '600',
    },
    deleteButton: {
      padding: 8,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyIcon: {
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: themeColors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Knowledge Bases</Text>
        <Text style={styles.subtitle}>
          Add documents and text to create searchable knowledge for AI conversations
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {!isCreating && (
          <TouchableOpacity style={styles.createButton} onPress={() => setIsCreating(true)}>
            <Plus color="#fff" size={20} strokeWidth={2.5} />
            <Text style={styles.createButtonText}>Create Knowledge Base</Text>
          </TouchableOpacity>
        )}

        {isCreating && (
          <View style={styles.createForm}>
            <TextInput
              style={styles.input}
              placeholder="Knowledge Base Name"
              placeholderTextColor={themeColors.textTertiary}
              value={newKBName}
              onChangeText={setNewKBName}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Description (optional)"
              placeholderTextColor={themeColors.textTertiary}
              value={newKBDescription}
              onChangeText={setNewKBDescription}
              multiline
            />
            <View style={styles.formButtons}>
              <TouchableOpacity
                style={[styles.formButton, styles.secondaryButton]}
                onPress={() => {
                  setIsCreating(false);
                  setNewKBName('');
                  setNewKBDescription('');
                }}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formButton, styles.primaryButton]}
                onPress={handleCreateKnowledgeBase}>
                <Text style={styles.buttonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {knowledgeBases.length === 0 && !isCreating && (
          <View style={styles.emptyState}>
            <DatabaseIcon
              color={themeColors.textTertiary}
              size={64}
              strokeWidth={1.5}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyText}>No Knowledge Bases Yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first knowledge base to start adding documents and enabling RAG in conversations
            </Text>
          </View>
        )}

        {knowledgeBases.map((kb) => (
          <View key={kb.id} style={styles.knowledgeBaseCard}>
            <View style={styles.kbHeader}>
              <View style={styles.kbInfo}>
                <Text style={styles.kbName}>{kb.name}</Text>
                {kb.description && <Text style={styles.kbDescription}>{kb.description}</Text>}
                <View style={styles.kbStats}>
                  <View style={styles.stat}>
                    <FileText color={themeColors.textSecondary} size={14} strokeWidth={2} />
                    <Text style={styles.statText}>{kb.document_count} docs</Text>
                  </View>
                  <View style={styles.stat}>
                    <DatabaseIcon color={themeColors.textSecondary} size={14} strokeWidth={2} />
                    <Text style={styles.statText}>{kb.chunk_count} chunks</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteKnowledgeBase(kb.id, kb.name)}>
                <Trash2 color={themeColors.error || '#ff4444'} size={20} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.kbActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => handleUploadDocument(kb.id)}>
                <Upload color={themeColors.text} size={16} strokeWidth={2} />
                <Text style={styles.actionButtonText}>Upload Document</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
