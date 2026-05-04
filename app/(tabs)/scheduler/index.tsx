import { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Text,
  ScrollView,
  Switch,
} from 'react-native';
import { Calendar, Clock, PlayCircle, Trash2, Plus } from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { colors, spacing, typography } from '@/lib/theme';
import { getInferenceEngine } from '@/lib/inference';
import { getAgentSchedulerService } from '@/lib/agent-scheduler';

const SCHEDULE_TYPES = [
  { id: 'once', name: 'Once', icon: '⏱️', description: 'Run at a specific time' },
  { id: 'interval', name: 'Interval', icon: '🔄', description: 'Run every N minutes' },
  { id: 'daily', name: 'Daily', icon: '📅', description: 'Run at specific time each day' },
  { id: 'weekly', name: 'Weekly', icon: '📆', description: 'Run on specific day each week' },
  { id: 'monthly', name: 'Monthly', icon: '🗓️', description: 'Run on specific day each month' },
];

export default function SchedulerScreen() {
  const theme = useAppStore((state) => state.theme);
  const themeColors = colors[theme];
  const ollamaUrl = useAppStore((state) => state.ollamaUrl);
  const userId = useAppStore((state) => state.userId);
  const agents = useAppStore((state) => state.agents);
  const models = useAppStore((state) => state.models);

  const [tab, setTab] = useState<'tasks' | 'create' | 'history'>('tasks');
  const [loading, setLoading] = useState(false);
  const [scheduledTasks, setScheduledTasks] = useState<any[]>([]);
  const [taskExecutions, setTaskExecutions] = useState<any[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<any>(null);

  // Create form state
  const [taskName, setTaskName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [taskInput, setTaskInput] = useState('');
  const [scheduleType, setScheduleType] = useState(SCHEDULE_TYPES[0]);
  const [intervalMinutes, setIntervalMinutes] = useState('30');
  const [timeOfDay, setTimeOfDay] = useState('09:00');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [maxRuns, setMaxRuns] = useState('');

  const inferenceEngine = getInferenceEngine(ollamaUrl);
  const schedulerService = getAgentSchedulerService();

  useEffect(() => {
    if (userId) {
      if (tab === 'tasks') {
        loadScheduledTasks();
      } else if (tab === 'history' && scheduledTasks.length > 0) {
        loadTaskExecutions(scheduledTasks[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, userId]);

  const loadScheduledTasks = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const tasks = await schedulerService.getUserScheduledTasks(userId);
      setScheduledTasks(tasks);
    } catch (error) {
      console.error('Error loading scheduled tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTaskExecutions = async (taskId: string) => {
    setLoading(true);
    try {
      const executions = await schedulerService.getTaskExecutions(taskId, 20);
      setTaskExecutions(executions);
    } catch (error) {
      console.error('Error loading task executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskName.trim() || !selectedAgent || !selectedModel || !taskInput.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setLoading(true);
    try {
      const scheduleConfig: any = {};

      switch (scheduleType.id) {
        case 'interval':
          scheduleConfig.intervalMinutes = parseInt(intervalMinutes);
          break;
        case 'daily':
          scheduleConfig.timeOfDay = timeOfDay;
          break;
        case 'weekly':
          scheduleConfig.dayOfWeek = parseInt(dayOfWeek);
          scheduleConfig.weeklyTime = timeOfDay;
          break;
        case 'monthly':
          scheduleConfig.dayOfMonth = parseInt(dayOfMonth);
          scheduleConfig.monthlyTime = timeOfDay;
          break;
      }

      if (maxRuns) {
        scheduleConfig.maxRuns = parseInt(maxRuns);
      }

      await schedulerService.createScheduledTask(
        userId,
        selectedAgent.id,
        taskName,
        scheduleType.id as any,
        scheduleConfig,
        taskInput,
        selectedModel.name,
        taskDescription
      );

      Alert.alert('Success', `Task "${taskName}" created successfully`, [
        { text: 'View Tasks', onPress: () => setTab('tasks') },
        { text: 'OK' },
      ]);

      // Reset form
      setTaskName('');
      setTaskDescription('');
      setTaskInput('');
      setMaxRuns('');
      loadScheduledTasks();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create task');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (task: any) => {
    try {
      if (task.enabled) {
        await schedulerService.disableTask(task.id);
      } else {
        await schedulerService.enableTask(task.id);
      }
      loadScheduledTasks();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to toggle task');
    }
  };

  const handleDeleteTask = async (taskId: string, taskName: string) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${taskName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await schedulerService.deleteScheduledTask(taskId);
            loadScheduledTasks();
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete task');
          }
        },
      },
    ]);
  };

  const handleManualRun = async (task: any) => {
    Alert.alert(
      'Manual Run',
      `Execute "${task.name}" now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run',
          onPress: async () => {
            setLoading(true);
            try {
              await schedulerService.executeTask(task.id, inferenceEngine);
              Alert.alert('Success', 'Task executed successfully');
              loadTaskExecutions(task.id);
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to execute task');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderTasksTab = () => (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {loading ? (
        <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={scheduledTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.taskCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.taskHeader}>
                <View style={styles.taskTitleRow}>
                  <Text style={[styles.taskName, { color: themeColors.text }]}>{item.name}</Text>
                  <Switch
                    value={item.enabled}
                    onValueChange={() => handleToggleTask(item)}
                    trackColor={{ false: themeColors.border, true: themeColors.primary }}
                  />
                </View>
                {item.description && (
                  <Text style={[styles.taskDescription, { color: themeColors.textSecondary }]}>
                    {item.description}
                  </Text>
                )}
              </View>

              <View style={styles.taskDetails}>
                <View style={styles.detailRow}>
                  <Calendar color={themeColors.textSecondary} size={16} />
                  <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                    {item.schedule_type}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Clock color={themeColors.textSecondary} size={16} />
                  <Text style={[styles.detailText, { color: themeColors.textSecondary }]}>
                    Next: {item.next_run ? new Date(item.next_run).toLocaleString() : 'N/A'}
                  </Text>
                </View>
                <Text style={[styles.runCount, { color: themeColors.textTertiary }]}>
                  Runs: {item.run_count}
                  {item.schedule_config?.maxRuns && ` / ${item.schedule_config.maxRuns}`}
                </Text>
              </View>

              <View style={styles.taskActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: themeColors.primary }]}
                  onPress={() => handleManualRun(item)}>
                  <PlayCircle color="#fff" size={16} />
                  <Text style={styles.actionText}>Run Now</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: themeColors.error }]}
                  onPress={() => handleDeleteTask(item.id, item.name)}>
                  <Trash2 color="#fff" size={16} />
                  <Text style={styles.actionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              No scheduled tasks yet. Create one to get started.
            </Text>
          }
        />
      )}
    </View>
  );

  const renderCreateTab = () => (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Task Name *</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: themeColors.surface,
              color: themeColors.text,
              borderColor: themeColors.border,
            },
          ]}
          value={taskName}
          onChangeText={setTaskName}
          placeholder="Daily Report Generation"
          placeholderTextColor={themeColors.textTertiary}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Description</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: themeColors.surface,
              color: themeColors.text,
              borderColor: themeColors.border,
            },
          ]}
          value={taskDescription}
          onChangeText={setTaskDescription}
          placeholder="Optional description"
          placeholderTextColor={themeColors.textTertiary}
          multiline
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Select Agent *</Text>
        <View style={styles.selectionGrid}>
          {agents.map((agent: any) => (
            <TouchableOpacity
              key={agent.id}
              style={[
                styles.selectionCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor:
                    selectedAgent?.id === agent.id ? themeColors.primary : themeColors.border,
                  borderWidth: 2,
                },
              ]}
              onPress={() => setSelectedAgent(agent)}>
              <Text style={[styles.selectionText, { color: themeColors.text }]}>{agent.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Select Model *</Text>
        <View style={styles.selectionGrid}>
          {models.map((model: any) => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.selectionCard,
                {
                  backgroundColor: themeColors.surface,
                  borderColor:
                    selectedModel?.id === model.id ? themeColors.primary : themeColors.border,
                  borderWidth: 2,
                },
              ]}
              onPress={() => setSelectedModel(model)}>
              <Text style={[styles.selectionText, { color: themeColors.text }]}>{model.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Task Input *</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: themeColors.surface,
              color: themeColors.text,
              borderColor: themeColors.border,
            },
          ]}
          value={taskInput}
          onChangeText={setTaskInput}
          placeholder="What should the agent do?"
          placeholderTextColor={themeColors.textTertiary}
          multiline
          numberOfLines={4}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Schedule Type *</Text>
        {SCHEDULE_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.scheduleCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: scheduleType.id === type.id ? themeColors.primary : themeColors.border,
                borderWidth: 2,
              },
            ]}
            onPress={() => setScheduleType(type)}>
            <Text style={styles.scheduleIcon}>{type.icon}</Text>
            <View style={styles.scheduleInfo}>
              <Text style={[styles.scheduleName, { color: themeColors.text }]}>{type.name}</Text>
              <Text style={[styles.scheduleDescription, { color: themeColors.textTertiary }]}>
                {type.description}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Schedule Config */}
      {scheduleType.id === 'interval' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Interval (minutes)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: themeColors.surface,
                color: themeColors.text,
                borderColor: themeColors.border,
              },
            ]}
            value={intervalMinutes}
            onChangeText={setIntervalMinutes}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor={themeColors.textTertiary}
          />
        </View>
      )}

      {(scheduleType.id === 'daily' || scheduleType.id === 'weekly' || scheduleType.id === 'monthly') && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Time of Day (HH:MM)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: themeColors.surface,
                color: themeColors.text,
                borderColor: themeColors.border,
              },
            ]}
            value={timeOfDay}
            onChangeText={setTimeOfDay}
            placeholder="09:00"
            placeholderTextColor={themeColors.textTertiary}
          />
        </View>
      )}

      {scheduleType.id === 'weekly' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Day of Week (0-6, 0=Sunday)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: themeColors.surface,
                color: themeColors.text,
                borderColor: themeColors.border,
              },
            ]}
            value={dayOfWeek}
            onChangeText={setDayOfWeek}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor={themeColors.textTertiary}
          />
        </View>
      )}

      {scheduleType.id === 'monthly' && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
            Day of Month (1-31)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: themeColors.surface,
                color: themeColors.text,
                borderColor: themeColors.border,
              },
            ]}
            value={dayOfMonth}
            onChangeText={setDayOfMonth}
            keyboardType="numeric"
            placeholder="1"
            placeholderTextColor={themeColors.textTertiary}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          Max Runs (optional)
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: themeColors.surface,
              color: themeColors.text,
              borderColor: themeColors.border,
            },
          ]}
          value={maxRuns}
          onChangeText={setMaxRuns}
          keyboardType="numeric"
          placeholder="Leave empty for unlimited"
          placeholderTextColor={themeColors.textTertiary}
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: themeColors.primary },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleCreateTask}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Plus color="#fff" size={20} />
              <Text style={styles.buttonText}>Create Task</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHistoryTab = () => (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {scheduledTasks.length === 0 ? (
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          No scheduled tasks available. Create a task first.
        </Text>
      ) : (
        <>
          <View style={[styles.taskSelector, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.selectorLabel, { color: themeColors.text }]}>Select Task:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {scheduledTasks.map((task) => (
                <TouchableOpacity
                  key={task.id}
                  style={[
                    styles.taskSelectorButton,
                    {
                      backgroundColor:
                        selectedExecution?.scheduled_task_id === task.id
                          ? themeColors.primary
                          : themeColors.background,
                    },
                  ]}
                  onPress={() => {
                    setSelectedExecution({ scheduled_task_id: task.id });
                    loadTaskExecutions(task.id);
                  }}>
                  <Text
                    style={[
                      styles.taskSelectorText,
                      {
                        color:
                          selectedExecution?.scheduled_task_id === task.id
                            ? '#fff'
                            : themeColors.text,
                      },
                    ]}>
                    {task.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={themeColors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={taskExecutions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={[styles.executionCard, { backgroundColor: themeColors.surface }]}>
                  <View style={styles.executionHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            item.status === 'completed'
                              ? themeColors.success
                              : item.status === 'failed'
                              ? themeColors.error
                              : themeColors.warning,
                        },
                      ]}>
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                    <Text style={[styles.executionDate, { color: themeColors.textSecondary }]}>
                      {new Date(item.started_at).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.executionDetails}>
                    <Text style={[styles.executionLabel, { color: themeColors.textSecondary }]}>
                      Duration: {(item.duration / 1000).toFixed(1)}s
                    </Text>
                    <Text style={[styles.executionLabel, { color: themeColors.textSecondary }]}>
                      Steps: {item.steps_count}
                    </Text>
                  </View>

                  {item.output && (
                    <>
                      <Text style={[styles.outputTitle, { color: themeColors.text }]}>Output:</Text>
                      <Text
                        style={[styles.outputText, { color: themeColors.textSecondary }]}
                        numberOfLines={3}>
                        {item.output}
                      </Text>
                    </>
                  )}

                  {item.error && (
                    <>
                      <Text style={[styles.outputTitle, { color: themeColors.error }]}>Error:</Text>
                      <Text style={[styles.errorText, { color: themeColors.error }]}>
                        {item.error}
                      </Text>
                    </>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                  No execution history for this task.
                </Text>
              }
            />
          )}
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      {/* Tab Navigation */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, tab === 'tasks' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('tasks')}>
          <Calendar color={tab === 'tasks' ? themeColors.primary : themeColors.textSecondary} size={20} />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'tasks' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            Tasks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'create' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('create')}>
          <Plus color={tab === 'create' ? themeColors.primary : themeColors.textSecondary} size={20} />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'create' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            Create
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && { borderBottomColor: themeColors.primary }]}
          onPress={() => setTab('history')}>
          <Clock color={tab === 'history' ? themeColors.primary : themeColors.textSecondary} size={20} />
          <Text
            style={[
              styles.tabText,
              { color: tab === 'history' ? themeColors.primary : themeColors.textSecondary },
            ]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {tab === 'tasks' && renderTasksTab()}
      {tab === 'create' && renderCreateTab()}
      {tab === 'history' && renderHistoryTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: spacing.xs,
  },
  tabText: {
    ...typography.body,
    fontWeight: '600',
  },
  section: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  input: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    ...typography.body,
  },
  selectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectionCard: {
    padding: spacing.md,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  selectionText: {
    ...typography.body,
    fontWeight: '600',
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  scheduleIcon: {
    fontSize: 32,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleName: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  scheduleDescription: {
    ...typography.small,
  },
  buttonContainer: {
    padding: spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 8,
    gap: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    ...typography.body,
    fontWeight: '600',
  },
  loader: {
    marginTop: spacing.xl,
  },
  taskCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 8,
  },
  taskHeader: {
    marginBottom: spacing.md,
  },
  taskTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  taskName: {
    ...typography.h4,
    flex: 1,
  },
  taskDescription: {
    ...typography.small,
  },
  taskDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.small,
  },
  runCount: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  taskActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  actionText: {
    color: '#fff',
    ...typography.small,
    fontWeight: '600',
  },
  taskSelector: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectorLabel: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  taskSelectorButton: {
    padding: spacing.sm,
    borderRadius: 8,
    marginRight: spacing.sm,
  },
  taskSelectorText: {
    ...typography.small,
    fontWeight: '600',
  },
  executionCard: {
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 8,
  },
  executionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  executionDate: {
    ...typography.small,
  },
  executionDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  executionLabel: {
    ...typography.small,
  },
  outputTitle: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  outputText: {
    ...typography.small,
  },
  errorText: {
    ...typography.small,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
