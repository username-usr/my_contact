document.addEventListener("DOMContentLoaded", () => {
  // Ensure a username is set for API calls, default to 'guest_user'
  // This is crucial for linking contacts to a user, even if not explicitly asked
  if (!localStorage.getItem("username")) {
    localStorage.setItem("username", "guest_user");
  }

  fetchDashboardData(); // Always fetch dashboard data on load

  // Set up periodic refresh for dashboard data (including notifications)
  setInterval(fetchDashboardData, 30000);

  const addContactBtn = document.getElementById("addContactBtn");
  const contactInputModal = document.getElementById("contactInputModal");
  const closeContactInputModalBtn = document.getElementById(
    "closeContactInputModal"
  );
  const contactMessageInput = document.getElementById("contactMessageInput");
  const sendContactMessageButton = document.getElementById(
    "sendContactMessageButton"
  );
  const contactChatMessages = document.getElementById("contactChatMessages");
  const saveContactButton = document.getElementById("saveContactButton");

  let currentContactData = {}; // Stores data collected for the current contact

  addContactBtn.addEventListener("click", () => {
    contactInputModal.classList.add("active");
    // Reset chat and collected data when opening
    contactChatMessages.innerHTML = `
            <div class="message ai">
                <div class="message-content">Welcome! Please tell me about the person you met. Include their name, how you met, where you met, and a brief summary of your conversation.</div>
                <div class="message-timestamp"></div>
            </div>
        `;
    contactMessageInput.value = "";
    currentContactData = {};
    saveContactButton.style.display = "none"; // Hide save button initially
    addTimestampToLastMessage(contactChatMessages); // Add timestamp to initial AI message
  });

  closeContactInputModalBtn.addEventListener("click", () => {
    contactInputModal.classList.remove("active");
  });

  function sendContactMessage() {
    const message = contactMessageInput.value.trim();
    const username = localStorage.getItem("username"); // Get username from localStorage

    if (!message || !username) {
      return;
    }

    addMessageToContactChat("user", message);
    contactMessageInput.value = "";

    // Send message to new AI endpoint for contact processing
    fetch("/api/add-contact-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        message,
        collectedContactData: currentContactData, // Send previously collected data for context
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          addMessageToContactChat("ai", data.aiResponse);
          // Merge new extracted data with previously collected data
          currentContactData = { ...currentContactData, ...data.extractedData };

          // Logic to decide when to show save button (e.g., when Name, How Met, Where Met, Summary are present)
          const requiredFields = [
            "name",
            "how_met",
            "where_met",
            "conversation_summary",
          ];
          const allRequiredPresent = requiredFields.every(
            (field) => currentContactData[field]
          );

          // FIX: The save contact button should appear as soon as the core fields are present.
          // The x_score is optional and defaults on the server if not provided.
          if (allRequiredPresent) {
            saveContactButton.style.display = "block";
          } else {
            saveContactButton.style.display = "none";
          }
        } else {
          console.error("Error from AI contact endpoint:", data.error);
          addMessageToContactChat(
            "ai",
            data.error || "Sorry, an error occurred with the AI processing."
          );
        }
      })
      .catch((error) => {
        console.error("Network error sending contact message:", error);
        addMessageToContactChat(
          "ai",
          "Sorry, a network error occurred. Please try again."
        );
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

  // Helper to add timestamp to initial AI message
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

  // Function to save contact to database
  saveContactButton.addEventListener("click", () => {
    const username = localStorage.getItem("username"); // Get username from localStorage
    if (!username) {
      alert(
        "A username is required to save contacts. Please ensure localStorage is working."
      );
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
          contactInputModal.classList.remove("active"); // Close modal
          fetchDashboardData(); // Refresh dashboard data after saving contact
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

  // --- Dashboard Data Fetching (updated to include notifications) ---
  function fetchDashboardData() {
    const username = localStorage.getItem("username");
    fetch(`/api/dashboard?username=${username}`) // Pass username for notifications
      .then((response) => response.json())
      .then((data) => {
        updateTodoList(data.todoList);
        updateNotifications(data.notifications); // Handle notifications
        updateTemplates(data.templates);
      })
      .catch((error) => {
        console.error("Error fetching dashboard data:", error);
      });
  }

  // In dashboard.js, inside the DOMContentLoaded listener

function updateTodoList(todoList) {
    const todoListContainer = document.getElementById('todoList');
    todoListContainer.innerHTML = '';

    if (!todoList || todoList.length === 0) {
        todoListContainer.textContent = 'No to-do items.';
        return;
    }

    todoList.forEach(task => {
        if (!task.completed) { // Only display uncompleted tasks as per original logic
            const todoItem = document.createElement('div');
            todoItem.className = `todo-item`; // Remove priority class here for random color

            // Generate a random light color
            const randomHue = Math.floor(Math.random() * 360); // 0-359
            const randomLightColor = `hsl(${randomHue}, 70%, 85%)`; // Light color using HSL

            // Apply the random color as a left border using inline style
            // This will override any .priority class border-left styles if they conflict.
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

// ... (rest of your dashboard.js code) ...

  function updateNotifications(notifications) {
    const notificationsContainer = document.getElementById("notifications");
    notificationsContainer.innerHTML = "";

    if (!notifications || notifications.length === 0) {
      notificationsContainer.textContent = "No new notifications.";
      return;
    }

    notifications.forEach((notification) => {
      const notificationElement = document.createElement("div");
      // Add classes based on notification type for styling
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
    const username = localStorage.getItem("username"); // Get username from localStorage
    fetch("/api/update-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId,
        completed,
        username, // Add username to the body
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

  // --- New To-Do Functionality ---
  const addTodoBtn = document.getElementById("addTodoBtn");
  const addTodoModal = document.getElementById("addTodoModal");
  const closeTodoModalBtn = document.getElementById("closeTodoModal");
  const todoDescriptionInput = document.getElementById("todoDescriptionInput");
  const saveTodoButton = document.getElementById("saveTodoButton");

  addTodoBtn.addEventListener("click", () => {
    addTodoModal.classList.add("active");
    todoDescriptionInput.value = ""; // Clear input when opening
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
        priority: "low", // Default priority for new tasks from dashboard
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          alert("To-Do item added successfully!");
          addTodoModal.classList.remove("active");
          fetchDashboardData(); // Refresh the to-do list
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
