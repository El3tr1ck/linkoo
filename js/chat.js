let activeChatRef = null;

// --- FUNÇÕES DE BUSCA E INICIALIZAÇÃO ---

function searchUsers(query) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const usersRef = database.ref('users');
    
    usersRef.orderByChild('username').startAt(query).endAt(query + '\uf8ff').once('value', snapshot => {
        const users = [];
        snapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            if (user.id !== currentUser.id) {
                users.push(user);
            }
        });
        displaySearchResults(users);
    });
}

function startChatWith(otherUser) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const chatId = [currentUser.id, otherUser.id].sort().join('_');
    
    const chatDataForCurrentUser = { type: 'direct', withUsername: otherUser.username, withUserId: otherUser.id };
    const chatDataForOtherUser = { type: 'direct', withUsername: currentUser.username, withUserId: currentUser.id };

    database.ref(`user_chats/${currentUser.id}/${chatId}`).set(chatDataForCurrentUser);
    database.ref(`user_chats/${otherUser.id}/${chatId}`).set(chatDataForOtherUser);
}

function loadUserChats(userId) {
    const userChatsRef = database.ref(`user_chats/${userId}`);
    
    // --- ALTERADO: Adicionado para notificações ---
    userChatsRef.on('child_added', snapshot => {
        const chatInfo = { ...snapshot.val(), id: snapshot.key };
        addUserToContactsList(chatInfo);
        
        // --- NOVO: Lógica de notificação para novas mensagens ---
        const messagesRef = database.ref('chats/' + snapshot.key);
        messagesRef.orderByChild('timestamp').startAt(Date.now()).on('child_added', msgSnapshot => {
            const message = msgSnapshot.val();
            const currentUser = JSON.parse(localStorage.getItem('currentUser'));
            if (message && message.senderId !== currentUser.id) {
                 // Verifica se a notificação deve ser exibida
                 if (document.hidden || (activeChat && activeChat.id !== snapshot.key)) {
                    const notificationTitle = chatInfo.type === 'group' ? chatInfo.groupName : chatInfo.withUsername;
                    const notificationBody = message.text ? message.text : 'Enviou uma imagem';
                    showNotification(notificationTitle, `${message.senderName}: ${notificationBody}`);
                 }
            }
        });
    });

    userChatsRef.on('child_removed', snapshot => {
        removeContactFromList(snapshot.key);
    });
}

function listenForStatusUpdates(userId) {
    const userStatusRef = database.ref(`users/${userId}`);
    userStatusRef.on('value', snapshot => {
        const userData = snapshot.val();
        if (userData) {
            updateContactStatus(userId, userData.status);
        }
    });
}

function loadChatMessages(chatId) {
    if (activeChatRef) {
        activeChatRef.off();
    }

    const messagesArea = document.getElementById('messages-area');
    messagesArea.innerHTML = '';
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    const messagesRef = database.ref('chats/' + chatId).orderByChild('timestamp').limitToLast(100);
    activeChatRef = messagesRef;

    // --- ALTERADO: Adicionado 'child_changed' para recibos de leitura e edições ---
    const messageCallback = (snapshot) => {
        const message = { ...snapshot.val(), id: snapshot.key };
        displayMessage(message, currentUser.id);
    };

    const updateCallback = (snapshot) => {
        const message = { ...snapshot.val(), id: snapshot.key };
        updateMessageDisplay(message); // Nova função em ui.js
    };
    
    activeChatRef.on('child_added', messageCallback);
    activeChatRef.on('child_changed', updateCallback);
}

// --- FUNÇÕES DE ENVIO DE MENSAGEM ---

async function sendTextMessage(chatId, text, chatType) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (chatType === 'direct') {
        const otherUserId = chatId.replace(currentUser.id, '').replace('_', '');
        const isBlocked = await checkIfBlocked(otherUserId);
        if (isBlocked) {
            alert("Você não pode enviar mensagens para este usuário, pois você o bloqueou.");
            return;
        }
    }
    const message = { 
        senderId: currentUser.id, 
        senderName: currentUser.username, 
        text: text, 
        timestamp: firebase.database.ServerValue.TIMESTAMP 
    };
    database.ref('chats/' + chatId).push(message);
    setTypingStatus(chatId, false); // --- NOVO ---
}

function handlePhotoUpload(chatId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg, image/png, image/gif';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            alert("A imagem é muito grande! O limite para este método é de 500 KB.");
            return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            sendImageMessage(chatId, reader.result);
        };
    };
    input.click();
}

function sendImageMessage(chatId, base64String) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const message = {
        senderId: currentUser.id,
        senderName: currentUser.username, // --- Adicionado para consistência ---
        imageUrl: base64String,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    database.ref('chats/' + chatId).push(message);
}

// --- NOVO: FUNÇÕES DE INDICADOR DE DIGITANDO ---

function setTypingStatus(chatId, isTyping) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const typingRef = database.ref(`typing_indicators/${chatId}/${currentUser.id}`);
    if (isTyping) {
        typingRef.set(currentUser.username); // Armazena o nome de usuário para fácil acesso
        // O status será removido por um timeout no main.js ou ao enviar a mensagem
    } else {
        typingRef.remove();
    }
}

// --- NOVO: FUNÇÕES DE RECIBO DE LEITURA ---

function markMessagesAsRead(chatId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const messagesRef = database.ref(`chats/${chatId}`);

    messagesRef.limitToLast(20).once('value', snapshot => {
        snapshot.forEach(childSnapshot => {
            const message = childSnapshot.val();
            const messageId = childSnapshot.key;
            // Marca como lida se a mensagem não for minha e ainda não tiver sido lida por mim
            if (message.senderId !== currentUser.id && (!message.readBy || !message.readBy[currentUser.id])) {
                database.ref(`chats/${chatId}/${messageId}/readBy/${currentUser.id}`).set(true);
            }
        });
    });
}

// --- NOVO: FUNÇÕES DE EDIÇÃO E EXCLUSÃO DE MENSAGEM ---
function editMessage(chatId, messageId, newText) {
    const messageRef = database.ref(`chats/${chatId}/${messageId}`);
    messageRef.update({
        text: newText,
        editedAt: firebase.database.ServerValue.TIMESTAMP
    });
}

function deleteMessage(chatId, messageId) {
    database.ref(`chats/${chatId}/${messageId}`).remove();
    // A remoção da UI será tratada pelo listener 'child_removed' que podemos adicionar se necessário
    // ou simplesmente removendo o elemento do DOM diretamente.
    const messageElement = document.getElementById(`msg-${messageId}`);
    if (messageElement) messageElement.remove();
}


// --- FUNÇÕES DE GRUPO ---

function createGroup(groupName, participantIds) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const groupId = database.ref('groups').push().key;

    const participants = {};
    participantIds.forEach(id => { participants[id] = true; });
    participants[currentUser.id] = true;

    const groupData = {
        name: groupName,
        creatorId: currentUser.id,
        participants: participants
    };

    database.ref('groups/' + groupId).set(groupData);

    const chatData = { type: 'group', groupName: groupName };
    Object.keys(participants).forEach(userId => {
        database.ref(`user_chats/${userId}/${groupId}`).set(chatData);
    });
}

function leaveGroup(groupId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`groups/${groupId}/participants/${currentUser.id}`).remove();
    database.ref(`user_chats/${currentUser.id}/${groupId}`).remove();
}

// --- FUNÇÕES DE AÇÃO (BLOQUEAR, APAGAR) ---

function blockUser(otherUserId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).set(true);
}

function unblockUser(otherUserId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).remove();
}

async function checkIfBlocked(otherUserId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const snapshot = await database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).once('value');
    return snapshot.exists();
}

function deleteConversation(chatId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`user_chats/${currentUser.id}/${chatId}`).remove();
}

async function deleteCurrentUserAccount() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    const groupsSnapshot = await database.ref('groups').once('value');
    const groups = groupsSnapshot.val();
    if (groups) {
        for (const groupId in groups) {
            if (groups[groupId].participants && groups[groupId].participants[currentUser.id]) {
                database.ref(`groups/${groupId}/participants/${currentUser.id}`).remove();
            }
        }
    }

    await database.ref('users/' + currentUser.id).remove();
    await database.ref('user_chats/' + currentUser.id).remove();
    await database.ref('blocked_users/' + currentUser.id).remove();

    localStorage.clear();
    window.location.reload();
}

// --- FUNÇÕES DE IDENTIDADE ---

function linkGoogleAccount() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithRedirect(provider);
}

function updateUserBio(bio) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/bio`).set(bio);
}

function addUserLink(url) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/links`).push({ url: url });
}

function removeUserLink(linkId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/links/${linkId}`).remove();
}

function submitUserRating(ratedUserId, rating) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const ratingRef = database.ref(`users/${ratedUserId}/ratings`);
    const ratedByRef = database.ref(`users/${ratedUserId}/ratedBy/${currentUser.id}`);

    ratingRef.transaction((currentRatings) => {
        if (currentRatings === null) {
            return { sum: rating, count: 1 };
        } else {
            return { sum: (currentRatings.sum || 0) + rating, count: (currentRatings.count || 0) + 1 };
        }
    });

    ratedByRef.set(true);
}

function convertMarkdownToHtml(text) {
    if (!text) return '';
    const rawHtml = marked.parse(text);
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);
    return sanitizedHtml;
}
