let activeChat = null;
let typingTimer = null;
let currentUser = null;

function initializeAppForUser(user) {
    const localUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!localUser) return;
    setupPresence(localUser.id);
    showChatInterface();
    loadUserChats(localUser.id);
}

async function setActiveChat(chatInfo) {
    activeChat = chatInfo;
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`contact-${chatInfo.id}`)?.classList.add('active');
    const chatHeaderUsername = document.getElementById('chat-header-username');
    const chatHeaderDetails = document.getElementById('chat-header-details');
    const optionsMenu = document.getElementById('chat-options-menu');
    optionsMenu.innerHTML = '';
    chatHeaderUsername.dataset.userid = '';
    if (chatInfo.type === 'direct') {
        chatHeaderUsername.dataset.userid = chatInfo.withUserId;
    }
    if (chatInfo.type === 'direct') {
        chatHeaderUsername.innerHTML = chatInfo.withUsername;
        chatHeaderDetails.innerHTML = chatInfo.withUserId;
        chatHeaderDetails.dataset.originalText = chatInfo.withUserId;
        chatHeaderDetails.onclick = null;
        chatHeaderDetails.style.cursor = 'default';
        const isBlocked = await checkIfBlocked(chatInfo.withUserId);
        optionsMenu.innerHTML = `<button id="block-user-button"><i class="fa-solid fa-ban"></i> ${isBlocked ? 'Desbloquear' : 'Bloquear'}</button><button id="delete-chat-button" class="danger"><i class="fa-solid fa-trash"></i> Apagar Conversa</button>`;
    } else if (chatInfo.type === 'group') {
        chatHeaderUsername.innerHTML = convertMarkdownToHtml(chatInfo.groupName);
        const groupSnapshot = await database.ref(`groups/${chatInfo.id}`).once('value');
        if (!groupSnapshot.exists()) return;
        const groupData = groupSnapshot.val();
        const userSnapshot = await database.ref('users').once('value');
        const allUsers = userSnapshot.val();
        const participants = Object.keys(groupData.participants).map(id => allUsers ? allUsers[id] : null).filter(Boolean);
        const participantNames = participants.map(p => p.username).join(', ');
        const detailsText = participantNames.substring(0, 50) + (participantNames.length > 50 ? '...' : '');
        chatHeaderDetails.innerHTML = detailsText;
        chatHeaderDetails.dataset.originalText = detailsText;
        chatHeaderDetails.classList.add('clickable');
        chatHeaderDetails.onclick = () => {
            toggleOverlay('participants-overlay', true);
            document.getElementById('participants-overlay').innerHTML = buildParticipantsPanel(participants);
        };
        optionsMenu.innerHTML = `<button id="leave-group-button" class="danger"><i class="fa-solid fa-arrow-right-from-bracket"></i> Sair do Grupo</button>`;
    }
    loadChatMessages(chatInfo.id);
    resetUnreadCount(chatInfo.id);
    listenForTypingStatus(chatInfo.id);
    document.getElementById('chat-conversation-screen').classList.remove('hidden');
    document.getElementById('chat-welcome-screen').classList.add('hidden');
    document.getElementById('message-input').focus();
    document.body.classList.add('chat-active');
}

async function showIdentityPanel(userId) {
    const overlay = document.getElementById('identity-overlay');
    overlay.innerHTML = await buildIdentityPanel(userId);
    toggleOverlay('identity-overlay', true);
}


document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const loginButton = document.getElementById('login-button');
    const usernameInput = document.getElementById('username-input');
    const addContactButton = document.getElementById('add-contact-button');
    const newGroupButton = document.getElementById('new-group-button');
    const chatOptionsButton = document.getElementById('chat-options-button');
    const sendMessageButton = document.getElementById('send-message-button');
    const messageInput = document.getElementById('message-input');
    const fileMenuButton = document.getElementById('file-menu-button');
    const sendPhotoButton = document.getElementById('send-photo-button');
    const deleteAccountButton = document.getElementById('delete-account-button');
    const backToContactsButton = document.getElementById('back-to-contacts-button');
    const identityButton = document.getElementById('identity-button');
    const messagesArea = document.getElementById('messages-area');

    // --- Lógica de Autenticação Central ---
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                const userData = JSON.parse(savedUser);
                if (userData.authUid === user.uid) {
                    currentUser = userData;
                    initializeAppForUser(user);
                } else {
                    localStorage.clear();
                    firebase.auth().signOut();
                }
            }
        } else {
            currentUser = null;
            localStorage.clear();
            showLoginScreen();
        }
    });

    // --- Lógica para o PLANO B (Redirect) ---
    firebase.auth().getRedirectResult()
        .then((result) => {
            if (result && result.user) {
                const email = result.user.email;
                const localUser = JSON.parse(localStorage.getItem('currentUser'));
                if (email && localUser) {
                    database.ref(`users/${localUser.id}/googleEmail`).set(email)
                        .then(() => {
                            alert("Conta Google vinculada com sucesso!");
                            if (!document.getElementById('identity-overlay').classList.contains('hidden')) {
                                showIdentityPanel(localUser.id);
                            }
                        })
                        .catch((dbError) => {
                            console.error("Erro ao salvar o email no banco de dados via redirect:", dbError);
                        });
                }
            }
        }).catch((error) => {
            console.error("Erro no getRedirectResult:", error);
        });

    // --- Event Listeners ---
    loginButton.addEventListener('click', () => loginUser(usernameInput.value));
    usernameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginUser(usernameInput.value); });

    backToContactsButton.addEventListener('click', () => {
        document.body.classList.remove('chat-active');
        if (activeChatRef) {
            activeChatRef.off();
            activeChatRef = null;
        }
        if(activeChat) {
             setTypingStatus(activeChat.id, false);
        }
        activeChat = null;
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        document.getElementById('chat-conversation-screen').classList.add('hidden');
        document.getElementById('chat-welcome-screen').classList.remove('hidden');
    });

    identityButton.addEventListener('click', () => {
        if(currentUser) {
            showIdentityPanel(currentUser.id);
        }
    });

    addContactButton.addEventListener('click', () => {
        toggleOverlay('add-contact-overlay', true);
        document.getElementById('add-contact-overlay').innerHTML = buildAddContactPanel();
        setTimeout(() => {
            const searchInput = document.getElementById('search-user-input');
            if(searchInput) searchInput.addEventListener('keyup', (e) => searchUsers(e.target.value));
        }, 100);
    });

    newGroupButton.addEventListener('click', () => {
        const overlay = document.getElementById('new-group-overlay');
        overlay.innerHTML = `
            <div class="overlay-content">
                <button class="close-button" onclick="toggleOverlay('new-group-overlay', false)">&times;</button>
                <h3>Criar Novo Grupo</h3>
                <input type="text" id="group-name-input" placeholder="Nome do Grupo">
                <h4>Selecionar Participantes (Apenas Contatos):</h4>
                <div id="group-user-list" class="scrollable-list"></div>
                <button id="create-group-button-action" class="action-button">Criar Grupo</button>
            </div>`;
        toggleOverlay('new-group-overlay', true);
        buildNewGroupPanelContent();
    });

    deleteAccountButton.addEventListener('click', () => {
        if (confirm("ATENÇÃO: Ação irreversível!\n\nVocê tem certeza que deseja apagar sua conta?")) {
            if(confirm("ÚLTIMO AVISO: Confirma a exclusão permanente da sua conta?")) {
                deleteCurrentUserAccount();
            }
        }
    });

    // --- DELEGAÇÃO DE EVENTOS PARA ITENS DINÂMICOS ---
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('add-user-btn')) {
            const userData = { id: target.dataset.userId, username: target.dataset.userUsername };
            startChatWith(userData);
            toggleOverlay('add-contact-overlay', false);
        }
        if (target.id === 'create-group-button-action') {
            const groupName = document.getElementById('group-name-input').value;
            const selectedUsers = Array.from(document.querySelectorAll('#group-user-list input:checked')).map(input => input.value);
            if (groupName && selectedUsers.length > 0) {
                createGroup(groupName, selectedUsers);
                toggleOverlay('new-group-overlay', false);
            } else {
                alert("Por favor, dê um nome ao grupo e selecione pelo menos um participante.");
            }
        }
        if (target.classList.contains('clickable-name') && target.dataset.userid) {
            showIdentityPanel(target.dataset.userid);
        }
        if(target.id === 'link-google-btn') linkGoogleAccount();
        if(target.id === 'save-bio-btn') {
            const bio = document.getElementById('bio-textarea').value;
            updateUserBio(bio);
            alert('Biografia salva!');
        }
        if(target.id === 'add-link-btn') {
            const url = document.getElementById('new-link-input').value;
            if (url && currentUser) {
                addUserLink(url);
                document.getElementById('new-link-input').value = '';
                showIdentityPanel(currentUser.id);
            }
        }
        if(target.id === 'submit-rating-btn' && !target.classList.contains('hidden')) {
            const rating = parseInt(target.dataset.rating, 10);
            const userId = target.parentElement.querySelector('.star-rating').dataset.userid;
            submitUserRating(userId, rating);
            alert(`Você avaliou com ${rating} estrelas!`);
            showIdentityPanel(userId);
        }
    });
    
    document.addEventListener('mouseover', e => {
        if (e.target.matches('.star-rating i')) {
            const allStars = e.target.parentElement.querySelectorAll('i');
            const hoverValue = parseInt(e.target.dataset.value, 10);
            allStars.forEach((star, index) => {
                star.classList.toggle('fa-solid', index < hoverValue);
                star.classList.toggle('fa-regular', index >= hoverValue);
            });
        }
    });
    document.addEventListener('mouseout', e => {
        if (e.target.matches('.star-rating, .star-rating *')) {
            const ratingContainer = e.target.closest('.star-rating');
            const selectedValue = parseInt(ratingContainer.dataset.selectedValue || '0', 10);
            ratingContainer.querySelectorAll('i').forEach((star, index) => {
                 star.classList.toggle('fa-solid', index < selectedValue);
                 star.classList.toggle('fa-regular', index >= selectedValue);
            });
        }
    });
     document.addEventListener('click', e => {
        if (e.target.matches('.star-rating i')) {
            const ratingContainer = e.target.parentElement;
            const rating = parseInt(e.target.dataset.value, 10);
            ratingContainer.dataset.selectedValue = rating;
            const submitBtn = ratingContainer.parentElement.querySelector('#submit-rating-btn');
            submitBtn.classList.remove('hidden');
            submitBtn.dataset.rating = rating;
        }
    });

    chatOptionsButton.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('chat-options-menu').classList.toggle('hidden');
    });

    document.getElementById('chat-options-menu').addEventListener('click', (e) => {
        if (!activeChat) return;
        const button = e.target.closest('button');
        if (!button) return;
        const action = button.id;
        switch(action) {
            case 'block-user-button':
                checkIfBlocked(activeChat.withUserId).then(isBlocked => {
                    if (isBlocked) {
                        unblockUser(activeChat.withUserId);
                        button.innerHTML = `<i class="fa-solid fa-ban"></i> Bloquear`;
                    } else {
                        blockUser(activeChat.withUserId);
                        button.innerHTML = `<i class="fa-solid fa-ban"></i> Desbloquear`;
                    }
                });
                break;
            case 'delete-chat-button':
                if (confirm("Tem certeza que deseja apagar esta conversa?")) {
                    deleteConversation(activeChat.id);
                    backToContactsButton.click();
                }
                break;
            case 'leave-group-button':
                 if (confirm("Tem certeza que deseja sair deste grupo?")) {
                    leaveGroup(activeChat.id);
                    backToContactsButton.click();
                }
                break;
        }
        document.getElementById('chat-options-menu').classList.add('hidden');
    });

    sendMessageButton.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text && activeChat) {
            sendTextMessage(activeChat.id, text, activeChat.type);
            messageInput.value = '';
            messageInput.style.height = 'auto';
            clearTimeout(typingTimer);
            setTypingStatus(activeChat.id, false);
        }
    });
    
    messageInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageButton.click();
        } else if (activeChat) {
            clearTimeout(typingTimer);
            setTypingStatus(activeChat.id, true);
            typingTimer = setTimeout(() => {
                setTypingStatus(activeChat.id, false);
            }, 2000);
        }
    });

    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });
    
    fileMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('file-options').classList.toggle('hidden');
    });

    sendPhotoButton.addEventListener('click', () => {
        if (activeChat) handlePhotoUpload(activeChat.id);
        document.getElementById('file-options').classList.add('hidden');
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.message-input-area') && !e.target.closest('.chat-header-options') && !e.target.closest('#message-context-menu')) {
            document.getElementById('file-options').classList.add('hidden');
            document.getElementById('chat-options-menu').classList.add('hidden');
            document.getElementById('message-context-menu').classList.add('hidden');
        }
    });

    messagesArea.addEventListener('contextmenu', e => {
        e.preventDefault();
        const bubble = e.target.closest('.message-bubble');
        if (!bubble) return;
        if (!currentUser || bubble.dataset.senderId !== currentUser.id || bubble.querySelector('.deleted-text')) {
            return;
        }
        const menu = document.getElementById('message-context-menu');
        menu.classList.remove('hidden');
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;
        const messageId = bubble.id.replace('msg-', '');
        const newEditBtn = menu.querySelector('#edit-message-btn').cloneNode(true);
        menu.querySelector('#edit-message-btn').replaceWith(newEditBtn);
        const newDeleteBtn = menu.querySelector('#delete-message-btn').cloneNode(true);
        menu.querySelector('#delete-message-btn').replaceWith(newDeleteBtn);
        newEditBtn.onclick = () => {
            menu.classList.add('hidden');
            const contentElement = bubble.querySelector('.message-content') || bubble;
            const currentText = contentElement.textContent;
            const newText = prompt('Edite sua mensagem:', currentText);
            if (newText && newText.trim() !== "" && newText.trim() !== currentText) {
                editMessage(activeChat.id, messageId, newText.trim());
            }
        };
        newDeleteBtn.onclick = () => {
             menu.classList.add('hidden');
             if (confirm('Tem certeza que deseja apagar esta mensagem para todos?')) {
                deleteMessage(activeChat.id, messageId);
             }
        };
    });
});
