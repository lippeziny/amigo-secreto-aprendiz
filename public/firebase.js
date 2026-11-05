// Firebase Web SDK: usa a mesma abordagem do projeto AromaShop (configuração via /config.js).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const APP = window.APP_CONFIG || {};
const config = APP.firebase || {};
const required = ["apiKey","authDomain","projectId","storageBucket","messagingSenderId","appId"];
const configured = required.every(k => config[k] && !String(config[k]).startsWith("COLE_"));
window.ASReady = (async () => {
  if (!configured) throw new Error("Firebase ainda não foi configurado. Adicione as chaves do Firebase nas variáveis de ambiente do Render.");
  const app = initializeApp(config);
  const auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  if (!auth.currentUser) await signInAnonymously(auth);
  if (!auth.currentUser) await new Promise((resolve,reject) => {
    const unsub = onAuthStateChanged(auth,u=>{if(u){unsub();resolve();}});
    setTimeout(()=>reject(new Error("Não foi possível iniciar a sessão Firebase.")),15000);
  });
  const db = getFirestore(app), storage = getStorage(app), col = collection(db,"participants");
  const uid = () => auth.currentUser?.uid;
  const upload = async (file,path) => {
    if(!file || !file.size) return null;
    if(file.size > 2*1024*1024) throw new Error("Cada imagem pode ter no máximo 2 MB.");
    const r=ref(storage,path);
    await uploadBytes(r,file,{contentType:file.type});
    return await getDownloadURL(r);
  };
  const publicPerson = (id,d) => ({id,...d});
  async function parseForm(fd, id, old={}) {
    const items=JSON.parse(fd.get("items")||"[]");
    let profile=old.profile_photo_url||null;
    if(fd.get("remove_profile_photo")==="true") profile=null;
    const profileFile=fd.get("profile_photo");
    if(profileFile && profileFile.size) profile=await upload(profileFile,`participants/${uid()}/${id}/profile-${Date.now()}`);
    const savedItems=[];
    for(let i=0;i<items.length;i++){
      const item=items[i], prior=(old.items||[]).find(x=>x.id===item.id)||{};
      const images=[...(prior.images||[])];
      const incoming=fd.getAll(`item_photo_${i}`).filter(f=>f&&f.size);
      for(const file of incoming) images.push({url:await upload(file,`participants/${uid()}/${id}/items/${item.id||i}-${Date.now()}-${images.length}`)});
      savedItems.push({...item,id:item.id||crypto.randomUUID(),average_price:Number(String(item.average_price).replace(",", ".")),images,position:i});
    }
    return {name:String(fd.get("name")||"").trim(),comment:String(fd.get("comment")||"").trim(),profile_photo_url:profile,items:savedItems,ownerUid:uid(),updatedAt:serverTimestamp()};
  }
  window.AS = {
    uid,
    async list(){
      const snap=await getDocs(query(col,orderBy("createdAt","asc")));
      return snap.docs.map(d=>{const x=d.data();return {id:d.id,name:x.name,profile_photo_url:x.profile_photo_url||null,item_count:(x.items||[]).length};});
    },
    async get(id){const s=await getDoc(doc(db,"participants",id));if(!s.exists())throw new Error("Esta lista não existe mais.");return publicPerson(s.id,s.data());},
    async create(fd){
      const id=crypto.randomUUID();
      const data=await parseForm(fd,id);
      data.createdAt=serverTimestamp();
      await setDoc(doc(db,"participants",id),data);
      return {participant:{id},editToken:uid()};
    },
    async update(id,fd,token){
      if(!uid() || token!==uid()) throw new Error("Esta edição só pode ser feita no navegador em que você participou.");
      const r=doc(db,"participants",id),s=await getDoc(r);
      if(!s.exists())throw new Error("Cadastro não encontrado.");
      if(s.data().ownerUid!==uid())throw new Error("Você não tem permissão para editar este cadastro.");
      const data=await parseForm(fd,id,s.data());
      await updateDoc(r,data);
      return {participant:{id}};
    }
  };
  return window.AS;
})();
