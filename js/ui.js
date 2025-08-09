function showLoginScreen() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('chat-container').classList.add('hidden');
}

function showChatInterface() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
    
    const userInfoDiv = document.getElementById('current-user-info');
    if (currentUser) {
        userInfoDiv.innerHTML = `Logado como: <strong>${currentUser.username}</strong><br><span>ID: ${currentUser.id}</span>`;
    }
}

function toggleOverlay(overlayId, show, contentGenerator) {
    const overlay = document.getElementById(overlayId);
    if (show) {
        if (contentGenerator) {
            overlay.innerHTML = contentGenerator();
        }
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function addUserToContactsList(chatInfo) {
    const contactList = document.getElementById('contact-list');
    if (document.getElementById(`contact-${chatInfo.id}`)) return;

    const contactDiv = document.createElement('div');
    contactDiv.className = 'contact-item';
    contactDiv.id = `contact-${chatInfo.id}`;
    contactDiv.onclick = () => setActiveChat(chatInfo);

    let html = '';
    if (chatInfo.type === 'group') {
        html = `
            <div class="status-dot"><i class="fa-solid fa-users"></i></div>
            <div><strong>${convertMarkdownToHtml(chatInfo.groupName)}</strong></div>`;
    } else {
        html = `
            <div id="status-${chatInfo.withUserId}" class="status-dot offline"><i class="fa-solid fa-circle"></i></div>
            <div><strong>${chatInfo.withUsername}</strong></div>`;
        listenForStatusUpdates(chatInfo.withUserId);
    }
    contactDiv.innerHTML = html;
    contactList.prepend(contactDiv);
}

function removeContactFromList(chatId) {
    const contactItem = document.getElementById(`contact-${chatId}`);
    if (contactItem) {
        contactItem.remove();
    }
}

function updateContactStatus(userId, status) {
    const statusDot = document.getElementById(`status-${userId}`);
    if (statusDot) {
        statusDot.innerHTML = `<i class="fa-solid fa-circle"></i>`;
        statusDot.classList.toggle('online', status === 'online');
    }
}

function displayMessage(message, currentUserId) {
    const messagesArea = document.getElementById('messages-area');
    const bubble = document.createElement('div');
    bubble.classList.add('message-bubble');
    bubble.classList.add(message.senderId === currentUserId ? 'sent' : 'received');

    let content = '';
    if (message.text) {
        content = convertMarkdownToHtml(message.text);
    } else if (message.imageUrl) {
        content = `<img src="${message.imageUrl}" alt="Imagem enviada">`;
    }
    
    if (activeChat.type === 'group' && message.senderId !== currentUserId) {
        bubble.innerHTML = `<strong class="sender-name">${message.senderName || ''}</strong>${content}`;
    } else {
        bubble.innerHTML = content;
    }
    
    messagesArea.appendChild(bubble);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function buildAddContactPanel() {
    return `
        <div class="overlay-content">
            <button class="close-button" onclick="toggleOverlay('add-contact-overlay', false)">&times;</button>
            <h3>Iniciar uma nova conversa</h3>
            <input type="text" id="search-user-input" placeholder="Buscar por nome de usuário...">
            <div id="search-results" class="scrollable-list"></div>
        </div>`;
}

function displaySearchResults(users) {
    const searchResultsDiv = document.getElementById('search-results');
    searchResultsDiv.innerHTML = '';
    if (!searchResultsDiv) return;
    
    if (users.length === 0) {
        searchResultsDiv.innerHTML = '<p style="padding: 10px;">Nenhum usuário encontrado.</p>';
        return;
    }
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'list-item';
        userDiv.style.justifyContent = 'space-between';
        userDiv.innerHTML = `
            <div>
                <strong>${user.username}</strong><br><small>${user.id}</small>
            </div>
            <button class="action-button add-user-btn" data-user-id='${user.id}' data-user-username='${user.username}'>Conversar</button>
        `;
        searchResultsDiv.appendChild(userDiv);
    });
}

async function buildNewGroupPanelContent() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const userChatsRef = database.ref(`user_chats/${currentUser.id}`);
    const allUsersSnapshot = await database.ref('users').once('value');
    const allUsers = allUsersSnapshot.val();

    let contactsListHtml = '<p style="padding: 10px;">Você precisa ter conversas 1-a-1 para adicionar pessoas a um grupo.</p>';
    
    const directChatsSnapshot = await userChatsRef.orderByChild('type').equalTo('direct').once('value');
    if (directChatsSnapshot.exists()) {
        contactsListHtml = '';
        directChatsSnapshot.forEach(childSnapshot => {
            const chatInfo = childSnapshot.val();
            const contactUser = allUsers ? allUsers[chatInfo.withUserId] : null;
            if (contactUser) {
                 contactsListHtml += `
                    <label class="list-item">
                        <input type="checkbox" value="${contactUser.id}">
                        <span>${contactUser.username} (${contactUser.id})</span>
                    </label>`;
            }
        });
    }

    const listContainer = document.getElementById('group-user-list');
    if(listContainer) listContainer.innerHTML = contactsListHtml;
}

function buildParticipantsPanel(participants) {
    let participantsHtml = '';
    for (const user of participants) {
        participantsHtml += `<div class="list-item">${user.username} (${user.id})</div>`;
    }
    return `
        <div class="overlay-content">
             <button class="close-button" onclick="toggleOverlay('participants-overlay', false)">&times;</button>
             <h3>Participantes</h3>
             <div class="scrollable-list">${participantsHtml}</div>
        </div>
    `;
}
