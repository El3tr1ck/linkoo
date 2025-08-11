let activeChatRef = null;

async function deleteCurrentUserAccount() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) return;

    try {
        // Passo 1: Identificar os grupos do usuário a partir de /user_chats/$userId
        const userChatsSnapshot = await database.ref(`user_chats/${currentUser.id}`).once('value');
        const userChats = userChatsSnapshot.val();

        if (userChats) {
            const groupPromises = [];
            for (const chatId in userChats) {
                if (userChats[chatId].type === 'group') {
                    groupPromises.push(
                        database.ref(`groups/${chatId}/participants/${currentUser.id}`).remove()
                    );
                }
            }
            await Promise.all(groupPromises);
        }

        // Passo 2: Remover os dados do usuário
        await Promise.all([
            database.ref(`users/${currentUser.id}`).remove(),
            database.ref(`user_chats/${currentUser.id}`).remove(),
            database.ref(`blocked_users/${currentUser.id}`).remove()
        ]);

        // Passo 3: Limpar o localStorage e recarregar a página
        localStorage.clear();
        window.location.reload();
    } catch (error) {
        console.error("Erro ao apagar a conta:", error);
        alert("Ocorreu um erro ao apagar sua conta: " + error.message);
    }
}

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
