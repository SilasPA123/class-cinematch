import { FIREBASE_CONFIG } from "./config.js";
import { DEMO_PARTICIPANTS } from "./demo.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

// Interface comum: { mode, ready(): Promise<myId>, subscribe(cb), save(entry), remove() }
export function createStore() {
  return FIREBASE_CONFIG ? firebaseStore() : localStore();
}

function localStore() {
  const KEY = "cinematch_demo_participants_v2", ME = "cinematch_demo_me";
  const read = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignora */ }
    return DEMO_PARTICIPANTS.slice();
  };
  const write = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignora */ } };
  let myId = null;
  try { myId = localStorage.getItem(ME); } catch { /* ignora */ }
  if (!myId) {
    myId = "me-" + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(ME, myId); } catch { /* ignora */ }
  }
  const subs = new Set();
  const emit = () => subs.forEach(cb => cb(read()));
  window.addEventListener("storage", emit);
  return {
    mode: "demo",
    ready: async () => myId,
    subscribe(cb) { subs.add(cb); cb(read()); return () => subs.delete(cb); },
    async save(entry) {
      const list = read().filter(p => p.id !== myId);
      list.push({ id: myId, name: entry.name, films: entry.films, updatedAt: Date.now() });
      write(list); emit();
    },
    async remove() { write(read().filter(p => p.id !== myId)); emit(); },
    async reset() { try { localStorage.removeItem(KEY); } catch { /* ignora */ } emit(); }
  };
}

function firebaseStore() {
  let ctx = null;
  const init = async () => {
    if (ctx) return ctx;
    const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all([
      import(FB + "firebase-app.js"), import(FB + "firebase-auth.js"), import(FB + "firebase-firestore.js")
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = getAuth(app);
    const cred = await signInAnonymously(auth);
    ctx = { db: fs.getFirestore(app), fs, uid: cred.user.uid };
    return ctx;
  };
  return {
    mode: "firebase",
    async ready() { return (await init()).uid; },
    subscribe(cb) {
      let off = () => {};
      init().then(({ db, fs }) => {
        off = fs.onSnapshot(fs.collection(db, "participants"), snap => {
          cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, err => console.error("Firestore", err));
      }).catch(err => console.error("Firebase init", err));
      return () => off();
    },
    async save(entry) {
      const { db, fs, uid } = await init();
      await fs.setDoc(fs.doc(db, "participants", uid), {
        name: entry.name, films: entry.films, updatedAt: fs.serverTimestamp()
      });
    },
    async remove() {
      const { db, fs, uid } = await init();
      await fs.deleteDoc(fs.doc(db, "participants", uid));
    }
  };
}
