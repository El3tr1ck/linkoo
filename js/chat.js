// NO ARQUIVO: js/chat.js (SUBSTITUIR TUDO)
let currentChatListener = null;

// --- FUNÇÕES DE BUSCA E INICIALIZAÇÃO ---

function searchUsers(query) { /* ... (sem alterações) ... */ }

function startChatWith(otherUser) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const chatId = [currentUser.id, otherUser.id].sort().join('_');
    
    const chatDataForCurrentUser = { type: 'direct', withUsername: otherUser.username, withUserId: otherUser.id };
    const chatDataForOtherUser = { type: 'direct', withUsername: currentUser.username, withUserId: currentUser.id };

    database.ref(`user_chats/${currentUser.id}/${chatId}`).set(chatDataForCurrentUser);
    database.ref(`user_chats/${otherUser.id}/${chatId}`).set(chatDataForOtherUser);
}

function loadUserChats(userId) {
    const userChatsRef = database.ref(`user_chats/${userId}`);
    userChatsRef.on('child_added', snapshot => {
        const chatInfo = { ...snapshot.val(), id: snapshot.key };
        addUserToContactsList(chatInfo);
    });
    userChatsRef.on('child_removed', snapshot => {
        removeContactFromList(snapshot.key);
    });
}

function listenForStatusUpdates(userId) { /* ... (sem alterações) ... */ }

function loadChatMessages(chatId) { /* ... (sem alterações) ... */ }

// --- FUNÇÕES DE ENVIO DE MENSAGEM ---

async function sendTextMessage(chatId, text, chatType) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

    // Para chats diretos, verifica se o usuário está bloqueado
    if (chatType === 'direct') {
        const otherUserId = chatId.replace(currentUser.id, '').replace('_', '');
        const isBlocked = await checkIfBlocked(otherUserId);
        if (isBlocked) {
            alert("Você não pode enviar mensagens para este usuário, pois você o bloqueou.");
            return;
        }
    }
    
    const message = { senderId: currentUser.id, senderName: currentUser.username, text: text, timestamp: firebase.database.ServerValue.TIMESTAMP };
    database.ref('chats/' + chatId).push(message);
}

function sendImageMessage(chatId, base64String) { /* ... (sem alterações) ... */ }

// --- NOVAS FUNÇÕES DE GRUPO ---

function createGroup(groupName, participantIds) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const groupId = database.ref('groups').push().key;

    const participants = {};
    participantIds.forEach(id => { participants[id] = true; });
    participants[currentUser.id] = true; // Adiciona o criador

    const groupData = {
        name: groupName,
        creatorId: currentUser.id,
        participants: participants
    };

    database.ref('groups/' + groupId).set(groupData);

    // Adiciona o grupo na lista de conversas de cada participante
    const chatData = { type: 'group', groupName: groupName };
    Object.keys(participants).forEach(userId => {
        database.ref(`user_chats/${userId}/${groupId}`).set(chatData);
    });
}

function leaveGroup(groupId) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    // Remove o usuário da lista de participantes do grupo
    database.ref(`groups/${groupId}/participants/${currentUser.id}`).remove();
    // Remove o grupo da lista de conversas do usuário
    database.ref(`user_chats/${currentUser.id}/${groupId}`).remove();
}

// --- NOVAS FUNÇÕES DE AÇÃO (BLOQUEAR, APAGAR) ---

function blockUser(otherUserId) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).set(true);
}

function unblockUser(otherUserId) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).remove();
}

async function checkIfBlocked(otherUserId) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    const snapshot = await database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).once('value');
    return snapshot.exists();
}

function deleteConversation(chatId) {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));
    database.ref(`user_chats/${currentUser.id}/${chatId}`).remove();
}

function convertMarkdownToHtml(text) {
    // 1. Converte o Markdown para HTML usando a biblioteca 'marked'.
    const rawHtml = marked.parse(text);
    // 2. SANITIZA o HTML para remover qualquer código malicioso (XSS). ESSENCIAL PARA SEGURANÇA.
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);
    return sanitizedHtml;
}
