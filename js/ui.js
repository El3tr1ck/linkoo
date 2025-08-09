// NO ARQUIVO: js/ui.js (SUBSTITUIR TUDO)

function showLoginScreen() { /* ... */ }
function showChatInterface() { /* ... */ }

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

// --- FUNÇÕES DE EXIBIÇÃO DE LISTAS E MENSAGENS ---

function displaySearchResults(users) { /* ... (sem alterações, mas agora é chamado por um painel genérico) ... */ }

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
            <div><strong>${chatInfo.groupName}</strong></div>`;
    } else {
        html = `
            <div id="status-${chatInfo.withUserId}" class="status-dot offline"></div>
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

function updateContactStatus(userId, status) { /* ... */ }
function displayMessage(message, currentUserId) { /* ... (sem alterações, o bug do scroll foi corrigido no CSS) ... */ }

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
