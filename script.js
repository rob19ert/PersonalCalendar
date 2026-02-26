document.addEventListener('DOMContentLoaded', () => {
    const calendarPanel = document.getElementById('calendar-panel');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const taskInput = document.getElementById('task-input');
    const startTimeSelect = document.getElementById('start-time');
    const endTimeSelect = document.getElementById('end-time');
    const addBtn = document.getElementById('add-btn');
    const timeGrid = document.getElementById('time-grid');
    const gridLinesContainer = document.getElementById('grid-lines');
    const gridTasksContainer = document.getElementById('grid-tasks');

    let currentDate = new Date();
    let selectedDateStr = formatDate(currentDate);
    
    let tasksData = JSON.parse(localStorage.getItem('todo_tasks')) || {};

    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    
    // Grid settings
    const GRID_START_HOUR = 6;
    const GRID_END_HOUR = 24; // 24 represents 00:00 next day
    const PIXELS_PER_MINUTE = 1; // 60px per hour

    function generateGridLines() {
        gridLinesContainer.innerHTML = '';
        for (let i = GRID_START_HOUR; i <= GRID_END_HOUR; i++) {
            const line = document.createElement('div');
            line.className = 'grid-line';
            
            const timeLabel = document.createElement('div');
            timeLabel.className = 'time-label';
            const displayHour = i === 24 ? '00' : String(i).padStart(2, '0');
            // Show label every 2 hours as requested
            if (i % 2 === 0 || i === GRID_START_HOUR || i === GRID_END_HOUR) {
                timeLabel.textContent = `${displayHour}:00`;
            } else {
                timeLabel.textContent = '';
                line.classList.add('half-line');
            }
            
            const content = document.createElement('div');
            content.className = 'grid-line-content';
            
            line.appendChild(timeLabel);
            line.appendChild(content);
            gridLinesContainer.appendChild(line);
        }
        timeGrid.style.minHeight = `${(GRID_END_HOUR - GRID_START_HOUR) * 60}px`;
    }

    function timeToMinutes(timeStr) {
        if (!timeStr) return 0;
        let [hours, minutes] = timeStr.split(':').map(Number);
        if (hours === 0 && timeStr === '00:00') {
            hours = 24; // Treat 00:00 as end of day
        }
        return hours * 60 + minutes;
    }

    function formatDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function initTimeSelectors() {
        // Set default values
        startTimeSelect.value = '10:00';
        endTimeSelect.value = '12:00';

        // Auto-adjust end time when start time changes
        startTimeSelect.addEventListener('change', () => {
            if (startTimeSelect.value && (!endTimeSelect.value || startTimeSelect.value >= endTimeSelect.value)) {
                let [hours, minutes] = startTimeSelect.value.split(':').map(Number);
                hours = (hours + 1) % 24;
                endTimeSelect.value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
        });
    }

    function generateCalendar() {
        calendarPanel.innerHTML = '';
        
        let startDay = new Date(selectedDateStr);
        startDay.setDate(startDay.getDate() - 3);

        for (let i = 0; i < 7; i++) {
            const d = new Date(startDay);
            d.setDate(d.getDate() + i);
            const dStr = formatDate(d);
            
            const btn = document.createElement('button');
            btn.className = `day-btn ${dStr === selectedDateStr ? 'active' : ''}`;
            btn.dataset.date = dStr;
            
            const dayName = document.createElement('div');
            dayName.className = 'day-name';
            dayName.textContent = dayNames[d.getDay()];
            
            const dayNum = document.createElement('div');
            dayNum.className = 'day-number';
            dayNum.textContent = d.getDate();
            
            btn.appendChild(dayName);
            btn.appendChild(dayNum);
            
            btn.addEventListener('click', () => {
                selectedDateStr = dStr;
                updateCalendarDisplay();
                renderTasks();
            });
            
            calendarPanel.appendChild(btn);
        }
        
        updateDateDisplayText();
    }

    function updateCalendarDisplay() {
        generateCalendar();
    }

    function updateDateDisplayText() {
        const todayStr = formatDate(new Date());
        if (selectedDateStr === todayStr) {
            selectedDateDisplay.textContent = 'Сегодня';
        } else {
            const d = new Date(selectedDateStr);
            selectedDateDisplay.textContent = `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        }
    }

    function saveTasks() {
        localStorage.setItem('todo_tasks', JSON.stringify(tasksData));
    }

    function getTasksForSelectedDate() {
        return tasksData[selectedDateStr] || [];
    }

    function renderTasks() {
        gridTasksContainer.innerHTML = '';
        const tasks = getTasksForSelectedDate();

        if (tasks.length === 0) return;

        // Prepare tasks for rendering
        let renderableTasks = tasks.map(task => {
            let startMins = timeToMinutes(task.startTime);
            let endMins = timeToMinutes(task.endTime);
            
            // Clamp to grid boundaries
            let gridStartMins = GRID_START_HOUR * 60;
            let gridEndMins = GRID_END_HOUR * 60;
            
            if (endMins < startMins) endMins += 24 * 60; // Handle over-midnight
            
            let displayStart = Math.max(gridStartMins, Math.min(gridEndMins, startMins));
            let displayEnd = Math.max(gridStartMins, Math.min(gridEndMins, endMins));
            
            let top = (displayStart - gridStartMins) * PIXELS_PER_MINUTE;
            let height = (displayEnd - displayStart) * PIXELS_PER_MINUTE;
            
            // Minimum height for visibility
            if (height < 30) height = 30;

            return {
                ...task,
                startMins,
                endMins,
                top,
                height
            };
        }).filter(t => t.height > 0 && t.top < (GRID_END_HOUR - GRID_START_HOUR) * 60);

        // Calculate overlaps
        renderableTasks.sort((a, b) => a.startMins - b.startMins || b.endMins - a.endMins);

        let groups = [];
        let currentGroup = [];
        let groupEnd = 0;

        renderableTasks.forEach(task => {
            if (currentGroup.length === 0) {
                currentGroup.push(task);
                groupEnd = task.endMins;
            } else {
                if (task.startMins < groupEnd) {
                    currentGroup.push(task);
                    groupEnd = Math.max(groupEnd, task.endMins);
                } else {
                    groups.push(currentGroup);
                    currentGroup = [task];
                    groupEnd = task.endMins;
                }
            }
        });
        if (currentGroup.length > 0) groups.push(currentGroup);

        groups.forEach(group => {
            let columns = [];
            group.forEach(task => {
                let placed = false;
                for (let i = 0; i < columns.length; i++) {
                    let lastTaskInCol = columns[i][columns[i].length - 1];
                    // Add slight margin (1 min) so they don't share exact border if touching
                    if (lastTaskInCol.endMins <= task.startMins) {
                        columns[i].push(task);
                        task.colIndex = i;
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    task.colIndex = columns.length;
                    columns.push([task]);
                }
            });
            
            let numCols = columns.length;
            group.forEach(task => {
                const taskEl = createTaskElement(task, numCols);
                gridTasksContainer.appendChild(taskEl);
            });
        });
    }

    function createTaskElement(task, numCols) {
        const div = document.createElement('div');
        div.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        div.style.top = `${task.top}px`;
        div.style.height = `${task.height}px`;
        div.style.width = `calc(${100 / numCols}% - 4px)`;
        div.style.left = `calc(${(task.colIndex / numCols) * 100}% + 2px)`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'task-item-header';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => toggleTask(task.id));
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
        deleteBtn.addEventListener('click', () => deleteTask(task.id));
        
        headerDiv.appendChild(checkbox);
        headerDiv.appendChild(deleteBtn);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'task-info';

        const timeBadge = document.createElement('span');
        timeBadge.className = 'task-time-badge';
        timeBadge.textContent = `${task.startTime} - ${task.endTime}`;

        const textSpan = document.createElement('span');
        textSpan.className = 'task-text';
        textSpan.textContent = task.text;
        textSpan.title = task.text; // show full text on hover

        infoDiv.appendChild(timeBadge);
        infoDiv.appendChild(textSpan);
        
        div.appendChild(headerDiv);
        div.appendChild(infoDiv);
        
        return div;
    }

    function addTask() {
        const text = taskInput.value.trim();
        if (!text) return;
        
        const startTime = startTimeSelect.value;
        const endTime = endTimeSelect.value;

        if (!startTime || !endTime) {
            alert('Пожалуйста, выберите время начала и окончания.');
            return;
        }

        if (startTime === endTime) {
            alert('Время начала и окончания не могут совпадать.');
            return;
        }

        if (startTime > endTime && endTime !== '00:00') {
             alert('Время окончания должно быть позже времени начала.');
             return;
        }
        
        if (!tasksData[selectedDateStr]) {
            tasksData[selectedDateStr] = [];
        }
        
        const newTask = {
            id: Date.now().toString(),
            text: text,
            startTime: startTime,
            endTime: endTime,
            completed: false
        };
        
        tasksData[selectedDateStr].push(newTask);
        
        // Sort tasks by start time within the day
        tasksData[selectedDateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));

        saveTasks();
        renderTasks();
        taskInput.value = '';
    }

    function toggleTask(id) {
        const tasks = tasksData[selectedDateStr];
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
        }
    }

    function deleteTask(id) {
        tasksData[selectedDateStr] = tasksData[selectedDateStr].filter(t => t.id !== id);
        if (tasksData[selectedDateStr].length === 0) {
            delete tasksData[selectedDateStr];
        }
        saveTasks();
        renderTasks();
    }

    addBtn.addEventListener('click', addTask);

    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTask();
        }
    });

    initTimeSelectors();
    generateGridLines();
    generateCalendar();
    renderTasks();
});

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}