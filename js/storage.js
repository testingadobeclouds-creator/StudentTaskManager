const STORAGE_KEY = 'student-task-manager-tasks';
const THEME_KEY = 'student-task-manager-theme';
const SAMPLE_DATA_KEY = 'student-task-manager-sample-loaded';

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getCurrentTimestamp() {
    return new Date().toISOString();
}

function createTaskObject(data) {
    const now = getCurrentTimestamp();
    return {
        id: data.id || generateId(),
        title: data.title?.trim() || '',
        description: data.description?.trim() || '',
        subject: data.subject?.trim() || '',
        dueDate: data.dueDate || '',
        priority: data.priority || 'medium',
        status: data.status || 'pending',
        createdAt: data.createdAt || now,
        updatedAt: now
    };
}

function validateTask(task) {
    const errors = {};
    if (!task.title || task.title.length === 0) {
        errors.title = 'Task title is required';
    } else if (task.title.length > 100) {
        errors.title = 'Title must be 100 characters or less';
    }
    if (!task.subject || task.subject.length === 0) {
        errors.subject = 'Subject is required';
    } else if (task.subject.length > 50) {
        errors.subject = 'Subject must be 50 characters or less';
    }
    if (!task.dueDate) {
        errors.dueDate = 'Due date is required';
    } else {
        const due = new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(due.getTime())) {
            errors.dueDate = 'Invalid date format';
        }
    }
    if (!['low', 'medium', 'high'].includes(task.priority)) {
        errors.priority = 'Invalid priority';
    }
    if (!['pending', 'in-progress', 'completed'].includes(task.status)) {
        errors.status = 'Invalid status';
    }
    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

function loadTasks() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(task => ({
            ...task,
            id: String(task.id),
            title: String(task.title || ''),
            description: String(task.description || ''),
            subject: String(task.subject || ''),
            dueDate: String(task.dueDate || ''),
            priority: String(task.priority || 'medium'),
            status: String(task.status || 'pending'),
            createdAt: String(task.createdAt || getCurrentTimestamp()),
            updatedAt: String(task.updatedAt || getCurrentTimestamp())
        })).filter(task => task.id && task.title);
    } catch (e) {
        console.error('Failed to load tasks from storage:', e);
        return [];
    }
}

function saveTasks(tasks) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        return true;
    } catch (e) {
        console.error('Failed to save tasks to storage:', e);
        return false;
    }
}

function addTask(taskData) {
    const tasks = loadTasks();
    const task = createTaskObject(taskData);
    const validation = validateTask(task);
    if (!validation.isValid) {
        return { success: false, errors: validation.errors };
    }
    tasks.unshift(task);
    const saved = saveTasks(tasks);
    return saved ? { success: true, task } : { success: false, errors: { general: 'Failed to save task' } };
}

function getTask(id) {
    const tasks = loadTasks();
    return tasks.find(task => task.id === id) || null;
}

function updateTask(id, updates) {
    const tasks = loadTasks();
    const index = tasks.findIndex(task => task.id === id);
    if (index === -1) {
        return { success: false, errors: { general: 'Task not found' } };
    }
    const updatedTask = createTaskObject({ ...tasks[index], ...updates });
    const validation = validateTask(updatedTask);
    if (!validation.isValid) {
        return { success: false, errors: validation.errors };
    }
    tasks[index] = updatedTask;
    const saved = saveTasks(tasks);
    return saved ? { success: true, task: updatedTask } : { success: false, errors: { general: 'Failed to update task' } };
}

function deleteTask(id) {
    const tasks = loadTasks();
    const filtered = tasks.filter(task => task.id !== id);
    if (filtered.length === tasks.length) {
        return { success: false, errors: { general: 'Task not found' } };
    }
    const saved = saveTasks(filtered);
    return saved ? { success: true } : { success: false, errors: { general: 'Failed to delete task' } };
}

function toggleTaskStatus(id) {
    const task = getTask(id);
    if (!task) {
        return { success: false, errors: { general: 'Task not found' } };
    }
    const statusOrder = ['pending', 'in-progress', 'completed'];
    const currentIndex = statusOrder.indexOf(task.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    return updateTask(id, { status: nextStatus });
}

function clearAllTasks() {
    return saveTasks([]);
}

function exportTasks() {
    const tasks = loadTasks();
    const data = {
        exportDate: getCurrentTimestamp(),
        version: '1.0',
        tasks
    };
    return JSON.stringify(data, null, 2);
}

function importTasks(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        const taskList = Array.isArray(data) ? data : (data && Array.isArray(data.tasks) ? data.tasks : null);
        if (!taskList) {
            return { success: false, errors: { general: 'Invalid import format. Expected JSON array or { tasks: [] }' } };
        }
        const validTasks = taskList
            .map(task => createTaskObject(task))
            .filter(task => validateTask(task).isValid);
        if (validTasks.length === 0) {
            return { success: false, errors: { general: 'No valid tasks found in imported data' } };
        }
        const saved = saveTasks(validTasks);
        return saved ? { success: true, count: validTasks.length } : { success: false, errors: { general: 'Failed to save imported tasks' } };
    } catch (e) {
        return { success: false, errors: { general: 'Invalid JSON format' } };
    }
}

function loadTheme() {
    try {
        return localStorage.getItem(THEME_KEY);
    } catch {
        return null;
    }
}

function saveTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
        return true;
    } catch {
        return false;
    }
}

function isSampleDataLoaded() {
    try {
        return localStorage.getItem(SAMPLE_DATA_KEY) === 'true';
    } catch {
        return false;
    }
}

function setSampleDataLoaded(value) {
    try {
        localStorage.setItem(SAMPLE_DATA_KEY, value ? 'true' : 'false');
        return true;
    } catch {
        return false;
    }
}

function loadSampleData(force = false) {
    if (!force && isSampleDataLoaded()) return { success: true, skipped: true };
    const sampleTasks = [
        {
            title: 'Complete Operating System Assignment',
            description: 'Finish the process scheduling simulation and memory management questions',
            subject: 'Operating Systems',
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'high',
            status: 'pending'
        },
        {
            title: 'Prepare Software Engineering Presentation',
            description: 'Create slides for the agile methodology presentation on Friday',
            subject: 'Software Engineering',
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'medium',
            status: 'in-progress'
        },
        {
            title: 'Submit Computer Network Practical',
            description: 'Complete the socket programming lab report and submit before deadline',
            subject: 'Computer Networks',
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'high',
            status: 'pending'
        },
        {
            title: 'Study for Sessional Examination',
            description: 'Review chapters 1-5 for the upcoming mid-term exam',
            subject: 'Database Management',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'medium',
            status: 'pending'
        },
        {
            title: 'Complete Web Development Project',
            description: 'Finish the task manager application for internship submission',
            subject: 'Web Development',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            priority: 'high',
            status: 'completed'
        }
    ];
    const tasks = sampleTasks.map(t => createTaskObject(t));
    const saved = saveTasks(tasks);
    if (saved) {
        setSampleDataLoaded(true);
        return { success: true, count: tasks.length };
    }
    return { success: false, errors: { general: 'Failed to load sample data' } };
}

export const Storage = {
    loadTasks,
    saveTasks,
    addTask,
    getTask,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    clearAllTasks,
    exportTasks,
    importTasks,
    loadTheme,
    saveTheme,
    loadSampleData,
    isSampleDataLoaded,
    setSampleDataLoaded,
    validateTask,
    generateId,
    getCurrentTimestamp
};