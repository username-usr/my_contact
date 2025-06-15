document.addEventListener('DOMContentLoaded', () => {
    // Fetch and display dashboard data
    fetchDashboardData();

    // Set up periodic refresh
    setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
});

function fetchDashboardData() {
    fetch('/api/dashboard')
        .then(response => response.json())
        .then(data => {
            updateTodoList(data.todoList);
            updateNotifications(data.notifications);
            updateTemplates(data.templates);
        })
        .catch(error => {
            console.error('Error fetching dashboard data:', error);
        });
}

function updateTodoList(todoList) {
    const todoListContainer = document.getElementById('todoList');
    todoListContainer.innerHTML = '';

    todoList.forEach(task => {
        if (!task.completed) {
            const todoItem = document.createElement('div');
            todoItem.className = `todo-item ${task.priority}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => updateTaskStatus(task.id, checkbox.checked));
            
            const taskContent = document.createElement('div');
            taskContent.className = 'task-content';
            taskContent.textContent = task.description;
            
            todoItem.appendChild(checkbox);
            todoItem.appendChild(taskContent);
            todoListContainer.appendChild(todoItem);
        }
    });
}

function updateNotifications(notifications) {
    const notificationsContainer = document.getElementById('notifications');
    notificationsContainer.innerHTML = '';

    notifications.forEach(notification => {
        const notificationElement = document.createElement('div');
        notificationElement.className = 'notification';
        notificationElement.textContent = notification.message;
        notificationsContainer.appendChild(notificationElement);
    });
}

function updateTemplates(templates) {
    const templatesContainer = document.getElementById('templates');
    templatesContainer.innerHTML = '';

    templates.forEach(template => {
        const templateElement = document.createElement('div');
        templateElement.className = 'template';
        
        const title = document.createElement('h3');
        title.textContent = template.title;
        
        const content = document.createElement('div');
        content.className = 'template-content';
        content.textContent = template.content;
        
        templateElement.appendChild(title);
        templateElement.appendChild(content);
        templatesContainer.appendChild(templateElement);
    });
}

function updateTaskStatus(taskId, completed) {
    fetch('/api/update-task', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            taskId,
            completed
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            fetchDashboardData(); // Refresh the dashboard
        }
    })
    .catch(error => {
        console.error('Error updating task:', error);
    });
} 