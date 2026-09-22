import { Storage } from './storage.js';
import { Tasks } from './tasks.js';
import { UI } from './ui.js';
import { Auth } from './auth.js';

let currentFilters = {
    search: '',
    status: 'all',
    priority: 'all'
};
let currentSort = 'recent';
let editingTaskId = null;
let allTasks = [];

// Quotes collection for the dashboard greeting
const STUDENT_QUOTES = [
    { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" }
];
let currentQuoteIndex = 0;

// Pomodoro Timer State
const POMO_STORAGE_KEY = 'student-task-manager-pomo-durations';
const POMO_DEFAULT_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

function loadPomoDurations() {
    try {
        const saved = localStorage.getItem(POMO_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            return {
                focus: Math.max(1, Math.min(120, parseInt(parsed.focus) || 25)) * 60,
                short: Math.max(1, Math.min(60,  parseInt(parsed.short) || 5))  * 60,
                long:  Math.max(1, Math.min(120, parseInt(parsed.long)  || 15)) * 60
            };
        }
    } catch (e) { /* ignore */ }
    return { ...POMO_DEFAULT_DURATIONS };
}

function savePomoDurations(durationObj) {
    try {
        // store in minutes for readability
        localStorage.setItem(POMO_STORAGE_KEY, JSON.stringify({
            focus: Math.round(durationObj.focus / 60),
            short: Math.round(durationObj.short / 60),
            long:  Math.round(durationObj.long  / 60)
        }));
    } catch (e) { /* ignore */ }
}

let POMO_DURATIONS = loadPomoDurations();
let pomoMode = 'focus';
let pomoTimeRemaining = POMO_DURATIONS.focus;
let pomoInterval = null;
let pomoIsRunning = false;
let pomoCompletedCycles = parseInt(localStorage.getItem('student-task-manager-pomo-cycles') || '0', 10);

// Semester Milestones & Goals State
const GOALS_STORAGE_KEY = 'student-task-manager-semester-goals';
const DEFAULT_GOALS = [
    { id: 'goal-1', text: 'Operating Systems practical simulation file', completed: true },
    { id: 'goal-2', text: 'DBMS normalization & SQL query practical', completed: true },
    { id: 'goal-3', text: 'Computer Networks socket lab assignment 3', completed: false },
    { id: 'goal-4', text: 'Software Engineering internal viva & PPT', completed: false }
];
let semesterGoals = loadSemesterGoals();

// Scratchpad Storage Key
const SCRATCHPAD_KEY = 'student-task-manager-scratchpad';

let taskListContainer = null;
let emptyState = null;
let taskForm = null;
let searchInput = null;
let statusFilter = null;
let priorityFilter = null;
let sortSelect = null;

function initDOMElements() {
    taskListContainer = document.getElementById('task-list');
    emptyState = document.getElementById('empty-state');
    taskForm = document.getElementById('task-form');
    searchInput = document.getElementById('search-input');
    statusFilter = document.getElementById('status-filter');
    priorityFilter = document.getElementById('priority-filter');
    sortSelect = document.getElementById('sort-select');
}

function loadSemesterGoals() {
    try {
        const saved = localStorage.getItem(GOALS_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) {
        console.warn('Error reading semester goals:', e);
    }
    return [...DEFAULT_GOALS];
}

function saveSemesterGoals() {
    try {
        localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(semesterGoals));
    } catch (e) {
        console.warn('Error saving semester goals:', e);
    }
}

function loadAndRenderTasks() {
    allTasks = Storage.loadTasks();
    applyFiltersAndRender();
    updateDashboard();
}

function applyFiltersAndRender() {
    let filtered = Tasks.filterTasks(allTasks, currentFilters);
    filtered = Tasks.sortTasks(filtered, currentSort);
    UI.renderTaskList(filtered, taskListContainer);
    UI.showEmptyState(taskListContainer, emptyState, filtered.length === 0);
}

function updateHeroPreview(stats, tasks) {
    const pendingCount = document.getElementById('preview-pending-count');
    const completedCount = document.getElementById('preview-completed-count');
    if (pendingCount) pendingCount.textContent = stats.pending;
    if (completedCount) completedCount.textContent = stats.completed;
}

function updateDashboard() {
    const stats = Tasks.getTaskStatistics(allTasks);
    const user = Auth.getCurrentUser();
    
    // 1. Metric Stats Cards
    UI.updateStatistics(stats);

    // 2. Greeting Banner with Completion Rate
    UI.renderDashboardGreeting(user, stats);

    // 3. Weekly Productivity Chart & Study Streak
    const streak = Tasks.getStudyStreak(allTasks);
    UI.renderWeeklyChart(Tasks.getWeeklyProductivity(allTasks), streak);

    // 4. Urgent & Upcoming Deadlines
    const deadlinesContainer = document.getElementById('upcoming-deadlines-list');
    UI.renderUpcomingDeadlines(Tasks.getUpcomingDeadlines(allTasks, 6), deadlinesContainer);

    // 5. Subject Progress Breakdown
    const subjectContainer = document.getElementById('subject-progress-list');
    UI.renderSubjectBreakdown(Tasks.getSubjectBreakdown(allTasks), subjectContainer);

    // 6. Priority Distribution
    UI.renderPriorityDistribution(Tasks.getPriorityDistribution(allTasks));

    // 7. Recent Activity Timeline
    const timelineContainer = document.getElementById('activity-timeline');
    UI.renderRecentActivities(Tasks.getRecentActivities(allTasks, 5), timelineContainer);

    // 8. Today's Time Slots
    const timeSlotsContainer = document.getElementById('time-slots-container');
    UI.renderTodayTimeSlots(Tasks.getTodayTimeSlots(allTasks), timeSlotsContainer);

    // 9. Semester Goals & Milestones
    const goalsContainer = document.getElementById('milestone-checklist');
    UI.renderSemesterGoals(semesterGoals, goalsContainer);

    // 10. Pomodoro Timer
    UI.renderPomodoro(pomoTimeRemaining, POMO_DURATIONS[pomoMode], pomoMode, pomoIsRunning, pomoCompletedCycles);

    // 11. Hero Preview Stats
    updateHeroPreview(stats, allTasks);
}

// --------------------------------------------------------------------------
// Task Operations
// --------------------------------------------------------------------------

function handleAddTask(formData) {
    const result = Storage.addTask(formData);
    if (result.success) {
        allTasks = Storage.loadTasks();
        applyFiltersAndRender();
        updateDashboard();
        UI.showToast('Task created successfully', 'success');
        UI.setActiveSection('tasks');
        return true;
    } else {
        UI.showFormErrors(taskForm, result.errors);
        UI.showToast('Please fix the errors above', 'error');
        return false;
    }
}

function handleEditTask(formData) {
    if (!editingTaskId) return false;
    const result = Storage.updateTask(editingTaskId, formData);
    if (result.success) {
        allTasks = Storage.loadTasks();
        applyFiltersAndRender();
        updateDashboard();
        UI.showToast('Task updated successfully', 'success');
        editingTaskId = null;
        updateSubmitButton();
        UI.setActiveSection('tasks');
        return true;
    } else {
        UI.showFormErrors(taskForm, result.errors);
        UI.showToast('Please fix the errors above', 'error');
        return false;
    }
}

function handleDeleteTask(id) {
    UI.showConfirmDialog('Are you sure you want to delete this task? This action cannot be undone.', () => {
        const result = Storage.deleteTask(id);
        if (result.success) {
            allTasks = Storage.loadTasks();
            applyFiltersAndRender();
            updateDashboard();
            UI.showToast('Task deleted', 'success');
        } else {
            UI.showToast('Failed to delete task', 'error');
        }
    });
}

function handleToggleStatus(id) {
    const result = Storage.toggleTaskStatus(id);
    if (result.success) {
        allTasks = Storage.loadTasks();
        applyFiltersAndRender();
        updateDashboard();
        const task = result.task;
        const statusLabel = Tasks.getStatusLabel(task.status);
        UI.showToast(`Task marked as ${statusLabel}`, 'success');
    } else {
        UI.showToast('Failed to update task status', 'error');
    }
}

function handleEditClick(id) {
    const task = allTasks.find(t => t.id === id);
    if (!task) return;
    editingTaskId = id;
    UI.populateForm(taskForm, task);
    updateSubmitButton();
    UI.setActiveSection('add-task');
    taskForm.querySelector('[name="title"]').focus();
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submit-task');
    if (!submitBtn) return;
    if (editingTaskId) {
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Update Task</span>
        `;
    } else {
        submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span>Save Task</span>
        `;
    }
}

function getFormData() {
    const formData = new FormData(taskForm);
    return {
        title: formData.get('title'),
        description: formData.get('description'),
        subject: formData.get('subject'),
        dueDate: formData.get('dueDate'),
        priority: formData.get('priority'),
        status: formData.get('status')
    };
}

function setMinDueDate() {
    const today = new Date().toISOString().split('T')[0];
    const dueDateInput = document.getElementById('task-due-date');
    if (dueDateInput) {
        dueDateInput.min = today;
    }
    const quickDateInput = document.getElementById('quick-task-date');
    if (quickDateInput) {
        quickDateInput.min = today;
        quickDateInput.value = today;
    }
}

// --------------------------------------------------------------------------
// Pomodoro Timer Controls
// --------------------------------------------------------------------------

function startPomodoro() {
    if (pomoIsRunning) return;
    pomoIsRunning = true;
    UI.renderPomodoro(pomoTimeRemaining, POMO_DURATIONS[pomoMode], pomoMode, pomoIsRunning, pomoCompletedCycles);
    
    pomoInterval = setInterval(() => {
        pomoTimeRemaining--;
        if (pomoTimeRemaining <= 0) {
            clearInterval(pomoInterval);
            pomoInterval = null;
            pomoIsRunning = false;
            
            if (pomoMode === 'focus') {
                pomoCompletedCycles++;
                localStorage.setItem('student-task-manager-pomo-cycles', pomoCompletedCycles.toString());
                UI.showToast('🎉 Focus Session Completed! Take a well-earned break.', 'success', 6000);
                pomoMode = pomoCompletedCycles % 4 === 0 ? 'long' : 'short';
            } else {
                UI.showToast('⚡ Break is over! Ready for the next focus session?', 'info', 6000);
                pomoMode = 'focus';
            }
            pomoTimeRemaining = POMO_DURATIONS[pomoMode];
        }
        UI.renderPomodoro(pomoTimeRemaining, POMO_DURATIONS[pomoMode], pomoMode, pomoIsRunning, pomoCompletedCycles);
    }, 1000);
}

function pausePomodoro() {
    if (!pomoIsRunning) return;
    clearInterval(pomoInterval);
    pomoInterval = null;
    pomoIsRunning = false;
    UI.renderPomodoro(pomoTimeRemaining, POMO_DURATIONS[pomoMode], pomoMode, pomoIsRunning, pomoCompletedCycles);
}

function togglePomodoro() {
    if (pomoIsRunning) {
        pausePomodoro();
    } else {
        startPomodoro();
    }
}

function resetPomodoro() {
    pausePomodoro();
    pomoTimeRemaining = POMO_DURATIONS[pomoMode];
    UI.renderPomodoro(pomoTimeRemaining, POMO_DURATIONS[pomoMode], pomoMode, pomoIsRunning, pomoCompletedCycles);
}

function setPomodoroMode(mode) {
    if (!POMO_DURATIONS[mode]) return;
    pausePomodoro();
    pomoMode = mode;
    pomoTimeRemaining = POMO_DURATIONS[mode];
    UI.renderPomodoro(pomoTimeRemaining, POMO_DURATIONS[pomoMode], pomoMode, pomoIsRunning, pomoCompletedCycles);
}

// --------------------------------------------------------------------------
// Scratchpad Auto-Save
// --------------------------------------------------------------------------

function initScratchpad() {
    const textarea = document.getElementById('scratchpad-input');
    const countEl = document.getElementById('scratchpad-count');
    const copyBtn = document.getElementById('scratchpad-copy-btn');
    const clearBtn = document.getElementById('scratchpad-clear-btn');
    const statusEl = document.getElementById('scratchpad-status');

    if (!textarea) return;

    const saved = localStorage.getItem(SCRATCHPAD_KEY) || '';
    textarea.value = saved;
    if (countEl) countEl.textContent = `${saved.length} characters`;

    let timeout = null;
    textarea.addEventListener('input', (e) => {
        const val = e.target.value;
        if (countEl) countEl.textContent = `${val.length} characters`;
        if (statusEl) statusEl.textContent = 'Saving...';
        
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            localStorage.setItem(SCRATCHPAD_KEY, val);
            if (statusEl) statusEl.textContent = '✓ Auto-saved locally';
        }, 300);
    });

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            if (!textarea.value.trim()) {
                UI.showToast('Scratchpad is empty', 'info');
                return;
            }
            navigator.clipboard.writeText(textarea.value).then(() => {
                UI.showToast('Notes copied to clipboard!', 'success');
            }).catch(() => {
                UI.showToast('Failed to copy to clipboard', 'error');
            });
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (!textarea.value.trim()) return;
            UI.showConfirmDialog('Clear all scratchpad notes?', () => {
                textarea.value = '';
                localStorage.removeItem(SCRATCHPAD_KEY);
                if (countEl) countEl.textContent = '0 characters';
                if (statusEl) statusEl.textContent = 'Cleared';
                UI.showToast('Scratchpad cleared', 'info');
            });
        });
    }
}

// --------------------------------------------------------------------------
// Pomodoro Settings Panel
// --------------------------------------------------------------------------

function updatePomodoroTabLabels() {
    const focusMin = Math.round(POMO_DURATIONS.focus / 60);
    const shortMin = Math.round(POMO_DURATIONS.short / 60);
    const longMin  = Math.round(POMO_DURATIONS.long  / 60);

    const focusBtn = document.getElementById('pomo-mode-focus');
    const shortBtn = document.getElementById('pomo-mode-short');
    const longBtn  = document.getElementById('pomo-mode-long');
    if (focusBtn) focusBtn.textContent = `Focus (${focusMin}m)`;
    if (shortBtn) shortBtn.textContent = `Short Break (${shortMin}m)`;
    if (longBtn)  longBtn.textContent  = `Long Break (${longMin}m)`;
}

function initPomodoroSettings() {
    const toggleBtn  = document.getElementById('pomo-settings-toggle');
    const panel      = document.getElementById('pomo-settings-panel');
    const saveBtn    = document.getElementById('pomo-settings-save');
    const resetBtn   = document.getElementById('pomo-settings-reset-defaults');
    const inputFocus = document.getElementById('pomo-input-focus');
    const inputShort = document.getElementById('pomo-input-short');
    const inputLong  = document.getElementById('pomo-input-long');

    if (!toggleBtn || !panel) return;

    // Populate inputs with current durations on first load
    function syncInputsToCurrent() {
        if (inputFocus) inputFocus.value = Math.round(POMO_DURATIONS.focus / 60);
        if (inputShort) inputShort.value = Math.round(POMO_DURATIONS.short / 60);
        if (inputLong)  inputLong.value  = Math.round(POMO_DURATIONS.long  / 60);
    }

    // Toggle panel open / close
    toggleBtn.addEventListener('click', () => {
        const isOpen = !panel.hidden;
        panel.hidden = isOpen;
        toggleBtn.setAttribute('aria-expanded', !isOpen);
        if (!isOpen) syncInputsToCurrent(); // refresh inputs when opening
    });

    // Save & Apply
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const focusVal = parseInt(inputFocus?.value, 10);
            const shortVal = parseInt(inputShort?.value, 10);
            const longVal  = parseInt(inputLong?.value,  10);

            if (isNaN(focusVal) || focusVal < 1 || focusVal > 120 ||
                isNaN(shortVal) || shortVal < 1 || shortVal > 60  ||
                isNaN(longVal)  || longVal  < 1 || longVal  > 120) {
                UI.showToast('Please enter valid durations (Focus: 1–120m, Breaks: 1–60m / 1–120m)', 'warning', 5000);
                return;
            }

            // Stop any running timer before changing durations
            if (pomoIsRunning) pausePomodoro();

            // Apply new durations
            POMO_DURATIONS.focus = focusVal * 60;
            POMO_DURATIONS.short = shortVal * 60;
            POMO_DURATIONS.long  = longVal  * 60;

            // Persist to localStorage
            savePomoDurations(POMO_DURATIONS);

            // Reset current timer to new duration for the active mode
            pomoTimeRemaining = POMO_DURATIONS[pomoMode];
            UI.renderPomodoro(pomoTimeRemaining, POMO_DURATIONS[pomoMode], pomoMode, pomoIsRunning, pomoCompletedCycles);

            // Update mode-tab button labels
            updatePomodoroTabLabels();

            // Close the panel
            panel.hidden = true;
            toggleBtn.setAttribute('aria-expanded', 'false');

            UI.showToast(`Timer updated! Focus: ${focusVal}m • Short: ${shortVal}m • Long: ${longVal}m`, 'success', 4000);
        });
    }

    // Reset to defaults
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (pomoIsRunning) pausePomodoro();

            POMO_DURATIONS.focus = POMO_DEFAULT_DURATIONS.focus;
            POMO_DURATIONS.short = POMO_DEFAULT_DURATIONS.short;
            POMO_DURATIONS.long  = POMO_DEFAULT_DURATIONS.long;

            localStorage.removeItem(POMO_STORAGE_KEY);

            pomoTimeRemaining = POMO_DURATIONS[pomoMode];
            UI.renderPomodoro(pomoTimeRemaining, POMO_DURATIONS[pomoMode], pomoMode, pomoIsRunning, pomoCompletedCycles);

            updatePomodoroTabLabels();
            syncInputsToCurrent();

            UI.showToast('Timer reset to defaults (25 / 5 / 15 min)', 'info');
        });
    }

    // Apply saved labels on init
    updatePomodoroTabLabels();
}

// --------------------------------------------------------------------------
// Quotes Cycle
// --------------------------------------------------------------------------


function cycleMotivationalQuote() {
    currentQuoteIndex = (currentQuoteIndex + 1) % STUDENT_QUOTES.length;
    const q = STUDENT_QUOTES[currentQuoteIndex];
    const quoteEl = document.getElementById('greeting-quote');
    if (quoteEl) {
        quoteEl.textContent = `"${q.text}" — ${q.author}`;
    }
}

// --------------------------------------------------------------------------
// Event Listeners Wiring
// --------------------------------------------------------------------------

function initEventListeners() {
    // Navigation routing
    // Navigation routing for all nav links, dashboard quick links, and section targets
    document.querySelectorAll('.nav-link, .dash-card-link, [data-section]').forEach(link => {
        link.addEventListener('click', (e) => {
            const section = link.dataset.section;
            if (!section) return;
            e.preventDefault();
            if (section === 'add-task' && editingTaskId) {
                editingTaskId = null;
                if (taskForm) UI.resetForm(taskForm);
                updateSubmitButton();
            }
            UI.setActiveSection(section);
            window.location.hash = section;
        });
    });

    // Mobile nav toggle
    const navToggle = document.getElementById('nav-toggle') || document.querySelector('.nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            const isOpen = navMenu.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', isOpen);
        });
    }

    // Theme toggles (both header and landing page)
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.addEventListener('click', UI.toggleTheme);
    });

    // Interactive Stat Cards (Quick Filter & Navigate)
    document.querySelectorAll('.stat-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const stat = card.dataset.stat;
            currentFilters.search = '';
            currentFilters.status = 'all';
            currentFilters.priority = 'all';

            if (stat === 'pending') {
                currentFilters.status = 'pending';
            } else if (stat === 'in-progress') {
                currentFilters.status = 'in-progress';
            } else if (stat === 'completed') {
                currentFilters.status = 'completed';
            } else if (stat === 'high-priority') {
                currentFilters.priority = 'high';
            } else if (stat === 'today' || stat === 'upcoming' || stat === 'overdue') {
                currentFilters.status = 'pending';
                currentSort = 'due-date-asc';
            }

            if (statusFilter) statusFilter.value = currentFilters.status;
            if (priorityFilter) priorityFilter.value = currentFilters.priority;
            if (sortSelect) sortSelect.value = currentSort;
            if (searchInput) searchInput.value = '';

            applyFiltersAndRender();
            UI.setActiveSection('tasks');
            window.location.hash = 'tasks';
            UI.showToast(`Filtered tasks by ${stat.replace('-', ' ')}`, 'info');
        });
    });

    // Landing Page Buttons
    const landingGetStarted = document.getElementById('landing-get-started');
    if (landingGetStarted) {
        landingGetStarted.addEventListener('click', () => {
            const user = Auth.getCurrentUser();
            if (user) {
                UI.setActiveSection('dashboard');
                window.location.hash = 'dashboard';
            } else {
                UI.showAuthModal('signup');
            }
        });
    }

    const landingExploreDash = document.getElementById('landing-explore-dashboard');
    if (landingExploreDash) {
        landingExploreDash.addEventListener('click', () => {
            let user = Auth.getCurrentUser();
            if (!user) {
                Auth.loginAsGuest();
            }
            UI.setActiveSection('dashboard');
            window.location.hash = 'dashboard';
        });
    }

    const landingGoogleBtn = document.getElementById('landing-google-btn');
    if (landingGoogleBtn) {
        landingGoogleBtn.addEventListener('click', async () => {
            const res = await Auth.loginWithGoogle();
            if (res.success) {
                if (res.note) UI.showToast(res.note, 'info', 5000);
                if (res.user) {
                    UI.showToast(`Signed in as ${res.user.displayName}!`, 'success');
                    UI.setActiveSection('dashboard');
                    window.location.hash = 'dashboard';
                }
                // If user is null, we're in the middle of a redirect — page will reload
            } else {
                UI.showToast(res.message || 'Google sign-in failed', 'error');
            }
        });
    }

    const landingHeroSignin = document.getElementById('landing-hero-signin');
    if (landingHeroSignin) {
        landingHeroSignin.addEventListener('click', () => {
            UI.showAuthModal('login');
        });
    }

    const landingThemeToggle = document.getElementById('landing-theme-toggle');
    if (landingThemeToggle) {
        landingThemeToggle.addEventListener('click', UI.toggleTheme);
    }

    const landingCtaBtn = document.getElementById('landing-cta-btn');
    if (landingCtaBtn) {
        landingCtaBtn.addEventListener('click', () => {
            let user = Auth.getCurrentUser();
            if (!user) {
                Auth.loginAsGuest();
            }
            UI.setActiveSection('dashboard');
            window.location.hash = 'dashboard';
        });
    }

    const landingCtaSignup = document.getElementById('landing-cta-signup');
    if (landingCtaSignup) {
        landingCtaSignup.addEventListener('click', () => {
            UI.showAuthModal('signup');
        });
    }

    // Landing Page Live Mockup Tabs
    document.querySelectorAll('.demo-tab-btn').forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            const tabKey = tabBtn.dataset.previewTab;
            document.querySelectorAll('.demo-tab-btn').forEach(b => b.classList.remove('active'));
            tabBtn.classList.add('active');

            const tabIds = ['tasks', 'analytics', 'timer'];
            tabIds.forEach(id => {
                const el = document.getElementById(`preview-tab-content-${id}`);
                if (el) el.hidden = (id !== tabKey);
            });
        });
    });

    // Header Login Button
    const navLoginBtn = document.getElementById('nav-login-btn');
    if (navLoginBtn) {
        navLoginBtn.addEventListener('click', () => {
            UI.showAuthModal('login');
        });
    }

    // User Avatar & Dropdown Menu
    const userAvatarBtn = document.getElementById('user-avatar-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userAvatarBtn && userDropdown) {
        userAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = userDropdown.hidden;
            userDropdown.hidden = !isHidden;
            userAvatarBtn.setAttribute('aria-expanded', !isHidden);
        });

        document.addEventListener('click', (e) => {
            if (!userDropdown.hidden && !e.target.closest('#user-profile-menu')) {
                userDropdown.hidden = true;
                userAvatarBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Logout Button
    const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
    if (dropdownLogoutBtn) {
        dropdownLogoutBtn.addEventListener('click', async () => {
            await Auth.logout();
            if (userDropdown) userDropdown.hidden = true;
            UI.showToast('Signed out successfully', 'info');
            UI.setActiveSection('landing');
            window.location.hash = 'landing';
        });
    }

    // Auth Modal Controls
    const authCloseBtn = document.getElementById('auth-modal-close');
    if (authCloseBtn) {
        authCloseBtn.addEventListener('click', UI.hideAuthModal);
    }

    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    if (tabLogin) tabLogin.addEventListener('click', () => UI.switchAuthTab('login'));
    if (tabSignup) tabSignup.addEventListener('click', () => UI.switchAuthTab('signup'));

    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const errorEl = document.getElementById('auth-error');
            const submitBtn = document.getElementById('auth-submit-btn');
            const isSignup = tabSignup && tabSignup.classList.contains('active');

            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password').value;
            const name = document.getElementById('auth-name').value.trim();

            if (!email || !password) {
                if (errorEl) errorEl.textContent = 'Please enter both email and password.';
                return;
            }

            if (password.length < 6) {
                if (errorEl) errorEl.textContent = 'Password must be at least 6 characters.';
                return;
            }

            if (errorEl) errorEl.textContent = '';
            submitBtn.disabled = true;

            try {
                let res;
                if (isSignup) {
                    res = await Auth.signupWithEmail(email, password, name);
                } else {
                    res = await Auth.loginWithEmail(email, password);
                }

                if (res.success) {
                    UI.hideAuthModal();
                    authForm.reset();
                    UI.showToast(`Welcome, ${res.user.displayName}!`, 'success');
                    if (res.note) {
                        setTimeout(() => UI.showToast(res.note, 'info', 6000), 1200);
                    }
                    UI.setActiveSection('dashboard');
                    window.location.hash = 'dashboard';
                } else {
                    if (errorEl) errorEl.textContent = res.message || 'Authentication error';
                }
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    const googleLoginBtn = document.getElementById('google-login-btn');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            const res = await Auth.loginWithGoogle();
            if (res.success) {
                UI.hideAuthModal();
                if (res.note) UI.showToast(res.note, 'info', 5000);
                if (res.user) {
                    UI.showToast(`Signed in with Google as ${res.user.displayName}`, 'success');
                    UI.setActiveSection('dashboard');
                    window.location.hash = 'dashboard';
                }
                // If user is null, we're in the middle of a redirect — page will reload
            } else {
                const errorEl = document.getElementById('auth-error');
                if (errorEl) errorEl.textContent = res.message || 'Google sign-in failed';
            }
        });
    }

    const guestLoginBtn = document.getElementById('guest-login-btn');
    if (guestLoginBtn) {
        guestLoginBtn.addEventListener('click', () => {
            const res = Auth.loginAsGuest();
            UI.hideAuthModal();
            UI.showToast('Continuing in offline Guest mode', 'info');
            UI.setActiveSection('dashboard');
            window.location.hash = 'dashboard';
        });
    }

    // Dashboard Banner Actions
    const dashAddBtn = document.getElementById('dashboard-add-task');
    if (dashAddBtn) {
        dashAddBtn.addEventListener('click', () => {
            editingTaskId = null;
            UI.resetForm(taskForm);
            updateSubmitButton();
            UI.setActiveSection('add-task');
            window.location.hash = 'add-task';
        });
    }

    const focusModeBtn = document.getElementById('dashboard-focus-mode');
    if (focusModeBtn) {
        focusModeBtn.addEventListener('click', () => {
            const pomoCard = document.getElementById('pomodoro-card');
            if (pomoCard) {
                pomoCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                pomoCard.style.outline = '2px solid var(--color-primary)';
                setTimeout(() => { pomoCard.style.outline = 'none'; }, 1500);
            }
        });
    }

    const quoteRefreshBtn = document.getElementById('quote-refresh-btn');
    if (quoteRefreshBtn) {
        quoteRefreshBtn.addEventListener('click', cycleMotivationalQuote);
    }

    // Quick Add Task Form
    const quickAddForm = document.getElementById('quick-add-form');
    if (quickAddForm) {
        quickAddForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('quick-task-title');
            const subjectInput = document.getElementById('quick-task-subject');
            const dateInput = document.getElementById('quick-task-date');
            const priorityInput = document.getElementById('quick-task-priority');

            if (!titleInput.value.trim() || !subjectInput.value.trim() || !dateInput.value) {
                UI.showToast('Please fill title, subject, and date', 'warning');
                return;
            }

            const formData = {
                title: titleInput.value.trim(),
                description: '',
                subject: subjectInput.value.trim(),
                dueDate: dateInput.value,
                priority: priorityInput.value || 'medium',
                status: 'pending'
            };

            const result = Storage.addTask(formData);
            if (result.success) {
                allTasks = Storage.loadTasks();
                applyFiltersAndRender();
                updateDashboard();
                titleInput.value = '';
                subjectInput.value = '';
                UI.showToast('Quick task added successfully!', 'success');
            } else {
                UI.showToast('Failed to add quick task', 'error');
            }
        });
    }

    // Study Tip Cycle
    const tipRefreshBtn = document.getElementById('tip-refresh-btn');
    if (tipRefreshBtn) {
        tipRefreshBtn.addEventListener('click', UI.cycleStudyTip);
    }

    // Urgent Deadlines 1-Click Complete
    const deadlinesList = document.getElementById('upcoming-deadlines-list');
    if (deadlinesList) {
        deadlinesList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="toggle-status"]');
            if (!btn) return;
            const taskId = btn.dataset.taskId;
            if (taskId) {
                handleToggleStatus(taskId);
            }
        });
    }

    // Pomodoro Controls
    const pomoToggleBtn = document.getElementById('pomodoro-start-pause');
    if (pomoToggleBtn) pomoToggleBtn.addEventListener('click', togglePomodoro);

    const pomoResetBtn = document.getElementById('pomodoro-reset');
    if (pomoResetBtn) pomoResetBtn.addEventListener('click', resetPomodoro);

    const pomoFocusBtn = document.getElementById('pomo-mode-focus');
    if (pomoFocusBtn) pomoFocusBtn.addEventListener('click', () => setPomodoroMode('focus'));

    const pomoShortBtn = document.getElementById('pomo-mode-short');
    if (pomoShortBtn) pomoShortBtn.addEventListener('click', () => setPomodoroMode('short'));

    const pomoLongBtn = document.getElementById('pomo-mode-long');
    if (pomoLongBtn) pomoLongBtn.addEventListener('click', () => setPomodoroMode('long'));

    // Pomodoro Settings Panel
    initPomodoroSettings();


    // Semester Goals Checklist
    const goalsList = document.getElementById('milestone-checklist');
    if (goalsList) {
        goalsList.addEventListener('change', (e) => {
            const cb = e.target.closest('.milestone-checkbox');
            if (!cb) return;
            const goalId = cb.dataset.goalId;
            const goal = semesterGoals.find(g => g.id === goalId);
            if (goal) {
                goal.completed = cb.checked;
                saveSemesterGoals();
                UI.renderSemesterGoals(semesterGoals, goalsList);
                if (goal.completed) {
                    UI.showToast(`Milestone achieved: ${goal.text}! 🎯`, 'success');
                }
            }
        });

        goalsList.addEventListener('click', (e) => {
            const delBtn = e.target.closest('.milestone-del-btn');
            if (!delBtn) return;
            const goalId = delBtn.dataset.goalId;
            semesterGoals = semesterGoals.filter(g => g.id !== goalId);
            saveSemesterGoals();
            UI.renderSemesterGoals(semesterGoals, goalsList);
            UI.showToast('Milestone removed', 'info');
        });
    }

    const milestoneAddForm = document.getElementById('milestone-add-form');
    if (milestoneAddForm) {
        milestoneAddForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('milestone-input');
            const text = input.value.trim();
            if (!text) return;
            const newGoal = {
                id: 'goal-' + Date.now().toString(36),
                text,
                completed: false
            };
            semesterGoals.push(newGoal);
            saveSemesterGoals();
            UI.renderSemesterGoals(semesterGoals, goalsList);
            input.value = '';
            UI.showToast('Semester milestone added!', 'success');
        });
    }

    // Main Task Form Submissions
    if (taskForm) {
        taskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            UI.clearFormErrors(taskForm);
            const formData = getFormData();
            if (editingTaskId) {
                handleEditTask(formData);
            } else {
                if (handleAddTask(formData)) {
                    UI.resetForm(taskForm);
                }
            }
        });
    }

    const resetBtn = document.getElementById('reset-form');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            editingTaskId = null;
            if (taskForm) UI.resetForm(taskForm);
            updateSubmitButton();
        });
    }

    // Search and Filter controls
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentFilters.search = e.target.value.trim();
            applyFiltersAndRender();
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', (e) => {
            currentFilters.status = e.target.value;
            applyFiltersAndRender();
        });
    }

    if (priorityFilter) {
        priorityFilter.addEventListener('change', (e) => {
            currentFilters.priority = e.target.value;
            applyFiltersAndRender();
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            applyFiltersAndRender();
        });
    }

    if (taskListContainer) {
        taskListContainer.addEventListener('click', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            const taskId = taskItem.dataset.taskId;
            const action = e.target.closest('[data-action]')?.dataset.action;
            switch (action) {
                case 'toggle-status':
                    handleToggleStatus(taskId);
                    break;
                case 'edit':
                    handleEditClick(taskId);
                    break;
                case 'delete':
                    handleDeleteTask(taskId);
                    break;
            }
        });
    }

    // Export & Import
    const exportBtn = document.getElementById('export-tasks-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const json = Storage.exportTasks();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            UI.showToast('Tasks exported successfully', 'success');
        });
    }

    const importBtn = document.getElementById('import-tasks-btn');
    const importInput = document.getElementById('import-file-input');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => {
            importInput.value = '';
            importInput.click();
        });

        importInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                const result = Storage.importTasks(content);
                if (result.success) {
                    loadAndRenderTasks();
                    UI.showToast(`Imported ${result.count} tasks successfully`, 'success');
                } else {
                    UI.showToast(result.errors?.general || 'Failed to import tasks', 'error');
                }
            };
            reader.onerror = () => {
                UI.showToast('Failed to read selected file', 'error');
            };
            reader.readAsText(file);
        });
    }

    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (allTasks.length === 0) {
                UI.showToast('No tasks to clear', 'info');
                return;
            }
            UI.showConfirmDialog('Are you sure you want to clear all tasks? This cannot be undone.', () => {
                Storage.clearAllTasks();
                loadAndRenderTasks();
                UI.showToast('All tasks cleared', 'success');
            });
        });
    }

    const emptyAddBtn = document.getElementById('empty-add-task');
    if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', () => {
            editingTaskId = null;
            UI.resetForm(taskForm);
            updateSubmitButton();
            UI.setActiveSection('add-task');
            window.location.hash = 'add-task';
        });
    }

    const emptySampleBtn = document.getElementById('empty-load-sample');
    if (emptySampleBtn) {
        emptySampleBtn.addEventListener('click', () => {
            Storage.loadSampleData(true);
            loadAndRenderTasks();
            UI.showToast('Sample tasks loaded successfully', 'success');
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const confirmDialog = document.getElementById('confirm-dialog');
            if (confirmDialog && confirmDialog.open) {
                const cancelBtn = document.getElementById('dialog-cancel');
                if (cancelBtn) cancelBtn.click();
            }
            const authModal = document.getElementById('auth-modal');
            if (authModal && authModal.open) {
                UI.hideAuthModal();
            }
            if (navMenu && navMenu.classList.contains('open')) {
                navMenu.classList.remove('open');
                if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // Hash change handler
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1);
        if (['landing', 'dashboard', 'tasks', 'add-task', 'about'].includes(hash)) {
            UI.setActiveSection(hash);
        }
    });

    // Dark mode listener
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!Storage.loadTheme()) {
            UI.applyTheme(e.matches ? 'dark' : 'light');
        }
    });
}

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------

async function init() {
    try {
        initDOMElements();
        UI.initTheme();
        setMinDueDate();
        initScratchpad();
        initEventListeners();
    } catch (e) {
        console.error('Core init error:', e);
    }
    
    try {
        // Initialize authentication
        await Auth.init();
        Auth.onAuthStateChanged((user) => {
            UI.renderUserProfile(user);
            // If a user just signed in while on the landing page, send them to the dashboard
            if (user) {
                const activeSectionEl = document.querySelector('.section.active');
                if (activeSectionEl && activeSectionEl.id === 'landing') {
                    UI.setActiveSection('dashboard');
                    window.location.hash = 'dashboard';
                }
            }
        });
    } catch (e) {
        console.warn('Auth init error:', e);
    }

    try {
        // Load initial tasks & sample data if empty
        Storage.loadSampleData();
        loadAndRenderTasks();
    } catch (e) {
        console.error('Storage init error:', e);
    }

    try {
        // Route according to URL hash
        const user = Auth.getCurrentUser();
        const initialHash = window.location.hash.slice(1);
        if (user && ['dashboard', 'tasks', 'add-task', 'about'].includes(initialHash)) {
            UI.setActiveSection(initialHash);
        } else if (user) {
            UI.setActiveSection('dashboard');
        } else {
            UI.setActiveSection('landing');
        }
    } catch (e) {
        console.error('Routing init error:', e);
        UI.setActiveSection('landing');
    }
}

window.TaskManager = { Storage, Tasks, UI, Auth, loadAndRenderTasks };

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}