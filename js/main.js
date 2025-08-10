let activeChat = null;
let messageObserver = null; // Para os recibos de leitura

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
        chatHeaderDetails.onclick = null;
        chatHeaderDetails.style.cursor = 'default';
        
        const isBlocked = await checkIfBlocked(chatInfo.withUserId);
        optionsMenu.innerHTML = `
            <button id="block-user-button"><i class="fa-solid fa-ban"></i> ${isBlocked ? 'Desbloquear' : 'Bloquear'}</button>
            <button id="delete-chat-button" class="danger"><i class="fa-solid fa-trash"></i> Apagar Conversa</button>
        `;
    } else if (chatInfo.type === 'group') {
        chatHeaderUsername.innerHTML = convertMarkdownToHtml(chatInfo.groupName);
        
        const groupSnapshot = await database.ref(`groups/${chatInfo.id}`).once('value');
        if (!groupSnapshot.exists()) return;
        const groupData = groupSnapshot.val();
        
        const userSnapshot = await database.ref('users').once('value');
        const allUsers = userSnapshot.val();
        
        const participants = Object.keys(groupData.participants).map(id => allUsers ? allUsers[id] : null).filter(Boolean);
        const participantNames = participants.map(p => p.username).join(', ');

        chatHeaderDetails.innerHTML = participantNames.substring(0, 50) + (participantNames.length > 50 ? '...' : '');
        chatHeaderDetails.classList.add('clickable');
        chatHeaderDetails.onclick = () => {
            toggleOverlay('participants-overlay', true);
            document.getElementById('participants-overlay').innerHTML = buildParticipantsPanel(participants);
        };
        optionsMenu.innerHTML = `<button id="leave-group-button" class="danger"><i class="fa-solid fa-arrow-right-from-bracket"></i> Sair do Grupo</button>`;
    }
    
    loadChatMessages(chatInfo.id);

    // --- OBSERVA MENSAGENS PARA MARCAR COMO LIDAS (RECIBOS DE LEITURA) ---
    if (messageObserver) {
        messageObserver.disconnect();
    }
    const messagesArea = document.getElementById('messages-area');
    messageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bubble = entry.target;
                const messageId = bubble.id.replace('message-', '');
                // Marca como lida apenas se for uma mensagem recebida
                if (bubble.classList.contains('received')) {
                    markMessageAsRead(activeChat.id, messageId);
                }
                messageObserver.unobserve(bubble); // Para de observar após marcar para otimizar
            }
        });
    }, { threshold: 0.9 }); // 0.9 = 90% da mensagem precisa estar visível

    // Observa as novas mensagens adicionadas à área e as passa para o IntersectionObserver
    const messageAreaObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && node.classList.contains('message-bubble')) {
                    messageObserver.observe(node);
                }
            });
        });
    });
    messageAreaObserver.observe(messagesArea, { childList: true });


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

    // --- Lógica de Inicialização ---

    // Captura o resultado do login Google após o redirecionamento
    firebase.auth().getRedirectResult()
        .then((result) => {
            if (result && result.user) {
                const email = result.user.email;
                const currentUser = JSON.parse(localStorage.getItem('currentUser'));
                if (email && currentUser) {
                    database.ref(`users/${currentUser.id}/googleEmail`).set(email)
                        .then(() => {
                            alert("Conta Google vinculada com sucesso!");
                            showIdentityPanel(currentUser.id);
                        })
                        .catch((dbError) => console.error("Erro ao salvar o email no banco de dados:", dbError));
                }
            }
        }).catch((error) => console.error("Erro no redirecionamento do Google Login:", error));

    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        const userData = JSON.parse(savedUser);
        setupPresence(userData.id);
        showChatInterface();
        loadUserChats(userData.id);
        
        // Pede permissão para notificações após o login, se necessário
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }
    
    // --- Event Listeners ---
    loginButton.addEventListener('click', () => loginUser(usernameInput.value));
    usernameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') loginUser(usernameInput.value); });

    backToContactsButton.addEventListener('click', () => {
        document.body.classList.remove('chat-active');
        if (activeChatRef) {
            activeChatRef.off();
            activeChatRef = null;
        }
        activeChat = null;
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        document.getElementById('chat-conversation-screen').classList.add('hidden');
        document.getElementById('chat-welcome-screen').classList.remove('hidden');
    });

    identityButton.addEventListener('click', () => {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        showIdentityPanel(currentUser.id);
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
    
    // Limpa o título da aba e contador de notificações ao focar na janela
    window.addEventListener('focus', () => {
        if (originalTitle) {
            document.title = originalTitle;
        }
        notificationCount = 0;
    });

    // --- DELEGAÇÃO DE EVENTOS PARA ITENS DINÂMICOS ---
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // --- LÓGICA DO MENU DE OPÇÕES DA MENSAGEM ---
        const optionsBtn = target.closest('.options-btn');
        if (optionsBtn) {
            e.stopPropagation(); // Impede que o clique feche o menu imediatamente
            const messageId = optionsBtn.dataset.messageId;
            document.querySelectorAll('.message-context-menu').forEach(menu => {
                if(menu.id !== `menu-${messageId}`) menu.classList.add('hidden');
            });
            document.getElementById(`menu-${messageId}`).classList.toggle('hidden');
            return; 
        }

        // Esconde todos os menus de mensagem se clicar fora
        if (!target.closest('.message-context-menu')) {
            document.querySelectorAll('.message-context-menu').forEach(menu => menu.classList.add('hidden'));
        }
        
        if (target.closest('.delete-btn')) {
            const menu = target.closest('.message-context-menu');
            if (menu) {
                const messageId = menu.id.replace('menu-', '');
                if (confirm("Tem certeza que deseja apagar esta mensagem?")) {
                    deleteMessage(activeChat.id, messageId);
                }
                menu.classList.add('hidden');
            }
        }

        if (target.closest('.edit-btn')) {
            const menu = target.closest('.message-context-menu');
            if (menu) {
                const optionsButton = menu.parentElement.querySelector('.options-btn');
                const messageId = optionsButton.dataset.messageId;
                const messageText = optionsButton.dataset.messageText;
                
                const overlay = document.getElementById('edit-message-overlay');
                overlay.innerHTML = buildEditMessagePanel(messageId, messageText);
                toggleOverlay('edit-message-overlay', true);
                
                menu.classList.add('hidden');
            }
        }

        if (target.id === 'save-edit-button') {
            const messageId = target.dataset.messageId;
            const newText = document.getElementById('edit-message-textarea').value;
            editMessage(activeChat.id, messageId, newText);
            toggleOverlay('edit-message-overlay', false);
        }
        
        // --- LÓGICA ORIGINAL RESTANTE ---
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
            if (url) {
                addUserLink(url);
                document.getElementById('new-link-input').value = '';
                const me = JSON.parse(localStorage.getItem('currentUser'));
                showIdentityPanel(me.id);
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
    
    // --- LÓGICA DAS ESTRELAS DE AVALIAÇÃO (sem alteração) ---
    document.addEventListener('mouseover', e => { /* ... */ });
    document.addEventListener('mouseout', e => { /* ... */ });
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


    // --- LISTENERS DOS MENUS GERAIS (sem alteração) ---
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
            case 'block-user-button': /* ... */ break;
            case 'delete-chat-button': /* ... */ break;
            case 'leave-group-button': /* ... */ break;
        }
        document.getElementById('chat-options-menu').classList.add('hidden');
    })
