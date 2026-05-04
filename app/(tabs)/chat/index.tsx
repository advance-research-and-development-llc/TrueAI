import { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Text,
  ScrollView,
} from 'react-native';
import { Send, Database } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing } from '@/lib/theme';
import { getInferenceEngine } from '@/lib/inference';
import { supabase } from '@/lib/supabase';
import { getRAGService } from '@/lib/rag';

export default function ChatScreen() {
  const theme = useAppStore((state) => state.theme);
  const themeColors = colors[theme];
  const ollamaUrl = useAppStore((state) => state.ollamaUrl);
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const messages = useAppStore((state) => state.messages);
  const setMessages = useAppStore((state) => state.setMessages);
  const addMessage = useAppStore((state) => state.addMessage);
  const userId = useAppStore((state) => state.userId);
  const knowledgeBases = useAppStore((state) => state.knowledgeBases);
  const activeKnowledgeBaseIds = useAppStore((state) => state.activeKnowledgeBaseIds);
  const setActiveKnowledgeBaseIds = useAppStore((state) => state.setActiveKnowledgeBaseIds);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showKBSelector, setShowKBSelector] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inferenceEngine = getInferenceEngine(ollamaUrl);
  const ragService = getRAGService();

  useEffect(() => {
    const loadModels = async () => {
      try {
        const models = await inferenceEngine.listModels();
        if (models.length > 0 && !selectedModel) {
          setSelectedModel(models[0]);
        }
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaUrl]);

  useEffect(() => {
    if (activeConversationId && userId) {
      loadConversationMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  const loadConversationMessages = async () => {
    if (!activeConversationId || !userId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConversationId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedModel || !activeConversationId) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setStreamingText('');

    try {
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          role: 'user',
          content: userMessage,
        })
        .select()
        .single();

      if (messageError) throw messageError;
      if (messageData) addMessage(messageData);

      const conversationMessages = messages.filter(
        (m) => m.conversation_id === activeConversationId
      );
      let systemPrompt =
        conversationMessages.find((m) => m.role === 'system')?.content || 'You are a helpful AI assistant.';

      // Query RAG if knowledge bases are active
      if (activeKnowledgeBaseIds.length > 0) {
        try {
          const ragResult = await ragService.query(
            {
              query: userMessage,
              knowledgeBaseIds: activeKnowledgeBaseIds,
              topK: 3,
              similarityThreshold: 0.5,
            },
            ollamaUrl
          );

          if (ragResult.chunks.length > 0) {
            systemPrompt = `${systemPrompt}

Context from Knowledge Bases:
${ragResult.context}

Use the above context to answer the user's question if relevant. If the context doesn't contain relevant information, answer based on your general knowledge.`;
          }
        } catch (error) {
          console.error('Error querying RAG:', error);
          // Continue without RAG context if it fails
        }
      }

      const assistantMessageContent = await inferenceEngine.generate(
        selectedModel,
        userMessage,
        systemPrompt,
        { temperature: 0.7 },
        (chunk) => {
          setStreamingText((prev) => prev + chunk.token);
        }
      );

      const { data: assistantData, error: assistantError } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          role: 'assistant',
          content: assistantMessageContent,
        })
        .select()
        .single();

      if (assistantError) throw assistantError;
      if (assistantData) addMessage(assistantData);

      setStreamingText('');
    } catch (error) {
      console.error('Error sending message:', error);
      setStreamingText('');
    } finally {
      setLoading(false);
    }
  };

  const toggleKnowledgeBase = (kbId: string) => {
    if (activeKnowledgeBaseIds.includes(kbId)) {
      setActiveKnowledgeBaseIds(activeKnowledgeBaseIds.filter((id) => id !== kbId));
    } else {
      setActiveKnowledgeBaseIds([...activeKnowledgeBaseIds, kbId]);
    }
  };

  const filteredMessages = messages.filter((m) => m.conversation_id === activeConversationId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.title, { color: themeColors.text }]}>AI Chat</Text>
              {selectedModel && (
                <Text style={[styles.modelLabel, { color: themeColors.textSecondary }]}>{selectedModel}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.kbToggle, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => setShowKBSelector(!showKBSelector)}>
              <Database color={activeKnowledgeBaseIds.length > 0 ? themeColors.primary : themeColors.text} size={20} strokeWidth={2} />
              {activeKnowledgeBaseIds.length > 0 && (
                <View style={[styles.badge, { backgroundColor: themeColors.primary }]}>
                  <Text style={styles.badgeText}>{activeKnowledgeBaseIds.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          {showKBSelector && (
            <View style={[styles.kbSelector, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.kbSelectorTitle, { color: themeColors.text }]}>Active Knowledge Bases</Text>
              {knowledgeBases.length === 0 ? (
                <Text style={[styles.kbEmptyText, { color: themeColors.textSecondary }]}>
                  No knowledge bases available. Create one in the Knowledge tab.
                </Text>
              ) : (
                <ScrollView style={styles.kbList}>
                  {knowledgeBases.map((kb) => (
                    <TouchableOpacity
                      key={kb.id}
                      style={[
                        styles.kbItem,
                        {
                          backgroundColor: activeKnowledgeBaseIds.includes(kb.id)
                            ? themeColors.primary + '20'
                            : themeColors.background,
                          borderColor: activeKnowledgeBaseIds.includes(kb.id)
                            ? themeColors.primary
                            : themeColors.border,
                        },
                      ]}
                      onPress={() => toggleKnowledgeBase(kb.id)}>
                      <View style={styles.kbItemInfo}>
                        <Text style={[styles.kbItemName, { color: themeColors.text }]}>{kb.name}</Text>
                        <Text style={[styles.kbItemStats, { color: themeColors.textSecondary }]}>
                          {kb.document_count} docs • {kb.chunk_count} chunks
                        </Text>
                      </View>
                      {activeKnowledgeBaseIds.includes(kb.id) && (
                        <View style={[styles.checkmark, { backgroundColor: themeColors.primary }]}>
                          <Text style={styles.checkmarkText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                {
                  alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: item.role === 'user' ? themeColors.primary : themeColors.surface,
                },
              ]}>
              <Text
                style={[
                  styles.messageText,
                  { color: item.role === 'user' ? '#fff' : themeColors.text },
                ]}>
                {item.content}
              </Text>
            </View>
          )}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {streamingText && (
          <View style={[styles.streamingBubble, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.messageText, { color: themeColors.text }]}>{streamingText}</Text>
          </View>
        )}

        <View style={[styles.inputContainer, { backgroundColor: themeColors.surface }]}>
          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.text,
                borderColor: themeColors.border,
                backgroundColor: themeColors.background,
              },
            ]}
            placeholder="Message..."
            placeholderTextColor={themeColors.textTertiary}
            value={input}
            onChangeText={setInput}
            multiline
            editable={!loading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: themeColors.primary, opacity: loading ? 0.5 : 1 },
            ]}
            onPress={handleSend}
            disabled={loading || !input.trim()}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Send color="#fff" size={20} strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  modelLabel: {
    fontSize: 12,
    marginTop: spacing.xs,
  },
  kbToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  kbSelector: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    maxHeight: 200,
  },
  kbSelectorTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  kbList: {
    maxHeight: 150,
  },
  kbItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  kbItemInfo: {
    flex: 1,
  },
  kbItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  kbItemStats: {
    fontSize: 11,
  },
  kbEmptyText: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: 12,
    marginVertical: spacing.xs,
  },
  streamingBubble: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
