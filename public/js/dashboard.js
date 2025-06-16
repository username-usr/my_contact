document.addEventListener("DOMContentLoaded", () => {
  // Ensure a username is set for API calls, default to 'guest_user'
  if (!localStorage.getItem("username")) {
    localStorage.setItem("username", "guest_user");
  }

  fetchDashboardData();
  setInterval(fetchDashboardData, 30000);

  const addContactBtn = document.getElementById("addContactBtn");
  const contactInputModal = document.getElementById("contactInputModal");
  const closeContactInputModalBtn = document.getElementById("closeContactInputModal");
  const contactMessageInput = document.getElementById("contactMessageInput");
  const sendContactMessageButton = document.getElementById("sendContactMessageButton");
  const contactChatMessages = document.getElementById("contactChatMessages");
  const saveContactButton = document.getElementById("saveContactButton");

  let currentContactData = {};
  let questionCount = 0;

  addContactBtn.addEventListener("click", () => {
    contactInputModal.classList.add("active");
    contactChatMessages.innerHTML = `
            <div class="message ai">
                <div class="message-content">Welcome! Please tell me about the person you met. Include their name, how you met, where you met, and a brief summary of your conversation.</div>
                <div class="message-timestamp"></div>
            </div>
        `;
    contactMessageInput.value = "";
    currentContactData = {};
    questionCount = 0;
    saveContactButton.style.display = "none";
    addTimestampToLastMessage(contactChatMessages);
  });

  closeContactInputModalBtn.addEventListener("click", () => {
    contactInputModal.classList.remove("active");
  });

  function sendContactMessage() {
    const message = contactMessageInput.value.trim();
    const username = localStorage.getItem("username");

    if (!message || !username) {
      return;
    }

    addMessageToContactChat("user", message);
    contactMessageInput.value = "";

    fetch("/api/add-contact-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        message,
        collectedContactData: currentContactData,
        questionCount
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          addMessageToContactChat("ai", data.aiResponse);
          currentContactData = { ...currentContactData, ...data.extractedData };
          questionCount = data.questionCount;

          // Show save button when readyToSave is true
          if (data.readyToSave) {
            saveContactButton.style.display = "block";
            if (data.missingFields.length > 0) {
              addMessageToContactChat("ai", `You can save the contact now. Note: Some details are missing (${data.missingFields.join(", ")}).`);
            } else {
              addMessageToContactChat("ai", `All required details provided! You can save the contact now.`);
            }
          } else {
            saveContactButton.style.display = "none";
          }
        } else {
          console.error("Error from AI contact endpoint:", data.error);
          addMessageToContactChat("ai", data.error || "Sorry, an error occurred with the AI processing.");
        }
      })
      .catch((error) => {
        console.error("Network error sending contact message:", error);
        addMessageToContactChat("ai", "Sorry, a network error occurred. Please try again.");
      });
  }

  sendContactMessageButton.addEventListener("click", sendContactMessage);
  contactMessageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendContactMessage();
    }
  });

  function addMessageToContactChat(type, content) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    messageContent.textContent = content;

    const timestampDiv = document.createElement("div");
    timestampDiv.className = "message-timestamp";
    timestampDiv.textContent = new Date().toLocaleTimeString();

    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(timestampDiv);
    contactChatMessages.appendChild(messageDiv);

    contactChatMessages.scrollTop = contactChatMessages.scrollHeight;
  }

  function addTimestampToLastMessage(container) {
    const lastMessage = container.lastElementChild;
    if (lastMessage) {
      let timestampDiv = lastMessage.querySelector(".message-timestamp");
      if (!timestampDiv) {
        timestampDiv = document.createElement("div");
        timestampDiv.className = "message-timestamp";
        lastMessage.appendChild(timestampDiv);
      }
      timestampDiv.textContent = new Date().toLocaleTimeString();
    }
  }

  saveContactButton.addEventListener("click", () => {
    const username = localStorage.getItem("username");
    if (!username) {
      alert("A username is required to save contacts. Please ensure localStorage is working.");
      return;
    }

    fetch("/api/save-contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        contactData: currentContactData,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("Contact saved successfully!");
          contactInputModal.classList.remove("active");
          fetchDashboardData();
        } else {
          console.error("Failed to save contact:", data.error);
          alert("Failed to save contact: " + data.error);
        }
      })
      .catch((error) => {
        console.error("Network error saving contact:", error);
        alert("A network error occurred while saving the contact.");
      });
  });

  function fetchDashboardData() {
    const username = localStorage.getItem("username");
    fetch(`/api/dashboard?username=${username}`)
      .then((response) => response.json())
      .then((data) => {
        updateTodoList(data.todoList);
        updateNotifications(data.notifications);
        updateTemplates(data.templates);
      })
      .catch((error) => {
        console.error("Error fetching dashboard data:", error);
      });
  }

  function updateTodoList(todoList) {
    const todoListContainer = document.getElementById('todoList');
    todoListContainer.innerHTML = '';

    if (!todoList || todoList.length === 0) {
        todoListContainer.textContent = 'No to-do items.';
        return;
    }

    todoList.forEach(task => {
        if (!task.completed) {
            const todoItem = document.createElement('div');
            todoItem.className = `todo-item`;

            const randomHue = Math.floor(Math.random() * 360);
            const randomLightColor = `hsl(${randomHue}, 70%, 85%)`;
            todoItem.style.borderLeft = `3px solid ${randomLightColor}`;

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
    const notificationsContainer = document.getElementById("notifications");
    notificationsContainer.innerHTML = "";

    if (!notifications || notifications.length === 0) {
      notificationsContainer.textContent = "No new notifications.";
      return;
    }

    notifications.forEach((notification) => {
      const notificationElement = document.createElement("div");
      notificationElement.className = `notification ${notification.type}`;

      const messageHeader = document.createElement("h3");
      messageHeader.textContent = notification.message;
      notificationElement.appendChild(messageHeader);

      const suggestionP = document.createElement("p");
      suggestionP.textContent = notification.suggestion;
      notificationElement.appendChild(suggestionP);

      notificationsContainer.appendChild(notificationElement);
    });
  }

  function updateTemplates(templates) {
    const templatesContainer = document.getElementById("templates");
    templatesContainer.innerHTML = "";

    if (!templates || templates.length === 0) {
      templatesContainer.textContent = "No templates available.";
      return;
    }

    templates.forEach((template) => {
      const templateElement = document.createElement("div");
      templateElement.className = "template";

      const title = document.createElement("h3");
      title.textContent = template.title;

      const content = document.createElement("div");
      content.className = "template-content";
      content.textContent = template.content;

      templateElement.appendChild(title);
      templateElement.appendChild(content);
      templatesContainer.appendChild(templateElement);
    });
  }

  function updateTaskStatus(taskId, completed) {
    const username = localStorage.getItem("username");
    fetch("/api/update-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId,
        completed,
        username,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          fetchDashboardData();
        } else {
          console.error("Failed to update task status:", data.error);
        }
      })
      .catch((error) => {
        console.error("Error updating task:", error);
      });
  }

  const addTodoBtn = document.getElementById("addTodoBtn");
  const addTodoModal = document.getElementById("addTodoModal");
  const closeTodoModalBtn = document.getElementById("closeTodoModal");
  const todoDescriptionInput = document.getElementById("todoDescriptionInput");
  const saveTodoButton = document.getElementById("saveTodoButton");

  addTodoBtn.addEventListener("click", () => {
    addTodoModal.classList.add("active");
    todoDescriptionInput.value = "";
    todoDescriptionInput.focus();
  });

  closeTodoModalBtn.addEventListener("click", () => {
    addTodoModal.classList.remove("active");
  });

  function saveNewTodo() {
    const description = todoDescriptionInput.value.trim();
    const username = localStorage.getItem("username");

    if (!description || !username) {
      alert("Please enter a to-do description and ensure a username is set.");
      return;
    }

    fetch("/api/add-todo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        description,
        priority: "low",
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("To-Do item added successfully!");
          addTodoModal.classList.remove("active");
          fetchDashboardData();
        } else {
          console.error("Failed to add to-do:", data.error);
          alert("Failed to add to-do: " + data.error);
        }
      })
      .catch((error) => {
        console.error("Network error adding to-do:", error);
        alert("A network error occurred while adding the to-do.");
      });
  }

  saveTodoButton.addEventListener("click", saveNewTodo);
  todoDescriptionInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      saveNewTodo();
    }
  });
});