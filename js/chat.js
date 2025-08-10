let activeChatRef = null;
let typingTimeout = null;

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
    
    const chatDataForCurrentUser = { type: 'direct', withUsername: otherUser.username, withUserId: otherUser.id, unreadCount: 0 };
    const chatDataForOtherUser = { type: 'direct', withUsername: currentUser.username, withUserId: currentUser.id, unreadCount: 0 };

    database.ref(`user_chats/${currentUser.id}/${chatId}`).set(chatDataForCurrentUser);
    database.ref(`user_chats/${otherUser.id}/${chatId}`).set(chatDataForOtherUser);
}

function loadUserChats(userId) {
    const userChatsRef = database.ref(`user_chats/${userId}`);
    // ATUALIZADO: para ouvir modificações também (para o contador de não lidas)
    userChatsRef.on('child_added', snapshot => {
        const chatInfo = { ...snapshot.val(), id: snapshot.key };
        addUserToContactsList(chatInfo);
    });
     userChatsRef.on('child_changed', snapshot => {
        const chatInfo = { ...snapshot.val(), id: snapshot.key };
        updateContactUnreadCount(chatInfo.id, chatInfo.unreadCount);
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

    activeChatRef.on('child_added', (snapshot) => {
        const message = { ...snapshot.val(), id: snapshot.key };
        displayMessage(message, currentUser.id);
        // NOVO: Atualiza o status da mensagem para 'lido'
        if (message.senderId !== currentUser.id && message.status !== 'read') {
            database.ref(`chats/${chatId}/${message.id}`).update({ status: 'read' });
        }
    });

    // NOVO: Listener para edição e status da mensagem
    activeChatRef.on('child_changed', (snapshot) => {
        const message = { ...snapshot.val(), id: snapshot.key };
        updateMessageInUI(message);
    });
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
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'sent', // NOVO: Status inicial
        isEdited: false // NOVO: Flag de edição
    };
    const messageRef = database.ref('chats/' + chatId).push();
    messageRef.set(message);

    // NOVO: Incrementa o contador de não lidas do outro usuário
    incrementUnreadCount(chatId, currentUser.id);
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
        imageUrl: base64String,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        status: 'sent', // NOVO: Status inicial
        isEdited: false
    };
    database.ref('chats/' + chatId).push(message);
    // NOVO: Incrementa o contador de não lidas
    incrementUnreadCount(chatId, currentUser.id);
}

// --- NOVAS FUNÇÕES: EDIÇÃO E EXCLUSÃO DE MENSAGENS ---
function editMessage(chatId, messageId, newText) {
    const messageRef = database.ref(`chats/${chatId}/${messageId}`);
    messageRef.update({
        text: newText,
        isEdited: true
    });
}

function deleteMessage(chatId, messageId) {
    const messageRef = database.ref(`chats/${chatId}/${messageId}`);
    messageRef.update({
        text: '🗑️ Mensagem apagada',
        imageUrl: null, // Remove a imagem se houver
        isDeleted: true // Flag para tratar na UI
    });
}


// --- NOVAS FUNÇÕES: RECIBOS E CONTADOR ---
function incrementUnreadCount(chatId, senderId) {
    const userChatsRef = database.ref('user_chats');
    // Para chats diretos
    const participantIds = chatId.split('_');
    participantIds.forEach(userId => {
        if (userId !== senderId) {
            const userChatRef = userChatsRef.child(userId).child(chatId);
            userChatRef.child('unreadCount').transaction(count => (count || 0) + 1);
        }
    });
    // Para grupos
    database.ref(`groups/${chatId}/participants`).once('value', snapshot => {
        if (!snapshot.exists()) return;
        snapshot.forEach(participantSnap => {
            const userId = participantSnap.key;
            if (userId !== senderId) {
                const userChatRef = userChatsRef.child(userId).child(chatId);
                userChatRef.child('unreadCount').transaction(count => (count || 0) + 1);
            }
        });
    });
}

function resetUnreadCount(chatId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`user_chats/${currentUser.id}/${chatId}/unreadCount`).set(0);
}


// --- NOVAS FUNÇÕES: INDICADOR DE "DIGITANDO" ---
function setTypingStatus(chatId, isTyping) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const typingRef = database.ref(`typing_status/${chatId}/${currentUser.id}`);
    if (isTyping) {
        typingRef.set(currentUser.username);
        // Remove o status após um tempo para evitar "presos"
        setTimeout(() => typingRef.remove(), 2000); 
    } else {
        typingRef.remove();
    }
}

function listenForTypingStatus(chatId) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const typingRef = database.ref(`typing_status/${chatId}`);
    
    typingRef.on('value', snapshot => {
        const typingUsers = [];
        snapshot.forEach(childSnap => {
            if(childSnap.key !== currentUser.id){
                typingUsers.push(childSnap.val());
            }
        });
        updateTypingIndicator(typingUsers);
    });
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

    const chatData = { type: 'group', groupName: groupName, unreadCount: 0 };
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
