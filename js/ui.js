// NO ARQUIVO: js/ui.js (VERSÃO COMPLETA E CORRIGIDA)

function showLoginScreen() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('chat-container').classList.add('hidden');
}

function showChatInterface() {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
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
        if (status === 'online') {
            statusDot.classList.add('online');
        } else {
            statusDot.classList.remove('online');
        }
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
    
    // Adiciona o nome do remetente para mensagens de grupo recebidas
    if (activeChat.type === 'group' && message.senderId !== currentUserId) {
        bubble.innerHTML = `<strong class="sender-name">${message.senderName || ''}</strong>${content}`;
    } else {
        bubble.innerHTML = content;
    }
    
    messagesArea.appendChild(bubble);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// --- NOVOS PAINÉIS (OVERLAYS) ---

function buildAddContactPanel() {
    return `
        <div class="overlay-content">
            <button class="close-button" onclick="toggleOverlay('add-contact-overlay', false)">&times;</button>
            <h3>Iniciar uma nova conversa</h3>
            <input type="text" id="search-user-input" placeholder="Buscar por nome de usuário...">
            <div id="search-results" class="scrollable-list"></div>
        </div>`;
}

function buildNewGroupPanel() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    let userListHtml = '';
    database.ref('users').once('value', snapshot => {
        snapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            if (user.id !== currentUser.id) {
                userListHtml += `
                    <label class="list-item">
                        <input type="checkbox" value="${user.id}">
                        <span>${user.username} (${user.id})</span>
                    </label>`;
            }
        });
        document.getElementById('group-user-list').innerHTML = userListHtml;
    });

    return `
        <div class="overlay-content">
            <button class="close-button" onclick="toggleOverlay('new-group-overlay', false)">&times;</button>
            <h3>Criar Novo Grupo</h3>
            <input type="text" id="group-name-input" placeholder="Nome do Grupo (suporta Markdown)">
            <h4>Selecionar Participantes:</h4>
            <div id="group-user-list" class="scrollable-list"></div>
            <button id="create-group-button-action" class="action-button">Criar Grupo</button>
        </div>`;
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
