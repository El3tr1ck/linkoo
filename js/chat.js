--- START OF FILE chat.js ---

let activeChatRef = null;

// --- FUNÇÕES DE BUSCA E INICIALIZAÇÃO ---

function searchUsers(query) {
    // ALTERADO: de sessionStorage para localStorage
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
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
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
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    const messagesRef = database.ref('chats/' + chatId).orderByChild('timestamp').limitToLast(100);
    activeChatRef = messagesRef;

    activeChatRef.on('child_added', (snapshot) => {
        const message = snapshot.val();
        displayMessage(message, currentUser.id);
    });
}

// --- FUNÇÕES DE ENVIO DE MENSAGEM ---

async function sendTextMessage(chatId, text, chatType) {
    // ALTERADO: de sessionStorage para localStorage
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
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const message = {
        senderId: currentUser.id,
        imageUrl: base64String,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };
    database.ref('chats/' + chatId).push(message);
}

// --- FUNÇÕES DE GRUPO ---

function createGroup(groupName, participantIds) {
    // ALTERADO: de sessionStorage para localStorage
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
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`groups/${groupId}/participants/${currentUser.id}`).remove();
    database.ref(`user_chats/${currentUser.id}/${groupId}`).remove();
}

// --- FUNÇÕES DE AÇÃO (BLOQUEAR, APAGAR) ---

function blockUser(otherUserId) {
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).set(true);
}

function unblockUser(otherUserId) {
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).remove();
}

async function checkIfBlocked(otherUserId) {
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const snapshot = await database.ref(`blocked_users/${currentUser.id}/${otherUserId}`).once('value');
    return snapshot.exists();
}

function deleteConversation(chatId) {
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`user_chats/${currentUser.id}/${chatId}`).remove();
}

async function deleteCurrentUserAccount() {
    // ALTERADO: de sessionStorage para localStorage
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

    // ALTERADO: de sessionStorage para localStorage para limpar os dados persistentes
    localStorage.clear();
    window.location.reload();
}

// --- NOVAS FUNÇÕES DE IDENTIDADE ---

async function linkGoogleAccount() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await firebase.auth().signInWithPopup(provider);
        const email = result.user.email;
        // ALTERADO: de sessionStorage para localStorage
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (email && currentUser) {
            await database.ref(`users/${currentUser.id}/googleEmail`).set(email);
            alert("Conta Google vinculada com sucesso!");
            showIdentityPanel(currentUser.id); // Recarrega o painel
        }
    } catch (error) {
        console.error("Erro ao vincular conta Google:", error);
        alert("Não foi possível vincular a conta Google. Erro: " + error.message);
    }
}

function updateUserBio(bio) {
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/bio`).set(bio);
}

function addUserLink(url) {
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/links`).push({ url: url });
}

function removeUserLink(linkId) {
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    database.ref(`users/${currentUser.id}/links/${linkId}`).remove();
}

function submitUserRating(ratedUserId, rating) {
    // ALTERADO: de sessionStorage para localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const ratingRef = database.ref(`users/${ratedUserId}/ratings`);
    const ratedByRef = database.ref(`users/${ratedUserId}/ratedBy/${currentUser.id}`);

    // Usa uma transação para garantir que a soma e a contagem sejam atualizadas atomicamente
    ratingRef.transaction((currentRatings) => {
        if (currentRatings === null) {
            return { sum: rating, count: 1 };
        } else {
            return { sum: (currentRatings.sum || 0) + rating, count: (currentRatings.count || 0) + 1 };
        }
    });

    ratedByRef.set(true); // Marca que o usuário atual já avaliou
}

function convertMarkdownToHtml(text) {
    if (!text) return '';
    const rawHtml = marked.parse(text);
    const sanitizedHtml = DOMPurify.sanitize(rawHtml);
    return sanitizedHtml;
}
--- END OF FILE chat.js ---
