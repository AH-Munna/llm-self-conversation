// Global State
let currentPairId = null;
let currentConvId = null;
let activeEventSource = null;

// DOM Elements
const elements = {
    // Modals
    apiConfigModal: document.getElementById('apiConfigModal'),
    characterModal: document.getElementById('characterModal'),
    newPairModal: document.getElementById('newPairModal'),
    openApiConfigBtn: document.getElementById('openApiConfigBtn'),
    openCharacterConfigBtn: document.getElementById('openCharacterConfigBtn'),

    // System Prompt
    systemPrompt: document.getElementById('systemPrompt'),
    saveSystemPromptBtn: document.getElementById('saveSystemPromptBtn'),
    
    // API Config 1
    baseUrl1: document.getElementById('baseUrl1'),
    apiKey1: document.getElementById('apiKey1'),
    fetchModels1Btn: document.getElementById('fetchModels1Btn'),
    saveConfig1Btn: document.getElementById('saveConfig1Btn'),
    config1Status: document.getElementById('config1Status'),
    
    // API Config 2
    baseUrl2: document.getElementById('baseUrl2'),
    apiKey2: document.getElementById('apiKey2'),
    fetchModels2Btn: document.getElementById('fetchModels2Btn'),
    saveConfig2Btn: document.getElementById('saveConfig2Btn'),
    config2Status: document.getElementById('config2Status'),
    
    // Character Pair
    characterPairSelect: document.getElementById('characterPairSelect'),
    newPairBtn: document.getElementById('newPairBtn'),
    
    // Character Edit
    characterDetailsSection: document.getElementById('characterDetailsSection'),
    editChar1Name: document.getElementById('editChar1Name'),
    editChar1Model: document.getElementById('editChar1Model'),
    editChar1Definition: document.getElementById('editChar1Definition'),
    editChar1StartMsg: document.getElementById('editChar1StartMsg'),
    editChar2Name: document.getElementById('editChar2Name'),
    editChar2Model: document.getElementById('editChar2Model'),
    editChar2Definition: document.getElementById('editChar2Definition'),
    saveCharacterEditsBtn: document.getElementById('saveCharacterEditsBtn'),
    deletePairBtn: document.getElementById('deletePairBtn'),
    editCharStatus: document.getElementById('editCharStatus'),
    
    // New Pair Modal
    newChar1Name: document.getElementById('newChar1Name'),
    newChar1Model: document.getElementById('newChar1Model'),
    newChar1Definition: document.getElementById('newChar1Definition'),
    newChar1StartMsg: document.getElementById('newChar1StartMsg'),
    newChar2Name: document.getElementById('newChar2Name'),
    newChar2Model: document.getElementById('newChar2Model'),
    newChar2Definition: document.getElementById('newChar2Definition'),
    createPairBtn: document.getElementById('createPairBtn'),
    newPairStatus: document.getElementById('newPairStatus'),
    
    // Conversation
    conversationSelect: document.getElementById('conversationSelect'),
    conversationContainer: document.getElementById('conversationContainer'),
    startConversationBtn: document.getElementById('startConversationBtn'),
    stopConversationBtn: document.getElementById('stopConversationBtn'),
    continueConversationBtn: document.getElementById('continueConversationBtn'),
    deleteConvBtn: document.getElementById('deleteConvBtn'),
    conversationStatus: document.getElementById('conversationStatus'),
    turnCount: document.getElementById('turnCount'),
    loadingOverlay: document.getElementById('loadingOverlay')
};

// Utility Functions
function showStatus(element, message, type = 'info') {
    element.textContent = message;
    element.className = `status-message show ${type}`;
    setTimeout(() => element.classList.remove('show'), 5000);
}

function showLoading(show) {
    elements.loadingOverlay.classList.toggle('show', show);
}

async function fetchAPI(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Request failed');
    }
    
    return response.json();
}

// Modal Functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
}

// Tab Functions
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content (within same modal)
            const modal = btn.closest('.modal');
            modal.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            modal.querySelector(`#${tabId}`).classList.add('active');
        });
    });
}

// System Prompt Functions
async function loadSystemPrompt() {
    try {
        const data = await fetchAPI('/api/system-prompt');
        elements.systemPrompt.value = data.prompt || '';
    } catch (error) {
        console.error('Failed to load system prompt:', error);
    }
}

async function saveSystemPrompt() {
    try {
        await fetchAPI('/api/system-prompt', {
            method: 'POST',
            body: JSON.stringify({ prompt: elements.systemPrompt.value })
        });
        alert('✅ System prompt saved!');
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
}

// API Configuration Functions
async function loadAPIConfig(configNum) {
    try {
        const data = await fetchAPI(`/api/config/${configNum}`);
        if (configNum === 1) {
            elements.baseUrl1.value = data.base_url || '';
            elements.apiKey1.value = data.api_key || '';
        } else {
            elements.baseUrl2.value = data.base_url || '';
            elements.apiKey2.value = data.api_key || '';
        }
    } catch (error) {
        console.error(`Failed to load API config ${configNum}:`, error);
    }
}

async function saveAPIConfig(configNum) {
    const statusEl = configNum === 1 ? elements.config1Status : elements.config2Status;
    try {
        const baseUrl = configNum === 1 ? elements.baseUrl1.value : elements.baseUrl2.value;
        const apiKey = configNum === 1 ? elements.apiKey1.value : elements.apiKey2.value;
        
        await fetchAPI(`/api/config/${configNum}`, {
            method: 'POST',
            body: JSON.stringify({ base_url: baseUrl, api_key: apiKey })
        });
        
        showStatus(statusEl, `✅ API Config ${configNum} saved!`, 'success');
    } catch (error) {
        showStatus(statusEl, `❌ Error: ${error.message}`, 'error');
    }
}

async function fetchModels(configNum) {
    const statusEl = configNum === 1 ? elements.config1Status : elements.config2Status;
    try {
        showStatus(statusEl, '🔄 Fetching models...', 'info');
        const data = await fetchAPI(`/api/models/${configNum}`);
        
        // Populate model dropdown in new pair modal
        const modelSelect = configNum === 1 ? elements.newChar1Model : elements.newChar2Model;
        modelSelect.innerHTML = '<option value="">Select model...</option>';
        
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                modelSelect.appendChild(option);
            });
        }
        
        showStatus(statusEl, `✅ Found ${data.data?.length || 0} models`, 'success');
    } catch (error) {
        showStatus(statusEl, `❌ Error: ${error.message}`, 'error');
    }
}

// Character Pair Functions
async function loadCharacterPairs() {
    try {
        const data = await fetchAPI('/api/character-pairs');
        elements.characterPairSelect.innerHTML = '<option value="">-- Select Character Pair --</option>';
        
        data.pairs.forEach(pair => {
            const option = document.createElement('option');
            option.value = pair.id;
            option.textContent = `${pair.character1_name} & ${pair.character2_name}`;
            elements.characterPairSelect.appendChild(option);
        });
        
        // Auto-select first pair if available
        if (data.pairs.length > 0) {
            elements.characterPairSelect.value = data.pairs[0].id;
            await onPairSelected(data.pairs[0].id);
        }
    } catch (error) {
        console.error('Failed to load character pairs:', error);
    }
}

async function createCharacterPair() {
    try {
        const pair = {
            id: '', // Will be generated by backend
            name: `${elements.newChar1Name.value}_${elements.newChar2Name.value}`,
            created_at: new Date().toISOString(),
            last_conversation_id: null,
            character1: {
                name: elements.newChar1Name.value,
                definition: elements.newChar1Definition.value,
                model: elements.newChar1Model.value,
                starting_message: elements.newChar1StartMsg.value
            },
            character2: {
                name: elements.newChar2Name.value,
                definition: elements.newChar2Definition.value,
                model: elements.newChar2Model.value,
                starting_message: null
            }
        };
        
        const result = await fetchAPI('/api/character-pairs', {
            method: 'POST',
            body: JSON.stringify(pair)
        });
        
        showStatus(elements.newPairStatus, '✅ Character pair created!', 'success');
        
        // Reload pairs and select the new one
        await loadCharacterPairs();
        currentPairId = result.pair_id;
        elements.characterPairSelect.value = currentPairId;
        
        // Close modal
        setTimeout(() => {
            closeModal('newPairModal');
            clearNewPairForm();
        }, 1000);
        
        // Create new conversation for this pair
        await createNewConversation();
        
    } catch (error) {
        showStatus(elements.newPairStatus, `❌ Error: ${error.message}`, 'error');
    }
}

function clearNewPairForm() {
    elements.newChar1Name.value = '';
    elements.newChar1Model.value = '';
    elements.newChar1Definition.value = '';
    elements.newChar1StartMsg.value = '';
    elements.newChar2Name.value = '';
    elements.newChar2Model.value = '';
    elements.newChar2Definition.value = '';
}

async function onPairSelected(pairId) {
    currentPairId = pairId;
    
    if (!pairId) {
        currentConvId = null;
        elements.conversationContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🎭</div><p>Select a character pair to start!</p></div>';
        elements.characterDetailsSection.style.display = 'none';
        return;
    }
    
    // Load character pair details
    await loadCharacterDetails(pairId);
    
    // Load conversations for this pair
    await loadConversations();
}

async function loadCharacterDetails(pairId) {
    try {
        const pair = await fetchAPI(`/api/character-pairs/${pairId}`);
        
        // Populate edit form
        elements.editChar1Name.value = pair.character1.name;
        elements.editChar1Model.value = pair.character1.model;
        elements.editChar1Definition.value = pair.character1.definition;
        elements.editChar1StartMsg.value = pair.character1.starting_message || '';
        
        elements.editChar2Name.value = pair.character2.name;
        elements.editChar2Model.value = pair.character2.model;
        elements.editChar2Definition.value = pair.character2.definition;
        
        // Show character details section
        elements.characterDetailsSection.style.display = 'block';
        
        // Load models for dropdowns
        await loadModelsForEdit();
    } catch (error) {
        console.error('Failed to load character details:', error);
    }
}

async function loadModelsForEdit() {
    try {
        const [models1, models2] = await Promise.all([
            fetchAPI('/api/models/1'),
            fetchAPI('/api/models/2')
        ]);
        
        // Populate char 1 model dropdown
        const currentChar1Model = elements.editChar1Model.value;
        elements.editChar1Model.innerHTML = '<option value="">Select model...</option>';
        if (models1.data && Array.isArray(models1.data)) {
            models1.data.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                elements.editChar1Model.appendChild(option);
            });
        }
        elements.editChar1Model.value = currentChar1Model;
        
        // Populate char 2 model dropdown
        const currentChar2Model = elements.editChar2Model.value;
        elements.editChar2Model.innerHTML = '<option value="">Select model...</option>';
        if (models2.data && Array.isArray(models2.data)) {
            models2.data.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                elements.editChar2Model.appendChild(option);
            });
        }
        elements.editChar2Model.value = currentChar2Model;
    } catch (error) {
        console.error('Failed to load models for editing:', error);
    }
}

async function saveCharacterEdits() {
    if (!currentPairId) return;
    
    try {
        const pair = await fetchAPI(`/api/character-pairs/${currentPairId}`);
        
        // Update with edited values
        pair.character1.name = elements.editChar1Name.value;
        pair.character1.model = elements.editChar1Model.value;
        pair.character1.definition = elements.editChar1Definition.value;
        pair.character1.starting_message = elements.editChar1StartMsg.value;
        
        pair.character2.name = elements.editChar2Name.value;
        pair.character2.model = elements.editChar2Model.value;
        pair.character2.definition = elements.editChar2Definition.value;
        
        await fetchAPI(`/api/character-pairs/${currentPairId}`, {
            method: 'PUT',
            body: JSON.stringify(pair)
        });
        
        showStatus(elements.editCharStatus, '✅ Character pair updated!', 'success');
        await loadCharacterPairs(); // Refresh dropdown
    } catch (error) {
        showStatus(elements.editCharStatus, `❌ Error: ${error.message}`, 'error');
    }
}

async function deleteCharacterPair() {
    if (!currentPairId) return;
    
    if (!confirm('Delete this character pair and all its conversations?')) return;
    
    try {
        await fetchAPI(`/api/character-pairs/${currentPairId}`, {
            method: 'DELETE'
        });
        
        showStatus(elements.editCharStatus, '✅ Character pair deleted', 'success');
        currentPairId = null;
        currentConvId = null;
        await loadCharacterPairs();
        elements.characterDetailsSection.style.display = 'none';
        elements.conversationContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🎭</div><p>Select or create a character pair to start!</p></div>';
    } catch (error) {
        showStatus(elements.editCharStatus, `❌ Error: ${error.message}`, 'error');
    }
}

// Conversation Functions
async function loadConversations() {
    if (!currentPairId) return;
    
    try {
        const data = await fetchAPI(`/api/character-pairs/${currentPairId}/conversations`);
        
        elements.conversationSelect.innerHTML = '<option value="new">+ New Conversation</option>';
        if (data.conversations.length > 0) {
            elements.conversationSelect.innerHTML += '<option disabled>-- Recent --</option>';
        }
        
        data.conversations.forEach(conv => {
            const option = document.createElement('option');
            option.value = conv.id;
            const date = new Date(conv.updated_at).toLocaleString();
            option.textContent = `${date} (${conv.turn_count} turns)`;
            elements.conversationSelect.appendChild(option);
        });
        
        // Load last conversation if exists
        if (data.conversations.length > 0) {
            currentConvId = data.conversations[0].id;
            elements.conversationSelect.value = currentConvId;
            await loadConversation(currentConvId);
            elements.deleteConvBtn.disabled = false;
        } else {
            // No conversations - create new one
            await createNewConversation();
        }
    } catch (error) {
        console.error('Failed to load conversations:', error);
    }
}

async function createNewConversation() {
    if (!currentPairId) return;
    
    try {
        const result = await fetchAPI(`/api/character-pairs/${currentPairId}/conversations`, {
            method: 'POST'
        });
        
        currentConvId = result.conversation_id;
        await loadConversations();
        elements.conversationSelect.value = currentConvId;
        
        // Load the conversation to display the starting message
        await loadConversation(currentConvId);
        
        elements.deleteConvBtn.disabled = false;
    } catch (error) {
        console.error('Failed to create conversation:', error);
    }
}

async function loadConversation(convId) {
    if (!convId || !currentPairId) return;
    
    try {
        const conv = await fetchAPI(`/api/conversations/${convId}?pair_id=${currentPairId}`);
        
        // Display messages
        elements.conversationContainer.innerHTML = '';
        conv.messages.forEach(msg => displayMessage(msg));
        
        elements.turnCount.textContent = conv.turn_count;
        elements.continueConversationBtn.disabled = conv.turn_count === 0;
    } catch (error) {
        console.error('Failed to load conversation:', error);
    }
}

async function onConversationSelected() {
    const selectedValue = elements.conversationSelect.value;
    
    if (selectedValue === 'new') {
        await createNewConversation();
    } else {
        currentConvId = selectedValue;
        await loadConversation(currentConvId);
    }
}

async function deleteConversation() {
    if (!currentConvId || !currentPairId) return;
    
    if (!confirm('Delete this conversation?')) return;
    
    try {
        await fetchAPI(`/api/conversations/${currentConvId}?pair_id=${currentPairId}`, {
            method: 'DELETE'
        });
        
        showStatus(elements.conversationStatus, '✅ Conversation deleted', 'success');
        await loadConversations();
    } catch (error) {
        showStatus(elements.conversationStatus, `❌ Error: ${error.message}`, 'error');
    }
}

// Streaming Conversation
async function startConversation() {
    if (!currentConvId || !currentPairId) {
        showStatus(elements.conversationStatus, '❌ Please select a character pair', 'error');
        return;
    }
    
    try {
        // Don't clear container - preserve existing messages (like starting message)
        elements.startConversationBtn.disabled = true;
        elements.stopConversationBtn.disabled = false;
        elements.continueConversationBtn.disabled = true;
        
        showStatus(elements.conversationStatus, '🔄 Starting conversation...', 'info');
        
        activeEventSource = new EventSource(`/api/conversations/${currentConvId}/start-stream?pair_id=${currentPairId}&turns=10`);
        let messageCount = 0;
        
        activeEventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.error) {
                showStatus(elements.conversationStatus, `❌ Error: ${data.error}`, 'error');
                activeEventSource.close();
                activeEventSource = null;
                elements.startConversationBtn.disabled = false;
                elements.stopConversationBtn.disabled = true;
                return;
            }
            
            if (data.complete) {
                elements.turnCount.textContent = data.total_turns;
                showStatus(elements.conversationStatus, `✅ Conversation completed (${data.total_turns} turns)`, 'success');
                activeEventSource.close();
                activeEventSource = null;
                elements.startConversationBtn.disabled = false;
                elements.stopConversationBtn.disabled = true;
                elements.continueConversationBtn.disabled = false;
                return;
            }
            
            // Display message as it arrives
            if (data.character && data.content) {
                displayMessage(data);
                messageCount++;
                elements.turnCount.textContent = messageCount;
                showStatus(elements.conversationStatus, `🔄 Turn ${messageCount}/10...`, 'info');
            }
        };
        
        activeEventSource.onerror = (error) => {
            showStatus(elements.conversationStatus, '❌ Connection error. Please try again.', 'error');
            if (activeEventSource) {
                activeEventSource.close();
                activeEventSource = null;
            }
            elements.startConversationBtn.disabled = false;
            elements.stopConversationBtn.disabled = true;
        };
        
    } catch (error) {
        showStatus(elements.conversationStatus, `❌ Error: ${error.message}`, 'error');
        elements.startConversationBtn.disabled = false;
        elements.stopConversationBtn.disabled = true;
    }
}

function stopConversation() {
    if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
        showStatus(elements.conversationStatus, '⏹️ Conversation stopped', 'info');
        elements.startConversationBtn.disabled = false;
        elements.stopConversationBtn.disabled = true;
        elements.continueConversationBtn.disabled = false;
    }
}

function displayMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const formattedContent = formatMessageText(message.content);
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="character-name">${message.character}</span>
        </div>
        <div class="message-content">${formattedContent}</div>
    `;
    
    elements.conversationContainer.appendChild(messageDiv);
    elements.conversationContainer.scrollTop = elements.conversationContainer.scrollHeight;
}

function formatMessageText(text) {
    const paragraphs = text.split('\\n').filter(p => p.trim());
    
    return paragraphs.map(para => {
        let formatted = escapeHtml(para);
        
        // Format code blocks first (highest priority)
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Format quotes with greedy matching to capture everything between quotes (including asterisks)
        formatted = formatted.replace(/"(.*?)"/g, (match, content) => {
            // Apply italic formatting within the quoted content
            const withItalics = content.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            return `<span class="quote-text">"${withItalics}"</span>`;
        });
        
        // Format italics outside of quotes and code blocks
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        
        return `<p>${formatted}</p>`;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateTurnCount(count) {
    elements.turnCount.textContent = count;
}

// Event Listeners
elements.openApiConfigBtn.addEventListener('click', () => openModal('apiConfigModal'));
elements.openCharacterConfigBtn.addEventListener('click', () => openModal('characterModal'));
elements.newPairBtn.addEventListener('click', () => openModal('newPairModal'));

// Close modals
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        closeModal(btn.dataset.modal);
    });
});

// Close modal by clicking outside
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal') && !event.target.classList.contains('modal-nested')) {
        event.target.classList.remove('show');
    }
});

// System Prompt
elements.saveSystemPromptBtn.addEventListener('click', saveSystemPrompt);

// API Configs
elements.saveConfig1Btn.addEventListener('click', () => saveAPIConfig(1));
elements.saveConfig2Btn.addEventListener('click', () => saveAPIConfig(2));
elements.fetchModels1Btn.addEventListener('click', () => fetchModels(1));
elements.fetchModels2Btn.addEventListener('click', () => fetchModels(2));

// Character Pairs
elements.characterPairSelect.addEventListener('change', (e) => onPairSelected(e.target.value));
elements.createPairBtn.addEventListener('click', createCharacterPair);
elements.saveCharacterEditsBtn.addEventListener('click', saveCharacterEdits);
elements.deletePairBtn.addEventListener('click', deleteCharacterPair);

// Conversations
elements.conversationSelect.addEventListener('change', onConversationSelected);
elements.startConversationBtn.addEventListener('click', startConversation);
elements.stopConversationBtn.addEventListener('click', stopConversation);
elements.continueConversationBtn.addEventListener('click', startConversation); // Same as start
elements.deleteConvBtn.addEventListener('click', deleteConversation);

// Initialize
async function init() {
    initTabs();
    await loadSystemPrompt();
    await loadAPIConfig(1);
    await loadAPIConfig(2);
    await loadCharacterPairs();
}

init();
