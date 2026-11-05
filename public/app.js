const participantModal = document.getElementById('participant-modal');
const friendModal = document.getElementById('friend-modal');
const form = document.getElementById('participant-form');
const grid = document.getElementById('participants-grid');
const count = document.getElementById('participant-count');
const errorBox = document.getElementById('form-error');
const submitButton = document.getElementById('submit-button');
const profilePhotoInput = document.getElementById('profile-photo');
const profilePhotoPreview = document.getElementById('profile-photo-preview');
const removeProfileRow = document.getElementById('remove-profile-row');
const itemsEditor = document.getElementById('items-editor');
const toast = document.getElementById('toast');
const TOKEN_STORAGE_KEY = 'amigo-secreto-owner-tokens-v1';
const MAX_ITEMS = 20;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
let toastTimer;
let editParticipantId = null;
let currentFriend = null;
let profilePreviewUrl = null;
let existingProfilePhotoUrl = null;

const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
const tokens = () => {
  try { return JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '{}'); }
  catch { return {}; }
};
const getEditToken = (id) => tokens()[id] || '';

function saveEditToken(id, token) {
  const saved = tokens();
  saved[id] = token;
  try { localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(saved)); }
  catch { showToast('O navegador bloqueou o armazenamento da chave de edição. Não feche a página até resolver essa configuração.'); }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 4000);
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function appendProfileAvatar(container, person, className = 'avatar') {
  const avatar = createElement('div', className);
  if (person.profile_photo_url) {
    const image = document.createElement('img');
    image.src = person.profile_photo_url;
    image.alt = `Foto de perfil de ${person.name}`;
    image.loading = 'lazy';
    avatar.append(image);
  } else {
    avatar.textContent = (person.name || '?').trim().charAt(0).toLocaleUpperCase('pt-BR');
    avatar.setAttribute('aria-hidden', 'true');
  }
  container.append(avatar);
  return avatar;
}

function renderParticipants(participants) {
  count.textContent = String(participants.length);
  grid.replaceChildren();

  if (!participants.length) {
    const empty = createElement('div', 'empty-state');
    const icon = createElement('div', 'empty-icon', '✳');
    icon.setAttribute('aria-hidden', 'true');
    empty.append(icon, createElement('h3', '', 'A lista está começando!'));
    empty.append(createElement('p', '', 'Ainda não temos participantes. Seja a primeira pessoa a entrar e inspire os próximos!'));
    grid.append(empty);
    return;
  }

  participants.forEach((person) => {
    const card = createElement('article', 'participant-card');
    const top = createElement('div', 'card-top');
    appendProfileAvatar(top, person);
    const identity = createElement('div', 'card-person');
    identity.append(createElement('h3', '', person.name));
    identity.append(createElement('p', '', `${person.item_count} ${Number(person.item_count) === 1 ? 'opção' : 'opções'} de presente`));
    top.append(identity);
    card.append(top, createElement('div', 'card-divider'));

    const content = createElement('div', 'card-content participant-card-content');
    content.append(createElement('p', 'card-label', 'Lista de desejos'));
    content.append(createElement('p', 'card-wish', 'Abra a lista para ver os produtos, pesquisar no Google e selecionar suas opções.'));
    const actions = createElement('div', 'participant-card-actions');
    const viewButton = createElement('button', 'primary-button view-list-button', 'Ver lista de desejos ↗');
    viewButton.type = 'button';
    viewButton.addEventListener('click', () => openFriendList(person.id));
    actions.append(viewButton);
    if (getEditToken(person.id)) {
      const editButton = createElement('button', 'secondary-button card-edit-button', 'Editar meu cadastro');
      editButton.type = 'button';
      editButton.addEventListener('click', () => openEditForm(person.id));
      actions.append(editButton);
    }
    content.append(actions);
    card.append(content);
    grid.append(card);
  });
}

async function loadParticipants() {
  grid.setAttribute('aria-busy', 'true');
  try {
    await window.ASReady;
    if (!window.AS || typeof window.AS.list !== 'function') {
      throw new Error("O módulo Firebase carregou, mas a API de participantes não foi inicializada. Atualize a página; se persistir, confira o carregamento de /firebase.js.");
    }
    const participants = await window.AS.list();
    renderParticipants(participants || []);
  } catch (error) {
    console.error("Falha ao conectar ao Firebase:", error);
    grid.replaceChildren();
    const message = createElement('div', 'empty-state');
    message.append(createElement('div', 'empty-icon', '!'));
    message.append(createElement('h3', '', 'Não foi possível conectar ao Firebase'));
    let detail = error?.code ? `${error.code}: ${error.message || ""}` : (error?.message || "Confira as configurações do Firebase e tente novamente.");
    if (error?.code === 'permission-denied') {
      detail = 'O Firebase está conectado, mas o Firestore está bloqueando a leitura dos participantes. No Console do Firebase do mesmo projeto indicado por FIREBASE_PROJECT_ID, abra Firestore Database → Rules, cole o conteúdo do arquivo firestore.rules deste ZIP e clique em Publicar. Autorizar o domínio em Authentication não libera o banco de dados.';
    }
    message.append(createElement('p', '', detail));
    grid.append(message);
  } finally { grid.removeAttribute('aria-busy'); }
}

function openParticipantForm() {
  editParticipantId = null;
  existingProfilePhotoUrl = null;
  form.reset();
  itemsEditor.replaceChildren();
  addItemEditor();
  clearProfilePhotoPreview();
  profilePhotoInput.value = '';
  removeProfileRow.hidden = true;
  document.getElementById('remove-profile-photo').checked = false;
  document.getElementById('form-kicker').textContent = 'FAÇA PARTE DA BRINCADEIRA';
  document.getElementById('form-title').textContent = 'Sua lista de desejos';
  document.getElementById('form-intro').textContent = 'Preencha seus dados e adicione um ou mais presentes que gostaria de ganhar.';
  submitButton.innerHTML = 'Confirmar participação <span aria-hidden="true">↗</span>';
  errorBox.hidden = true;
  participantModal.showModal();
  setTimeout(() => document.getElementById('participant-name').focus(), 60);
}

function closeParticipantForm() {
  if (participantModal.open) participantModal.close();
  clearProfilePhotoPreview();
  itemsEditor.querySelectorAll('.item-photo-preview img[data-object-url="true"]').forEach((img) => URL.revokeObjectURL(img.src));
}

function clearProfilePhotoPreview() {
  if (profilePreviewUrl) URL.revokeObjectURL(profilePreviewUrl);
  profilePreviewUrl = null;
  profilePhotoPreview.replaceChildren();
}

function renderProfilePhotoPreview(file) {
  clearProfilePhotoPreview();
  if (!file) return;
  profilePreviewUrl = URL.createObjectURL(file);
  const wrapper = createElement('div', 'preview-item profile-preview-item');
  const image = document.createElement('img');
  image.src = profilePreviewUrl;
  image.alt = 'Prévia da sua foto de perfil';
  wrapper.append(image);
  profilePhotoPreview.append(wrapper);
}

profilePhotoInput.addEventListener('change', () => {
  const file = profilePhotoInput.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    profilePhotoInput.value = '';
    showToast('Escolha um arquivo de imagem válido.');
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    profilePhotoInput.value = '';
    showToast('Sua foto de perfil ultrapassa o limite de 2 MB.');
    return;
  }
  document.getElementById('remove-profile-photo').checked = false;
  renderProfilePhotoPreview(file);
});

function itemImagePreview(container, files) {
  container.querySelectorAll('img[data-object-url="true"]').forEach((img) => URL.revokeObjectURL(img.src));
  container.replaceChildren();
  [...files].forEach((file) => {
    const wrapper = createElement('div', 'preview-item');
    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    image.dataset.objectUrl = 'true';
    image.alt = `Prévia de ${file.name}`;
    wrapper.append(image);
    container.append(wrapper);
  });
}

function addItemEditor(item = {}) {
  if (itemsEditor.children.length >= MAX_ITEMS) {
    showToast(`Você pode adicionar no máximo ${MAX_ITEMS} produtos.`);
    return;
  }
  const index = itemsEditor.children.length;
  const card = createElement('section', 'item-editor');
  if (item.id) card.dataset.itemId = item.id;

  const header = createElement('div', 'item-editor-header');
  header.append(createElement('h3', 'item-editor-title', `Presente ${index + 1}`));
  const remove = createElement('button', 'remove-item-button', 'Remover');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    card.querySelectorAll('img[data-object-url="true"]').forEach((img) => URL.revokeObjectURL(img.src));
    card.remove();
    refreshItemNumbers();
  });
  header.append(remove);

  const descriptionField = createElement('div', 'form-field');
  const descriptionLabel = createElement('label', '', 'Nome e detalhes do presente');
  const description = document.createElement('textarea');
  description.dataset.description = 'true';
  description.rows = 3;
  description.maxLength = 1200;
  description.placeholder = 'Ex.: Camisa de time, tamanho G, de preferência preta...';
  description.required = true;
  description.value = item.description || '';
  descriptionField.append(descriptionLabel, description);

  const priceField = createElement('div', 'form-field');
  const priceLabel = createElement('label', '', 'Preço médio (R$)');
  const price = document.createElement('input');
  price.type = 'text';
  price.inputMode = 'decimal';
  price.placeholder = '70,00';
  price.required = true;
  price.dataset.price = 'true';
  price.value = item.average_price ?? '';
  priceField.append(priceLabel, price);

  const linksField = createElement('div', 'form-field');
  const linksLabel = createElement('label', '', 'Links de referência (opcional)');
  const links = document.createElement('textarea');
  links.dataset.links = 'true';
  links.rows = 2;
  links.maxLength = 2500;
  links.placeholder = 'Cole um link por linha (Amazon, Mercado Livre etc.)';
  links.value = Array.isArray(item.links) ? item.links.join('\n') : '';
  linksField.append(linksLabel, links);

  const photosField = createElement('div', 'form-field');
  const photosLabelRow = createElement('div', 'label-row');
  photosLabelRow.append(createElement('label', '', 'Fotos do produto (opcional)'));
  photosLabelRow.append(createElement('span', 'small-limit', 'até 4 fotos por item'));
  const photosLabel = createElement('label', 'upload-area');
  photosLabel.append(createElement('span', 'upload-icon', '＋'));
  const photoCopy = createElement('span');
  photoCopy.append(createElement('strong', '', 'Escolher fotos do produto'));
  photoCopy.append(createElement('small', '', 'JPG, PNG, WEBP ou GIF · 2 MB cada'));
  photosLabel.append(photoCopy);
  const photos = document.createElement('input');
  photos.type = 'file';
  photos.multiple = true;
  photos.accept = 'image/jpeg,image/png,image/webp,image/gif';
  photos.className = 'visually-hidden item-photo-input';
  const photosId = `item-photo-${cryptoSafeId()}`;
  photos.id = photosId;
  photosLabel.htmlFor = photosId;
  const preview = createElement('div', 'photo-preview item-photo-preview');
  photos.addEventListener('change', () => {
    const incoming = [...photos.files];
    if (incoming.length > 4) {
      const transfer = new DataTransfer();
      incoming.slice(0, 4).forEach((file) => transfer.items.add(file));
      photos.files = transfer.files;
      showToast('O limite é de 4 novas fotos por produto.');
    }
    const files = [...photos.files];
    if (files.some((file) => file.size > MAX_IMAGE_BYTES)) {
      photos.value = '';
      showToast('Cada foto pode ter no máximo 2 MB.');
      itemImagePreview(preview, []);
      return;
    }
    itemImagePreview(preview, files);
    validateTotalSelectedFiles();
  });
  photosField.append(photosLabelRow, photosLabel, photos, preview);

  if (Array.isArray(item.images) && item.images.length) {
    const existing = createElement('div', 'existing-item-images');
    existing.append(createElement('span', 'field-hint', 'Fotos atuais (serão mantidas, a menos que você envie novas):'));
    const thumbs = createElement('div', 'photo-preview');
    item.images.forEach((photo) => {
      const wrapper = createElement('div', 'preview-item');
      const image = document.createElement('img');
      image.src = photo.url;
      image.alt = 'Foto de produto já cadastrada';
      wrapper.append(image);
      thumbs.append(wrapper);
    });
    existing.append(thumbs);
    photosField.append(existing);
  }

  card.append(header, descriptionField, priceField, linksField, photosField);
  itemsEditor.append(card);
  refreshItemNumbers();
}

function cryptoSafeId() {
  return Math.random().toString(36).slice(2, 10);
}

function refreshItemNumbers() {
  [...itemsEditor.children].forEach((card, index) => {
    card.querySelector('.item-editor-title').textContent = `Presente ${index + 1}`;
    card.querySelector('.remove-item-button').hidden = itemsEditor.children.length === 1;
  });
}

document.getElementById('add-item-button').addEventListener('click', () => addItemEditor());

function validateTotalSelectedFiles() {
  let total = profilePhotoInput.files.length;
  itemsEditor.querySelectorAll('.item-photo-input').forEach((input) => { total += input.files.length; });
  if (total > MAX_IMAGES) showToast(`O limite é de ${MAX_IMAGES} fotos novas no cadastro inteiro, incluindo a foto de perfil.`);
  return total;
}

async function openEditForm(id) {
  const token = getEditToken(id);
  if (!token) {
    showToast('A chave de edição não está salva neste navegador.');
    return;
  }
  try {
    await window.ASReady;
    const person = await window.AS.get(id);
    editParticipantId = id;
    existingProfilePhotoUrl = person.profile_photo_url || null;
    form.reset();
    itemsEditor.replaceChildren();
    document.getElementById('participant-name').value = person.name;
    document.getElementById('participant-comment').value = person.comment || '';
    (person.items || []).forEach((item) => addItemEditor(item));
    clearProfilePhotoPreview();
    profilePhotoInput.value = '';
    removeProfileRow.hidden = !person.profile_photo_url;
    document.getElementById('remove-profile-photo').checked = false;
    if (person.profile_photo_url) {
      const wrapper = createElement('div', 'preview-item profile-preview-item');
      const image = document.createElement('img');
      image.src = person.profile_photo_url;
      image.alt = `Foto atual de ${person.name}`;
      wrapper.append(image);
      profilePhotoPreview.append(wrapper);
    }
    document.getElementById('form-kicker').textContent = 'SEU CADASTRO';
    document.getElementById('form-title').textContent = 'Editar minha lista';
    document.getElementById('form-intro').textContent = 'Atualize seu nome, foto, produtos, preços, links e observações.';
    submitButton.innerHTML = 'Salvar alterações <span aria-hidden="true">↗</span>';
    errorBox.hidden = true;
    if (friendModal.open) friendModal.close();
    participantModal.showModal();
    setTimeout(() => document.getElementById('participant-name').focus(), 60);
  } catch (error) { showToast(error.message); }
}

function renderFriendProfile(person) {
  currentFriend = person;
  const content = document.getElementById('friend-content');
  content.replaceChildren();

  const personHeader = createElement('div', 'friend-person-header');
  appendProfileAvatar(personHeader, person, 'friend-avatar');
  const identity = createElement('div', 'friend-person-identity');
  identity.append(createElement('h3', '', person.name));
  identity.append(createElement('p', '', `${person.items.length} ${person.items.length === 1 ? 'opção de presente' : 'opções de presente'}`));
  personHeader.append(identity);
  const token = getEditToken(person.id);
  if (token) {
    const editButton = createElement('button', 'secondary-button friend-edit-button', 'Editar meu cadastro');
    editButton.type = 'button';
    editButton.addEventListener('click', () => openEditForm(person.id));
    personHeader.append(editButton);
  }
  content.append(personHeader);
  if (person.comment) {
    const comment = createElement('p', 'card-comment friend-comment', person.comment);
    content.append(comment);
  }

  const itemList = createElement('div', 'gift-choice-list');
  (person.items || []).forEach((item) => {
    const itemCard = createElement('article', 'gift-choice-card');
    itemCard.dataset.itemId = item.id;
    const top = createElement('div', 'gift-choice-top');
    const details = createElement('div', 'gift-choice-description');
    details.append(createElement('p', 'card-label', `PRESENTE ${Number(item.position) + 1}`));
    details.append(createElement('p', 'gift-choice-name', item.description));
    top.append(details, createElement('strong', 'gift-choice-price', money(item.average_price)));
    itemCard.append(top);

    if (Array.isArray(item.images) && item.images.length) {
      const gallery = createElement('div', 'gift-choice-images');
      item.images.forEach((photo, index) => {
        const link = createElement('a', 'card-image');
        link.href = photo.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', `Abrir foto ${index + 1} do produto`);
        const image = document.createElement('img');
        image.src = photo.url;
        image.alt = `Foto do presente ${Number(item.position) + 1}`;
        image.loading = 'lazy';
        link.append(image);
        gallery.append(link);
      });
      itemCard.append(gallery);
    }

    const productActions = createElement('div', 'product-actions');
    const search = createElement('a', 'gift-link google-search-link', '⌕ Pesquisar item no Google ↗');
    search.href = `https://www.google.com/search?q=${encodeURIComponent(item.description)}`;
    search.target = '_blank';
    search.rel = 'noopener noreferrer';
    productActions.append(search);
    const links = Array.isArray(item.links) ? item.links : [];
    links.forEach((url) => {
      const link = createElement('a', 'gift-link', `↗ ${getLinkLabel(url)}`);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = url;
      productActions.append(link);
    });
    itemCard.append(productActions);

    const selectLabel = createElement('label', 'gift-select-row');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'gift-select-checkbox';
    checkbox.dataset.price = String(item.average_price);
    const selectionText = createElement('span', '', 'Quero considerar este presente');
    selectLabel.append(checkbox, selectionText);
    itemCard.append(selectLabel);
    itemList.append(itemCard);
  });
  content.append(itemList);

  const selectionPanel = createElement('section', 'selection-panel');
  const selectionCopy = createElement('div', 'selection-copy');
  selectionCopy.append(createElement('span', 'selection-kicker', 'SUA SELEÇÃO'));
  const totalLine = createElement('p', 'selection-total-line');
  totalLine.append(createElement('span', '', 'Total médio selecionado'));
  const totalValue = createElement('strong', 'selection-total', money(0));
  totalLine.append(totalValue);
  selectionCopy.append(totalLine);
  const selectedCount = createElement('p', 'selection-count', 'Nenhum presente selecionado');
  selectionCopy.append(selectedCount);
  const selectionActions = createElement('div', 'selection-actions');
  const randomButton = createElement('button', 'primary-button random-button', '✦ Escolher aleatoriamente');
  randomButton.type = 'button';
  const clearButton = createElement('button', 'secondary-button clear-selection-button', 'Limpar seleção');
  clearButton.type = 'button';
  selectionActions.append(randomButton, clearButton);
  selectionPanel.append(selectionCopy, selectionActions);
  content.append(selectionPanel);
  content.append(createElement('p', 'selection-privacy-note', 'Sua seleção é temporária e fica somente nesta tela. O site não registra nem mostra quem abriu esta lista.'));

  function updateSelection() {
    const cards = [...itemList.querySelectorAll('.gift-choice-card')];
    const selected = cards.filter((card) => card.querySelector('.gift-select-checkbox').checked);
    const sum = selected.reduce((total, card) => total + Number(card.querySelector('.gift-select-checkbox').dataset.price), 0);
    totalValue.textContent = money(sum);
    selectedCount.textContent = selected.length === 0
      ? 'Nenhum presente selecionado'
      : `${selected.length} ${selected.length === 1 ? 'presente selecionado' : 'presentes selecionados'}`;
    cards.forEach((card) => card.classList.toggle('is-selected', card.querySelector('.gift-select-checkbox').checked));
  }

  itemList.querySelectorAll('.gift-select-checkbox').forEach((checkbox) => checkbox.addEventListener('change', updateSelection));
  randomButton.addEventListener('click', () => {
    const checkboxes = [...itemList.querySelectorAll('.gift-select-checkbox')];
    if (!checkboxes.length) return;
    checkboxes.forEach((checkbox) => { checkbox.checked = false; });
    checkboxes[Math.floor(Math.random() * checkboxes.length)].checked = true;
    updateSelection();
    showToast('Um presente foi escolhido aleatoriamente!');
  });
  clearButton.addEventListener('click', () => {
    itemList.querySelectorAll('.gift-select-checkbox').forEach((checkbox) => { checkbox.checked = false; });
    updateSelection();
  });
}

function getLinkLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.length > 30 ? `${host.slice(0, 27)}...` : host;
  } catch { return 'Ver link do produto'; }
}

async function openFriendList(id) {
  try {
    await window.ASReady;
    const person = await window.AS.get(id);
    renderFriendProfile(person);
    document.getElementById('friend-title').textContent = `Lista de ${person.name}`;
    document.getElementById('friend-intro').textContent = 'Marque um ou mais presentes para somar os preços médios. A sua seleção não é compartilhada.';
    friendModal.showModal();
  } catch (error) { showToast(error.message); }
}

function closeFriendList() {
  if (friendModal.open) friendModal.close();
}

document.getElementById('open-form-button').addEventListener('click', openParticipantForm);
document.getElementById('close-form-button').addEventListener('click', closeParticipantForm);
document.getElementById('cancel-form-button').addEventListener('click', closeParticipantForm);
document.getElementById('close-friend-button').addEventListener('click', closeFriendList);
participantModal.addEventListener('click', (event) => { if (event.target === participantModal) closeParticipantForm(); });
friendModal.addEventListener('click', (event) => { if (event.target === friendModal) closeFriendList(); });

document.getElementById('remove-profile-photo').addEventListener('change', (event) => {
  if (event.target.checked) {
    profilePhotoInput.value = '';
    clearProfilePhotoPreview();
  } else if (existingProfilePhotoUrl && !profilePhotoInput.files[0]) {
    const wrapper = createElement('div', 'preview-item profile-preview-item');
    const image = document.createElement('img');
    image.src = existingProfilePhotoUrl;
    image.alt = 'Foto de perfil atual';
    wrapper.append(image);
    profilePhotoPreview.replaceChildren(wrapper);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const totalFiles = validateTotalSelectedFiles();
  if (totalFiles > MAX_IMAGES) {
    showError(`O limite é de ${MAX_IMAGES} fotos novas no cadastro inteiro, incluindo a foto de perfil.`);
    return;
  }

  const items = [...itemsEditor.children].map((card) => ({
    id: card.dataset.itemId || undefined,
    description: card.querySelector('[data-description]').value.trim(),
    average_price: card.querySelector('[data-price]').value.trim(),
    links: card.querySelector('[data-links]').value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean)
  }));
  if (!items.length) {
    showError('Adicione pelo menos um presente à sua lista.');
    return;
  }
  if (items.some((item) => item.links.length > 5)) {
    showError('Cada presente pode ter no máximo 5 links.');
    return;
  }

  const formData = new FormData();
  formData.set('name', document.getElementById('participant-name').value.trim());
  formData.set('comment', document.getElementById('participant-comment').value.trim());
  formData.set('items', JSON.stringify(items));
  if (profilePhotoInput.files[0]) formData.append('profile_photo', profilePhotoInput.files[0]);
  formData.set('remove_profile_photo', String(document.getElementById('remove-profile-photo').checked));
  [...itemsEditor.children].forEach((card, index) => {
    const files = card.querySelector('.item-photo-input').files;
    [...files].forEach((file) => formData.append(`item_photo_${index}`, file));
  });

  submitButton.disabled = true;
  submitButton.textContent = editParticipantId ? 'Salvando...' : 'Enviando...';
  try {
    await window.ASReady;
    const editing = Boolean(editParticipantId);
    const result = editing
      ? await window.AS.update(editParticipantId, formData, getEditToken(editParticipantId))
      : await window.AS.create(formData);
    if (!editing && result.editToken && result.participant?.id) {
      saveEditToken(result.participant.id, result.editToken);
    }
    const message = editing ? 'Seu cadastro foi atualizado.' : 'Sua participação foi confirmada. Boas festas! 🎁';
    closeParticipantForm();
    form.reset();
    editParticipantId = null;
    await loadParticipants();
    showToast(message);
    document.getElementById('participantes').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    const detail = error?.code === 'permission-denied'
      ? 'O Firebase recusou a gravação. Confira se Authentication → Sign-in method → Anonymous está ativado e publique também os arquivos firestore.rules (Firestore Database → Rules) e storage.rules (Storage → Rules) deste projeto.'
      : (error.message || 'Não foi possível concluir seu cadastro. Tente novamente.');
    showError(detail);
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = editParticipantId ? 'Salvar alterações <span aria-hidden="true">↗</span>' : 'Confirmar participação <span aria-hidden="true">↗</span>';
  }
});

async function loadConfig() {
  try {
    const minimum = 70;
    const formatted = minimum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('minimum-value').textContent = minimum.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    document.getElementById('form-minimum-value').textContent = formatted;
  } catch {
    // O valor padrão de R$ 70 já aparece no HTML.
  }
}

loadConfig();
loadParticipants();
