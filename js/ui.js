--- START OF FILE ui.js ---

// --- FUNÇÕES DE UI (GERAIS) ---

function showLoginScreen() {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('chat-container').classList.add('hidden');
}

function showChatInterface() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('chat-container').classList.remove('hidden');
    
    const userInfoDiv = document.getElementById('current-user-info');
    if (currentUser) {
        userInfoDiv.innerHTML = `Logado como: <strong>${currentUser.username}</strong><br><span>ID: ${currentUser.id}</span>`;
    }
}

function toggleOverlay(overlayId, show) {
    const overlay = document.getElementById(overlayId);
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
        overlay.innerHTML = ''; // Limpa o conteúdo ao fechar
    }
}

// --- FUNÇÕES DA LISTA DE CONTATOS ---

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
    if (contactItem) contactItem.remove();
}

function updateContactStatus(userId, status) {
    const statusDot = document.getElementById(`status-${userId}`);
    if (statusDot) {
        statusDot.innerHTML = `<i class="fa-solid fa-circle"></i>`;
        statusDot.classList.toggle('online', status === 'online');
    }
}

// --- FUNÇÕES DA ÁREA DE MENSAGENS ---

// --- ALTERADO: Função principal de exibição de mensagens ---
function displayMessage(message, currentUserId) {
    if (document.getElementById(`msg-${message.id}`)) return; // Evita duplicatas

    const messagesArea = document.getElementById('messages-area');
    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.classList.add('message-bubble-wrapper');
    bubbleWrapper.id = `msg-${message.id}`;

    const isSent = message.senderId === currentUserId;
    bubbleWrapper.classList.add(isSent ? 'sent' : 'received');

    let contentHtml = '';
    if (message.text) {
        contentHtml = convertMarkdownToHtml(message.text);
    } else if (message.imageUrl) {
        contentHtml = `<img src="${message.imageUrl}" alt="Imagem enviada">`;
    }

    const senderNameHtml = (activeChat.type === 'group' && !isSent) 
        ? `<strong class="sender-name clickable-name" data-userid="${message.senderId}">${message.senderName || ''}</strong>` 
        : '';
    
    const readReceiptHtml = getReadReceiptIcon(message, currentUserId);
    const editedHtml = message.editedAt ? '<span class="edited-label">(editado)</span>' : '';
    const timestamp = new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // --- NOVO: Menu de opções para mensagens enviadas ---
    const messageOptionsHtml = isSent ? `
        <div class="message-options">
            <i class="fa-solid fa-ellipsis-vertical options-trigger"></i>
            <div class="options-menu hidden">
                <button class="edit-message-btn" data-message-id="${message.id}" data-chat-id="${activeChat.id}">Editar</button>
                <button class="delete-message-btn danger" data-message-id="${message.id}" data-chat-id="${activeChat.id}">Apagar</button>
            </div>
        </div>
    ` : '';

    bubbleWrapper.innerHTML = `
        <div class="message-bubble">
            ${senderNameHtml}
            <div class="message-content">${contentHtml}</div>
            <div class="message-meta">
                ${editedHtml}
                <span class="timestamp">${timestamp}</span>
                ${isSent ? `<span class="read-receipt" id="receipt-${message.id}">${readReceiptHtml}</span>` : ''}
            </div>
        </div>
        ${messageOptionsHtml}
    `;
    
    messagesArea.appendChild(bubbleWrapper);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// --- NOVO: Função para atualizar uma mensagem existente (edição, recibos) ---
function updateMessageDisplay(message) {
    const messageElement = document.getElementById(`msg-${message.id}`);
    if (!messageElement) return;

    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const isSent = message.senderId === currentUser.id;

    // Atualiza texto se foi editado
    if (message.editedAt) {
        const contentDiv = messageElement.querySelector('.message-content');
        if (contentDiv) contentDiv.innerHTML = convertMarkdownToHtml(message.text);
        
        const metaDiv = messageElement.querySelector('.message-meta');
        if (metaDiv && !metaDiv.querySelector('.edited-label')) {
            const editedSpan = document.createElement('span');
            editedSpan.className = 'edited-label';
            editedSpan.textContent = '(editado)';
            metaDiv.prepend(editedSpan);
        }
    }

    // Atualiza recibo de leitura
    if (isSent) {
        const receiptSpan = document.getElementById(`receipt-${message.id}`);
        if (receiptSpan) {
            receiptSpan.innerHTML = getReadReceiptIcon(message, currentUser.id);
        }
    }
}

// --- NOVO: Função auxiliar para obter o ícone do recibo ---
function getReadReceiptIcon(message, currentUserId) {
    if (message.senderId !== currentUserId) return '';
    
    const otherUserIds = activeChat.type === 'direct' 
        ? [activeChat.withUserId]
        : Object.keys(activeChat.participants || {}).filter(id => id !== currentUserId);

    const hasReadAll = otherUserIds.length > 0 && otherUserIds.every(id => message.readBy && message.readBy[id]);

    if (hasReadAll) {
        return '<i class="fa-solid fa-check-double read"></i>'; // Lida (azul)
    } else if (message.readBy) {
        return '<i class="fa-solid fa-check-double"></i>'; // Entregue/lida por alguns
    } else {
        return '<i class="fa-solid fa-check"></i>'; // Enviada
    }
}

// --- NOVO: Função para atualizar o indicador de "digitando" ---
function updateTypingIndicator(typingUsers) {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;

    if (typingUsers.length === 0) {
        indicator.textContent = '';
        indicator.classList.add('hidden');
    } else if (typingUsers.length === 1) {
        indicator.textContent = `${typingUsers[0]} está digitando...`;
        indicator.classList.remove('hidden');
    } else {
        indicator.textContent = `${typingUsers.length} pessoas estão digitando...`;
        indicator.classList.remove('hidden');
    }
}

// --- FUNÇÕES DE CONSTRUÇÃO DE PAINÉIS (OVERLAYS) ---

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
    if (!searchResultsDiv) return;
    searchResultsDiv.innerHTML = '';
    
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
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
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

// --- NOVO: Painel para editar mensagem ---
function buildEditMessagePanel(messageId, chatId, currentText) {
    return `
    <div class="overlay-content">
        <button class="close-button" onclick="toggleOverlay('edit-message-overlay', false)">&times;</button>
        <h3>Editar Mensagem</h3>
        <textarea id="edit-message-textarea" class="message-input" rows="3">${currentText}</textarea>
        <button id="save-edit-button" class="action-button" data-message-id="${messageId}" data-chat-id="${chatId}">Salvar Alterações</button>
    </div>
    `;
}


// --- FUNÇÃO MESTRA PARA O PAINEL DE IDENTIDADE ---

async function buildIdentityPanel(userId) {
    const me = JSON.parse(localStorage.getItem('currentUser'));
    const isMyProfile = userId === me.id;

    const userRef = database.ref(`users/${userId}`);
    const snapshot = await userRef.once('value');
    
    if (!snapshot.exists()) {
        console.error("Usuário não encontrado com o ID:", userId);
        return `<div class="overlay-content"><button class="close-button" onclick="toggleOverlay('identity-overlay', false)">&times;</button><h3>Erro</h3><p>Usuário não encontrado.</p></div>`;
    }
    const userData = snapshot.val();
    
    const joinDate = userData.createdAt ? new Date(userData.createdAt).toLocaleDateString('pt-BR') : 'Desconhecida';
    let linksHtml = 'Nenhum link adicionado.';
    if (userData.links) {
        linksHtml = Object.entries(userData.links).map(([key, value]) => `
            <div class="link-item">
                <a href="${value.url}" target="_blank">
                    <img src="https://www.google.com/s2/favicons?sz=32&domain_url=${value.url}" alt="ícone">
                    <span>${value.url}</span>
                </a>
                ${isMyProfile ? `<button class="icon-button" onclick="removeUserLink('${key}')">&times;</button>` : ''}
            </div>
        `).join('');
    }

    let ratingHtml = '';
    const avgRating = userData.ratings ? (userData.ratings.sum / userData.ratings.count).toFixed(1) : '0.0';
    const totalRatings = userData.ratings ? userData.ratings.count : 0;
    const hasRated = userData.ratedBy && userData.ratedBy[me.id];

    if (isMyProfile) {
        ratingHtml = `<div class="rating-summary">Sua Média: <strong>${avgRating}</strong> <i class="fa-solid fa-star"></i> (${totalRatings} avaliações)</div>`;
    } else if (hasRated) {
        ratingHtml = `<div class="rating-summary">Você já avaliou este usuário. Média: <strong>${avgRating}</strong> <i class="fa-solid fa-star"></i></div>`;
    } else {
        ratingHtml = `
            <h4>Avalie este usuário:</h4>
            <div class="star-rating" data-userid="${userId}">
                ${[...Array(10)].map((_, i) => `<i class="fa-regular fa-star" data-value="${i + 1}"></i>`).join('')}
            </div>
            <button id="submit-rating-btn" class="action-button hidden">Enviar Avaliação</button>
        `;
    }
    
    const panelHtml = `
    <div class="overlay-content">
        <button class="close-button" onclick="toggleOverlay('identity-overlay', false)">&times;</button>
        <h3>Identidade de ${userData.username}</h3>
        <div class="scrollable-list" style="padding: 10px;">
            <div class="identity-info-grid">
                <i class="fa-solid fa-user"></i> <span>${userData.username}</span>
                <i class="fa-solid fa-hashtag"></i> <span>${userData.id}</span>
                <i class="fa-solid fa-calendar-alt"></i> <span>Entrou em: ${joinDate}</span>
                ${userData.googleEmail ? `<i class="fa-brands fa-google"></i> <span>${userData.googleEmail}</span>` : ''}
            </div>
            
            ${!isMyProfile && userData.googleEmail ? '' : (isMyProfile && !userData.googleEmail ? '<button id="link-google-btn" class="google-signin-btn action-button"><i class="fa-brands fa-google"></i> Vincular Conta Google</button>' : '')}
            
            <hr>
            <h4>Biografia</h4>
            ${isMyProfile 
                ? `<textarea id="bio-textarea" placeholder="Conte um pouco sobre você...">${userData.bio || ''}</textarea><button id="save-bio-btn" class="action-button">Salvar Bio</button>` 
                : `<p>${convertMarkdownToHtml(userData.bio) || 'Nenhuma biografia definida.'}</p>`
            }
            
            <hr>
            <h4>Links</h4>
            ${linksHtml}
            ${isMyProfile 
                ? `<div style="display: flex; gap: 10px; margin-top: 10px;"><input type="text" id="new-link-input" placeholder="https://exemplo.com"><button id="add-link-btn" class="action-button">Add</button></div>` 
                : ''
            }
            <hr>
            ${ratingHtml}
        </div>
    </div>
    `;
    
    return panelHtml;
}

// --- NOVO: Função para notificações ---
function showNotification(title, body) {
    if (!('Notification' in window)) {
        console.log("Este navegador não suporta notificações de desktop.");
        return;
    }

    if (Notification.permission === "granted") {
        new Notification(title, { body: body, icon: './favicon.ico' });
    }
}
--- END OF FILE ui.js ---
