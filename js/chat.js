// --- START OF FILE chat.js (CORRIGIDO) ---

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

// ALTERADO: A função agora usa uma atualização atômica para maior confiabilidade.
function startChatWith(otherUser) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const chatId = [currentUser.id, otherUser.id].sort().join('_');
    
    const chatDataForCurrentUser = { type: 'direct', withUsername: otherUser.username, withUserId: otherUser.id };
    const chatDataForOtherUser = { type: 'direct', withUsername: currentUser.username, withUserId: currentUser.id };

    const updates = {};
    updates[`/user_chats/${currentUser.id}/${chatId}`] = chatDataForCurrentUser;
    updates[`/user_chats/${otherUser.id}/${chatId}`] = chatDataForOtherUser;

    database.ref().update(updates).catch(error => {
        console.error("Falha ao iniciar o chat:", error);
        alert("Não foi possível iniciar a conversa. Verifique sua conexão ou tente novamente.");
    });
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

// ALTERADO: A função agora também deleta o usuário da autenticação do Firebase.
async function deleteCurrentUserAccount() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    const authUser = firebase.auth().currentUser;

    // Remove o usuário de todos os grupos dos quais participa
    const groupsSnapshot = await database.ref('groups').orderByChild(`participants/${currentUser.id}`).equalTo(true).once('value');
    if (groupsSnapshot.exists()) {
        const updates = {};
        groupsSnapshot.forEach(groupSnapshot => {
            updates[`/groups/${groupSnapshot.key}/participants/${currentUser.id}`] = null;
        });
        await database.ref().update(updates);
    }

    // Remove os dados do usuário do banco de dados
    await database.ref('users/' + currentUser.id).remove();
    await database.ref('user_chats/' + currentUser.id).remove();
    await database.ref('blocked_users/' + currentUser.id).remove();

    // Tenta apagar o usuário da autenticação (se houver um logado via Google)
    if (authUser) {
        try {
            await authUser.delete();
        } catch (error) {
            console.error("Erro ao apagar a conta de autenticação:", error);
            alert("Seus dados foram removidos, mas ocorreu um erro ao desvincular a conta Google. Pode ser necessário um novo login para completar a ação.");
        }
    }

    // Limpa os dados locais e recarrega a página
    localStorage.clear();
    sessionStorage.clear(); // Limpa também a session storage por segurança
    window.location.reload();
}


// --- NOVAS FUNÇÕES DE IDENTIDADE ---

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
