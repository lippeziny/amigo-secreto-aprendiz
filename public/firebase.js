// Firebase Web SDK: Firestore guarda textos e imagens Base64. Este projeto NÃO usa Firebase Storage.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const APP = window.APP_CONFIG || {};
const config = APP.firebase || {};
const required = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
const configured = required.every((key) => config[key] && !String(config[key]).startsWith("COLE_"));

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Não foi possível ler a imagem ${file.name || "selecionada"}.`));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

// Mesmo princípio usado no Aroma: a foto é reduzida no navegador e salva como Base64 no Firestore.
// O limite por imagem mantém cada documento bem abaixo do teto de 1 MiB do Firestore.
async function compressImage(file, maxDimension = 700, maxChars = 90000) {
  if (!file || !file.size) return null;
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem válido.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Cada imagem original pode ter no máximo 2 MB.");

  const source = await fileToDataUrl(file);
  const image = new Image();
  image.src = source;
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Não foi possível abrir uma das imagens selecionadas."));
  });

  let scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  for (let dimensionTry = 0; dimensionTry < 8; dimensionTry += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Seu navegador não conseguiu processar a imagem.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (let quality = 0.82; quality >= 0.42; quality -= 0.08) {
      const result = canvas.toDataURL("image/jpeg", quality);
      if (result.length <= maxChars) return result;
    }
    scale *= 0.78;
  }
  throw new Error("Esta imagem não pôde ser reduzida o suficiente. Escolha uma foto menor.");
}

window.ASReady = (async () => {
  if (!configured) {
    throw new Error("Firebase ainda não foi configurado. Confira FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_MESSAGING_SENDER_ID e FIREBASE_APP_ID no Render.");
  }

  const app = initializeApp(config);
  const auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  if (!auth.currentUser) await signInAnonymously(auth);
  if (!auth.currentUser) {
    await new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) { unsubscribe(); resolve(); }
      }, reject);
      setTimeout(() => reject(new Error("Não foi possível iniciar a sessão anônima do Firebase.")), 15000);
    });
  }

  const db = getFirestore(app);
  const participants = collection(db, "participants");
  const uid = () => auth.currentUser?.uid || null;
  const itemCollection = (participantId) => collection(db, "participants", participantId, "items");

  async function readItems(participantId, legacyItems = []) {
    const snapshot = await getDocs(query(itemCollection(participantId), orderBy("position", "asc")));
    if (!snapshot.empty) return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    // Compatibilidade: lê cadastros da versão antiga, que guardava os presentes no próprio documento.
    return Array.isArray(legacyItems) ? legacyItems : [];
  }

  async function parseForm(formData, participantId, old = {}) {
    const inputItems = JSON.parse(formData.get("items") || "[]");
    let profilePhoto = old.profile_photo_url || null;
    if (formData.get("remove_profile_photo") === "true") profilePhoto = null;
    const profileFile = formData.get("profile_photo");
    if (profileFile && profileFile.size) profilePhoto = await compressImage(profileFile, 700, 90000);

    const existingItems = Array.isArray(old.items) ? old.items : [];
    const savedItems = [];
    for (let index = 0; index < inputItems.length; index += 1) {
      const input = inputItems[index];
      const itemId = input.id || crypto.randomUUID();
      const previous = existingItems.find((item) => item.id === itemId) || existingItems[index] || {};
      const images = Array.isArray(previous.images) ? [...previous.images] : [];
      const incoming = formData.getAll(`item_photo_${index}`).filter((file) => file && file.size);
      if (incoming.length > 4) throw new Error("Cada presente pode ter no máximo 4 fotos.");
      for (const file of incoming) {
        images.push({ data: await compressImage(file, 700, 90000), type: "image/jpeg" });
      }
      savedItems.push({
        id: itemId,
        description: String(input.description || "").trim(),
        average_price: Number(String(input.average_price || "0").replace(",", ".")),
        links: Array.isArray(input.links) ? input.links : [],
        images,
        position: index
      });
    }

    const allImages = savedItems.reduce((total, item) => total + item.images.length, profilePhoto ? 1 : 0);
    if (allImages > 10) throw new Error("O limite é de 10 fotos no cadastro inteiro, incluindo a foto de perfil.");

    return {
      name: String(formData.get("name") || "").trim(),
      comment: String(formData.get("comment") || "").trim(),
      profile_photo_url: profilePhoto,
      items: savedItems,
      ownerUid: uid(),
      updatedAt: serverTimestamp()
    };
  }

  async function writeParticipant(participantId, data, isNew = false) {
    const parentRef = doc(db, "participants", participantId);
    const existingSnapshot = isNew ? null : await getDocs(itemCollection(participantId));
    const newIds = new Set(data.items.map((item) => item.id));
    const batch = writeBatch(db);
    const parentData = {
      name: data.name,
      comment: data.comment,
      profile_photo_url: data.profile_photo_url || null,
      item_count: data.items.length,
      ownerUid: data.ownerUid,
      updatedAt: data.updatedAt
    };
    if (isNew) parentData.createdAt = serverTimestamp();
    else parentData.items = deleteField();
    if (isNew) batch.set(parentRef, parentData);
    else batch.update(parentRef, parentData);

    for (const item of data.items) {
      batch.set(doc(db, "participants", participantId, "items", item.id), item);
    }
    if (existingSnapshot) {
      existingSnapshot.docs.forEach((entry) => {
        if (!newIds.has(entry.id)) batch.delete(entry.ref);
      });
    }
    await batch.commit();
  }

  window.AS = {
    uid,
    async list() {
      const snapshot = await getDocs(query(participants, orderBy("createdAt", "asc")));
      return snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          id: entry.id,
          name: data.name,
          profile_photo_url: data.profile_photo_url || null,
          item_count: Number(data.item_count ?? (Array.isArray(data.items) ? data.items.length : 0))
        };
      });
    },
    async get(id) {
      const snapshot = await getDoc(doc(db, "participants", id));
      if (!snapshot.exists()) throw new Error("Esta lista não existe mais.");
      const data = snapshot.data();
      const items = await readItems(id, data.items || []);
      return { id: snapshot.id, ...data, items };
    },
    async create(formData) {
      const id = crypto.randomUUID();
      const data = await parseForm(formData, id);
      await writeParticipant(id, data, true);
      return { participant: { id }, editToken: uid() };
    },
    async update(id, formData, token) {
      if (!uid() || token !== uid()) throw new Error("Esta edição só pode ser feita no navegador em que você participou.");
      const parentRef = doc(db, "participants", id);
      const snapshot = await getDoc(parentRef);
      if (!snapshot.exists()) throw new Error("Cadastro não encontrado.");
      const oldData = snapshot.data();
      if (oldData.ownerUid !== uid()) throw new Error("Você não tem permissão para editar este cadastro.");
      const oldItems = await readItems(id, oldData.items || []);
      const data = await parseForm(formData, id, { ...oldData, items: oldItems });
      await writeParticipant(id, data, false);
      return { participant: { id } };
    }
  };

  return window.AS;
})();
