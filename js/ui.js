import { Tasks } from './tasks.js';
import { Storage } from './storage.js';

let toastId = 0;

function createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderTaskItem(task) {
    const overdue = Tasks.isOverdue(task);
    const dueToday = Tasks.isDueToday(task);
    const isCompleted = task.status === 'completed';
    const isInProgress = task.status === 'in-progress';
    const titleClass = isCompleted ? 'completed' : '';
    const dateClass = overdue ? 'overdue' : (dueToday ? 'due-today' : '');
    const checkboxClass = isCompleted ? 'completed' : (isInProgress ? 'in-progress' : '');
    const statusLabel = Tasks.getStatusLabel(task.status);

    const metaItems = [];
    if (task.dueDate) {
        metaItems.push(`
            <span class="task-meta-item ${dateClass}" title="${Tasks.formatDate(task.dueDate)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>${Tasks.formatRelativeDate(task.dueDate)}</span>
            </span>
        `);
    }
    if (task.subject) {
        metaItems.push(`
            <span class="task-meta-item" title="${escapeHtml(task.subject)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>${escapeHtml(task.subject)}</span>
            </span>
        `);
    }

    return `
        <li class="task-item" data-task-id="${escapeHtml(task.id)}" role="listitem">
            <button class="task-checkbox ${checkboxClass}" 
                    data-action="toggle-status" 
                    aria-label="Status: ${statusLabel}. Click to advance status"
                    title="Status: ${statusLabel} (click to advance)"
                    aria-pressed="${isCompleted}">
                ${isInProgress ? 
                    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" style="width:14px;height:14px;color:var(--color-warning);"><line x1="5" y1="12" x2="19" y2="12"/></svg>` : 
                    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
                }
            </button>
            <div class="task-content">
                <div class="task-header">
                    <h3 class="task-title ${titleClass}">${escapeHtml(task.title)}</h3>
                    <div class="task-badges">
                        <span class="badge ${Tasks.getPriorityClass(task.priority)}">${Tasks.getPriorityLabel(task.priority)}</span>
                        <span class="badge ${Tasks.getStatusClass(task.status)}">${Tasks.getStatusLabel(task.status)}</span>
                    </div>
                </div>
                ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                ${metaItems.length > 0 ? `<div class="task-meta">${metaItems.join('')}</div>` : ''}
            </div>
            <div class="task-actions">
                <button class="task-btn edit" data-action="edit" aria-label="Edit task" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="task-btn delete" data-action="delete" aria-label="Delete task" title="Delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </li>
    `;
}

function renderTaskList(tasks, container) {
    if (tasks.length === 0) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = tasks.map(renderTaskItem).join('');
}

function showEmptyState(container, emptyStateElement, show) {
    if (show) {
        container.hidden = true;
        emptyStateElement.hidden = false;
    } else {
        container.hidden = false;
        emptyStateElement.hidden = true;
    }
}

function updateStatistics(stats) {
    const elements = {
        total: document.getElementById('stat-total'),
        pending: document.getElementById('stat-pending'),
        inprogress: document.getElementById('stat-inprogress'),
        completed: document.getElementById('stat-completed'),
        high: document.getElementById('stat-high'),
        today: document.getElementById('stat-today'),
        week: document.getElementById('stat-week'),
        overdue: document.getElementById('stat-overdue')
    };
    if (elements.total) elements.total.textContent = stats.total;
    if (elements.pending) elements.pending.textContent = stats.pending;
    if (elements.inprogress) elements.inprogress.textContent = stats.inProgress || 0;
    if (elements.completed) elements.completed.textContent = stats.completed;
    if (elements.high) elements.high.textContent = stats.highPriority;
    if (elements.today) elements.today.textContent = stats.today;
    if (elements.week) elements.week.textContent = stats.dueThisWeek || 0;
    if (elements.overdue) elements.overdue.textContent = stats.overdue || 0;
}

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const id = ++toastId;
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    const toast = createElement(`
        <div class="toast ${type}" data-toast-id="${id}" role="alert">
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close" aria-label="Dismiss notification">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
    `);
    container.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(id));
    setTimeout(() => removeToast(id), duration);
    return id;
}

function removeToast(id) {
    const toast = document.querySelector(`[data-toast-id="${id}"]`);
    if (toast) {
        toast.style.animation = 'slideIn 0.2s ease reverse';
        setTimeout(() => toast.remove(), 200);
    }
}

function showConfirmDialog(message, onConfirm) {
    const dialog = document.getElementById('confirm-dialog');
    const overlay = document.getElementById('overlay');
    const messageEl = document.getElementById('dialog-message');
    const confirmBtn = document.getElementById('dialog-confirm');
    const cancelBtn = document.getElementById('dialog-cancel');

    messageEl.textContent = message;
    dialog.showModal();
    overlay.hidden = false;
    overlay.classList.add('visible');

    const closeDialog = (result) => {
        if (dialog.open) {
            dialog.close();
        }
        overlay.classList.remove('visible');
        setTimeout(() => { overlay.hidden = true; }, 250);
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        dialog.removeEventListener('cancel', handleCancel);
        if (result && onConfirm) onConfirm();
    };

    const handleConfirm = () => closeDialog(true);
    const handleCancel = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        closeDialog(false);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    dialog.addEventListener('cancel', handleCancel);
    overlay.addEventListener('click', handleCancel, { once: true });

    confirmBtn.focus();
}

function showFormErrors(form, errors) {
    Object.keys(errors).forEach(field => {
        const input = form.querySelector(`[name="${field}"]`);
        const errorEl = document.getElementById(`${field}-error`) || 
                        (field === 'dueDate' ? document.getElementById('date-error') : null);
        if (input) {
            input.classList.add('error');
            input.setAttribute('aria-invalid', 'true');
        }
        if (errorEl) {
            errorEl.textContent = errors[field];
        }
    });
}

function clearFormErrors(form) {
    form.querySelectorAll('.error').forEach(el => {
        el.classList.remove('error');
        el.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('.error-message').forEach(el => {
        el.textContent = '';
    });
}

function populateForm(form, task) {
    form.querySelector('[name="title"]').value = task.title || '';
    form.querySelector('[name="description"]').value = task.description || '';
    form.querySelector('[name="subject"]').value = task.subject || '';
    form.querySelector('[name="dueDate"]').value = task.dueDate || '';
    form.querySelector('[name="priority"]').value = task.priority || 'medium';
    form.querySelector('[name="status"]').value = task.status || 'pending';
}

function resetForm(form) {
    form.reset();
    form.querySelector('[name="priority"]').value = 'medium';
    form.querySelector('[name="status"]').value = 'pending';
    clearFormErrors(form);
}

function setActiveSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
        link.setAttribute('aria-current', link.dataset.section === sectionId ? 'page' : 'false');
    });
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.querySelector('.nav-toggle');
    if (navMenu && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
    }

    // Nav Bar visibility: Strictly hidden on landing page, appears once logged in / inside app views
    const appHeader = document.getElementById('app-header') || document.querySelector('.header');
    if (appHeader) {
        if (sectionId === 'landing') {
            appHeader.style.display = 'none';
            appHeader.classList.add('landing-hidden');
            document.body.classList.add('is-landing');
        } else {
            appHeader.style.display = 'block';
            appHeader.classList.remove('landing-hidden');
            document.body.classList.remove('is-landing');
        }
    }
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    Storage.saveTheme(theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
}

function initTheme() {
    const saved = Storage.loadTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

const STUDY_TIPS = [
    {
        title: 'The 25/5 Study Focus Method',
        text: 'Study with 100% focus for 25 minutes, then take a 5-minute break. After 4 cycles, take a longer 20-minute rest to keep mental stamina high.'
    },
    {
        title: 'The Feynman Technique',
        text: 'Explain complex concepts in simple, plain language as if teaching a beginner. If you get stuck, review that part until it is crystal clear.'
    },
    {
        title: 'Active Recall',
        text: 'Test yourself without looking at your notes instead of passively re-reading. Active retrieval builds much stronger neural pathways.'
    },
    {
        title: 'Spaced Repetition',
        text: 'Review assignments and exam concepts at increasing intervals (Day 1, Day 3, Day 7) to cement knowledge into long-term memory.'
    },
    {
        title: 'Eat the Frog First',
        text: 'Tackle your highest priority or most intimidating lab assignment first thing in the morning when your willpower is fresh.'
    }
];

let currentTipIndex = 0;

function cycleStudyTip() {
    currentTipIndex = (currentTipIndex + 1) % STUDY_TIPS.length;
    const tip = STUDY_TIPS[currentTipIndex];
    const titleEl = document.getElementById('tip-title');
    const textEl = document.getElementById('tip-text');
    if (titleEl) titleEl.textContent = tip.title;
    if (textEl) textEl.textContent = tip.text;
}

function renderDashboardGreeting(user, stats) {
    const titleEl = document.getElementById('greeting-title');
    const dateEl = document.getElementById('greeting-date');
    const pillTextEl = document.getElementById('greeting-summary-text');
    const completionRateEl = document.getElementById('greeting-completion-rate');
    const progressBarEl = document.getElementById('greeting-progress-bar');
    
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) timeGreeting = 'Good afternoon';
    else if (hour >= 17) timeGreeting = 'Good evening';

    const name = user ? (user.displayName || user.email.split('@')[0]) : 'Student';
    if (titleEl) {
        titleEl.textContent = `${timeGreeting}, ${name}! 👋`;
    }

    if (dateEl) {
        const today = new Date();
        dateEl.textContent = today.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    if (pillTextEl) {
        pillTextEl.textContent = `${stats.completed}/${stats.total} tasks completed`;
    }
    if (completionRateEl) {
        completionRateEl.textContent = `${stats.completionRate}%`;
    }
    if (progressBarEl) {
        progressBarEl.style.width = `${stats.completionRate}%`;
    }
}

function renderWeeklyChart(weeklyData, streak = 1) {
    const container = document.getElementById('weekly-chart-container');
    const rateBadge = document.getElementById('weekly-completion-rate');
    const streakBadge = document.getElementById('weekly-streak-badge');
    if (!container) return;

    let maxVal = Math.max(...weeklyData.map(d => Math.max(d.completed, d.created)), 1);
    const totalDone = weeklyData.reduce((acc, d) => acc + d.completed, 0);
    const totalCreated = weeklyData.reduce((acc, d) => acc + d.created, 0);
    const rate = totalCreated > 0 ? Math.round((totalDone / totalCreated) * 100) : 0;

    if (rateBadge) {
        rateBadge.textContent = `${rate}% Completed`;
    }
    if (streakBadge) {
        streakBadge.textContent = `🔥 ${streak}-Day Streak`;
    }

    container.innerHTML = weeklyData.map(d => {
        const heightPct = Math.max(Math.round((d.completed / maxVal) * 85), d.completed > 0 ? 15 : 6);
        return `
            <div class="weekly-bar-group" title="${d.day}: ${d.completed} completed / ${d.created} created">
                <div class="weekly-bar-track">
                    <div class="weekly-bar-fill ${d.isToday ? 'today' : ''}" style="height: ${heightPct}%"></div>
                    ${d.completed > 0 ? `<span class="weekly-bar-val">${d.completed}</span>` : ''}
                </div>
                <span class="weekly-bar-label ${d.isToday ? 'active' : ''}">${d.day}</span>
            </div>
        `;
    }).join('');
}

function renderUpcomingDeadlines(upcomingTasks, container) {
    if (!container) return;
    if (upcomingTasks.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 24px var(--spacing-md); color: var(--text-muted); font-size: var(--font-size-sm);">
                <span>🎉 All clear! No urgent pending deadlines.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = upcomingTasks.map(task => {
        const isOver = Tasks.isOverdue(task);
        const isToday = Tasks.isDueToday(task);
        const badgeClass = isOver ? 'overdue' : (isToday ? 'today' : 'upcoming');
        const relativeDate = Tasks.formatRelativeDate(task.dueDate);

        return `
            <div class="deadline-item" data-task-id="${task.id}">
                <div class="deadline-main">
                    <span class="deadline-title">${escapeHtml(task.title)}</span>
                    <span class="deadline-sub">${escapeHtml(task.subject || 'General')} • ${Tasks.formatDate(task.dueDate)}</span>
                </div>
                <div class="deadline-right">
                    <span class="deadline-badge ${badgeClass}">${relativeDate}</span>
                    <button type="button" class="deadline-complete-btn" data-action="toggle-status" data-task-id="${task.id}" title="Mark task completed" aria-label="Mark as complete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderTodayTimeSlots(slots, container) {
    if (!container) return;
    
    const renderSlotList = (list) => {
        if (!list || list.length === 0) {
            return `<div class="slot-empty">No tasks scheduled</div>`;
        }
        return list.map(t => `
            <div class="slot-task-chip priority-${t.priority || 'medium'}" data-task-id="${t.id}" title="${escapeHtml(t.title)} (${escapeHtml(t.subject || 'General')})">
                <span class="chip-dot"></span>
                <span class="chip-title">${escapeHtml(t.title)}</span>
                <span class="chip-badge">${escapeHtml(t.subject || 'Task')}</span>
            </div>
        `).join('');
    };

    container.innerHTML = `
        <div class="time-slot-block morning">
            <div class="slot-header">
                <span class="slot-icon">🌅</span>
                <span class="slot-title">Morning Focus (Priority Submissions)</span>
            </div>
            <div class="slot-tasks">${renderSlotList(slots.morning)}</div>
        </div>
        <div class="time-slot-block afternoon">
            <div class="slot-header">
                <span class="slot-icon">☀️</span>
                <span class="slot-title">Afternoon Study (Labs & Practice)</span>
            </div>
            <div class="slot-tasks">${renderSlotList(slots.afternoon)}</div>
        </div>
        <div class="time-slot-block evening">
            <div class="slot-header">
                <span class="slot-icon">🌙</span>
                <span class="slot-title">Evening Review (Revision & Planning)</span>
            </div>
            <div class="slot-tasks">${renderSlotList(slots.evening)}</div>
        </div>
    `;
}

function renderSemesterGoals(goals, container) {
    if (!container) return;
    const badgeEl = document.getElementById('milestone-percentage-badge');
    const fillEl = document.getElementById('milestone-bar-fill');

    const total = goals.length;
    const completed = goals.filter(g => g.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (badgeEl) badgeEl.textContent = `${completed}/${total} (${pct}%)`;
    if (fillEl) fillEl.style.width = `${pct}%`;

    if (goals.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 12px; color: var(--text-muted); font-size: var(--font-size-xs);">No milestones added yet. Add one below!</div>`;
        return;
    }

    container.innerHTML = goals.map(g => `
        <div class="milestone-item ${g.completed ? 'completed' : ''}" data-goal-id="${g.id}">
            <label class="milestone-checkbox-wrap">
                <input type="checkbox" class="milestone-checkbox" data-goal-id="${g.id}" ${g.completed ? 'checked' : ''}>
                <span class="milestone-custom-check"></span>
                <span class="milestone-text">${escapeHtml(g.text)}</span>
            </label>
            <button type="button" class="milestone-del-btn" data-goal-id="${g.id}" title="Remove goal" aria-label="Delete milestone">&times;</button>
        </div>
    `).join('');
}

function renderPomodoro(timeRemaining, totalSeconds, mode, isRunning, completedCycles) {
    const displayEl = document.getElementById('pomodoro-timer-display');
    const barEl = document.getElementById('pomodoro-progress-bar');
    const btnTextEl = document.getElementById('pomodoro-btn-text');
    const btnIconEl = document.getElementById('pomodoro-btn-icon');
    const cycleBadgeEl = document.getElementById('pomodoro-cycle-badge');
    const modeLabelEl = document.getElementById('pomodoro-mode-label');
    const completedCountEl = document.getElementById('pomodoro-completed-count');

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (displayEl) displayEl.textContent = timeStr;

    const progressPct = totalSeconds > 0 ? (timeRemaining / totalSeconds) * 100 : 100;
    if (barEl) barEl.style.width = `${progressPct}%`;

    if (btnTextEl) {
        btnTextEl.textContent = isRunning ? 'Pause' : (timeRemaining < totalSeconds ? 'Resume' : 'Start Focus');
    }
    if (btnIconEl) {
        if (isRunning) {
            btnIconEl.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
        } else {
            btnIconEl.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
        }
    }

    if (completedCountEl) completedCountEl.textContent = completedCycles;

    // Active mode tab buttons
    document.querySelectorAll('.pomo-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const labels = {
        focus: 'Focus Session (25m)',
        short: 'Short Break (5m)',
        long: 'Long Break (15m)'
    };
    const descriptions = {
        focus: 'Deep Study Block',
        short: 'Rest & Refresh',
        long: 'Mental Recovery'
    };

    if (cycleBadgeEl) cycleBadgeEl.textContent = labels[mode] || 'Focus Session';
    if (modeLabelEl) modeLabelEl.textContent = descriptions[mode] || 'Study Block';
}

function renderSubjectBreakdown(subjectData, container) {
    if (!container) return;
    if (subjectData.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: var(--font-size-sm);">
                No subjects recorded yet. Add your subjects in tasks!
            </div>
        `;
        return;
    }

    container.innerHTML = subjectData.map(sub => `
        <div class="subject-progress-item">
            <div class="subject-progress-header">
                <span class="subject-name">${escapeHtml(sub.name)}</span>
                <span class="subject-ratio">${sub.completed}/${sub.total} done (${sub.percentage}%)</span>
            </div>
            <div class="subject-bar-bg">
                <div class="subject-bar-fill" style="width: ${sub.percentage}%"></div>
            </div>
        </div>
    `).join('');
}

function renderPriorityDistribution(dist) {
    const highEl = document.getElementById('split-high');
    const medEl = document.getElementById('split-medium');
    const lowEl = document.getElementById('split-low');
    const highVal = document.getElementById('legend-high-val');
    const medVal = document.getElementById('legend-med-val');
    const lowVal = document.getElementById('legend-low-val');

    if (highEl) highEl.style.width = `${dist.highPercent}%`;
    if (medEl) medEl.style.width = `${dist.mediumPercent}%`;
    if (lowEl) lowEl.style.width = `${dist.lowPercent}%`;

    if (highVal) highVal.textContent = dist.high;
    if (medVal) medVal.textContent = dist.medium;
    if (lowVal) lowVal.textContent = dist.low;
}

function renderRecentActivities(activities, container) {
    if (!container) return;
    if (activities.length === 0) {
        container.innerHTML = `
            <div style="padding: 16px; color: var(--text-muted); font-size: var(--font-size-sm);">
                No recent activity recorded yet.
            </div>
        `;
        return;
    }

    container.innerHTML = activities.map(act => `
        <div class="timeline-item">
            <span class="timeline-dot ${act.icon}"></span>
            <span class="timeline-action">${act.action} • ${act.time}</span>
            <span class="timeline-title">${escapeHtml(act.title)} (${escapeHtml(act.subject || 'Task')})</span>
        </div>
    `).join('');
}

function renderUserProfile(user) {
    const loginBtn = document.getElementById('nav-login-btn');
    const profileMenu = document.getElementById('user-profile-menu');
    const initialsEl = document.getElementById('user-initials');
    const nameEl = document.getElementById('dropdown-user-name');
    const emailEl = document.getElementById('dropdown-user-email');
    const badgeEl = document.getElementById('dropdown-user-badge');

    if (!user) {
        if (loginBtn) loginBtn.hidden = false;
        if (profileMenu) profileMenu.hidden = true;
        return;
    }

    if (loginBtn) loginBtn.hidden = true;
    if (profileMenu) profileMenu.hidden = false;

    const name = user.displayName || user.email.split('@')[0];
    const initial = (name[0] || 'U').toUpperCase();

    if (initialsEl) initialsEl.textContent = initial;
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = user.email;
    if (badgeEl) {
        badgeEl.textContent = user.isGuest ? 'Guest Session' : 'Firebase Verified';
        badgeEl.className = user.isGuest ? 'badge badge-guest' : 'badge badge-status-completed';
    }
}

function showAuthModal(tab = 'login') {
    const dialog = document.getElementById('auth-modal');
    if (!dialog) return;
    switchAuthTab(tab);
    dialog.showModal();
}

function hideAuthModal() {
    const dialog = document.getElementById('auth-modal');
    if (dialog && dialog.open) dialog.close();
}

function switchAuthTab(tab) {
    const loginTab = document.getElementById('tab-login');
    const signupTab = document.getElementById('tab-signup');
    const nameGroup = document.getElementById('auth-name-group');
    const submitBtn = document.getElementById('auth-submit-btn');
    const errorEl = document.getElementById('auth-error');

    if (errorEl) errorEl.textContent = '';

    if (tab === 'signup') {
        if (loginTab) { loginTab.classList.remove('active'); loginTab.setAttribute('aria-selected', 'false'); }
        if (signupTab) { signupTab.classList.add('active'); signupTab.setAttribute('aria-selected', 'true'); }
        if (nameGroup) nameGroup.hidden = false;
        if (submitBtn) submitBtn.querySelector('span').textContent = 'Create Account';
    } else {
        if (loginTab) { loginTab.classList.add('active'); loginTab.setAttribute('aria-selected', 'true'); }
        if (signupTab) { signupTab.classList.remove('active'); signupTab.setAttribute('aria-selected', 'false'); }
        if (nameGroup) nameGroup.hidden = true;
        if (submitBtn) submitBtn.querySelector('span').textContent = 'Log In';
    }
}

export const UI = {
    renderTaskItem,
    renderTaskList,
    showEmptyState,
    updateStatistics,
    renderDashboardGreeting,
    renderWeeklyChart,
    renderUpcomingDeadlines,
    renderSubjectBreakdown,
    renderPriorityDistribution,
    renderRecentActivities,
    renderTodayTimeSlots,
    renderSemesterGoals,
    renderPomodoro,
    renderUserProfile,
    showAuthModal,
    hideAuthModal,
    switchAuthTab,
    cycleStudyTip,
    showToast,
    removeToast,
    showConfirmDialog,
    showFormErrors,
    clearFormErrors,
    populateForm,
    resetForm,
    setActiveSection,
    applyTheme,
    toggleTheme,
    initTheme,
    escapeHtml,
    createElement
};