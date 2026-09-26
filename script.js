/* ---------- helpers & storage (localStorage acts as the "database") ---------- */
const $ = s => document.querySelector(s);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const img = s => `https://picsum.photos/seed/${s}/600/600`;
const VID = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
const VID2 = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';
const ago = t => { const m = (Date.now() - t) / 6e4; return m < 1 ? 'just now' : m < 60 ? ~~m + 'm' : m < 1440 ? ~~(m / 60) + 'h' : ~~(m / 1440) + 'd' };

let users = load('ig_users', null), posts = load('ig_posts', null), msgs = load('ig_msgs', {});
let stories = load('ig_stories', {});
let me = localStorage.getItem('ig_me'), view = 'home', chatWith = null, profUser = null, tab = 'posts', query = '';

const save = () => {
  try {
    localStorage.setItem('ig_users', JSON.stringify(users));
    localStorage.setItem('ig_posts', JSON.stringify(posts));
    localStorage.setItem('ig_msgs', JSON.stringify(msgs));
    localStorage.setItem('ig_stories', JSON.stringify(stories));
  } catch { alert('Storage full – try a smaller image/video.') }
};
const av = u => users[u]?.avatar || img(u);

/* ---------- demo data ---------- */
if (!users) {
  users = {}; posts = [];
  const bios = ['Wanderlust ✈️', 'Foodie 🍜', 'Gym rat 💪', 'Colors & canvas 🎨'];
  ['maya_travels', 'arjun_eats', 'leo_fit', 'sana_art'].forEach((u, i) => {
    users[u] = { pass: 'demo', name: u.split('_')[0], email: u + '@demo.com', bio: bios[i],
      avatar: `https://i.pravatar.cc/150?img=${i + 11}`, following: [], saved: [] };
    for (let j = 0; j < 3; j++) posts.push({ id: Date.now() - (i * 3 + j) * 36e5, user: u, type: 'image', src: img(u + j),
      caption: `${bios[i]} #${u.split('_')[1]} #life`, likes: [], comments: [{ u: 'sana_art', t: 'Love this!' }], reel: false });
    posts.push({ id: Date.now() - i * 5e5, user: u, type: 'video', src: VID, caption: `Reel time #reels`, likes: [], comments: [], reel: true });
    posts.push({ id: Date.now() - i * 5e5 - 1e5, user: u, type: 'video', src: VID2, caption: `Weekend vibes #reels #fun`, likes: [], comments: [], reel: true });
  });
  save();
}
/* migration: give existing (already-saved) demo accounts the second reel too */
if (!localStorage.getItem('ig_v2')) {
  Object.keys(users).forEach((u, i) => {
    if (!posts.some(p => p.user === u && p.src === VID2)) {
      posts.push({ id: Date.now() - i * 7e5 - 2e5, user: u, type: 'video', src: VID2, caption: `Weekend vibes #reels #fun`, likes: [], comments: [], reel: true });
    }
  });
  localStorage.setItem('ig_v2', 1); save();
}
/* migration: swap old demo video URLs for new ones */
if (!localStorage.getItem('ig_v4')) {
  const OLD1 = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
  const OLD2 = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4';
  posts.forEach(p => { if (p.src === OLD1) p.src = VID; else if (p.src === OLD2) p.src = VID2; });
  localStorage.setItem('ig_v4', 1); save();
}
if (!localStorage.getItem('ig_v3')) {
  const firstUser = Object.keys(users)[0];
  if (firstUser) {
    posts.push({ id: Date.now() + 1e5, user: firstUser, type: 'video', src: VID, poster: 'https://cataas.com/cat',
      caption: 'Meet my cat 🐱 #catsofinstagram #reels #cute', likes: [], comments: [], reel: true });
  }
  localStorage.setItem('ig_v3', 1); save();
}

/* ---------- auth ---------- */
let signup = false;
const authErr = m => $('#authErr').textContent = m;
$('#authToggle').onclick = e => {
  e.preventDefault(); signup = !signup;
  $('#authBtn').textContent = signup ? 'Sign up' : 'Log in';
  $('#authText').textContent = signup ? 'Have an account?' : "Don't have an account?";
  $('#authToggle').textContent = signup ? 'Log in' : 'Sign up'; authErr('');
};
$('#authForm').onsubmit = e => {
  e.preventDefault();
  const u = $('#username').value.trim().toLowerCase(), p = $('#password').value;
  if (signup) {
    if (users[u]) return authErr('Username already taken.');
    users[u] = { pass: p, name: u, email: '', bio: '',
      avatar: `https://i.pravatar.cc/150?u=${u}`, following: [], saved: [] };
    save();
  } else if (!users[u] || users[u].pass !== p) return authErr('Wrong username or password.');
  me = u; localStorage.setItem('ig_me', u); start();
};
function start() {
  if (!me || !users[me]) { $('#auth').hidden = false; $('#app').hidden = true; return }
  $('#auth').hidden = true; $('#app').hidden = false; profUser = me;
  if (localStorage.getItem('ig_dark')) document.body.classList.add('dark');
  render();
}

/* ---------- views ---------- */
function render() {
  document.querySelectorAll('nav [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === view));
  const v = $('#view'); v.className = view;
  ({ home, search: searchV, reels: reelsV, messages: msgV, profile: profV })[view](v);
}

/* home: stories + feed */
function home(v) {
  const feed = posts.filter(p => !p.reel).sort((a, b) => b.id - a.id);
  v.innerHTML = `<div class="stories">${Object.keys(users).map(u => u === me
    ? `<div class="story" data-act="story" data-u="${u}"><span class="savatar"><img src="${av(u)}"><b class="plus" data-act="addStory">+</b></span><span>Your story</span></div>`
    : `<div class="story" data-act="story" data-u="${u}"><img src="${av(u)}"><span>${esc(u)}</span></div>`).join('')}</div>`
    + (feed.map(postHTML).join('') || '<p class="empty">No posts yet. Tap Create to share your first one.</p>');
}
function postHTML(p) {
  const liked = p.likes.includes(me), sv = users[me].saved.includes(p.id);
  return `<article class="post" data-id="${p.id}">
    <div class="ph"><img class="sm" src="${av(p.user)}"><b data-act="prof" data-u="${p.user}">${esc(p.user)}</b><small>${ago(p.id)}</small>
      ${p.user === me ? '<span data-act="del" class="r" style="margin-left:auto">🗑️</span>' : ''}</div>
    ${p.type === 'video' ? `<video src="${p.src}" controls loop muted playsinline></video>` : `<img class="pi" src="${p.src}" data-act="dbl" alt="">`}
    <div class="bar"><span data-act="like" class="${liked ? 'red' : ''}">${liked ? '♥' : '♡'}</span><span data-act="focus">💬</span><span data-act="share">✈️</span><span data-act="save" class="r">${sv ? '★' : '☆'}</span></div>
    <div class="pb"><b>${p.likes.length} likes</b><p><b>${esc(p.user)}</b> ${esc(p.caption)}</p>
      ${p.comments.map(c => `<p><b>${esc(c.u)}</b> ${esc(c.t)}</p>`).join('')}</div>
    <div class="cm"><input placeholder="Add a comment…"><button data-act="comment">Post</button></div></article>`;
}

/* search */
function searchV(v) {
  v.innerHTML = `<input id="q" class="q" placeholder="Search users, captions or #hashtags" value="${esc(query)}"><div id="res"></div>`;
  $('#q').oninput = e => { query = e.target.value; results() }; results();
}
function results() {
  const s = query.toLowerCase().trim();
  const us = s ? Object.keys(users).filter(u => u.includes(s) || users[u].name.toLowerCase().includes(s)) : [];
  const ps = posts.filter(p => !s || p.caption.toLowerCase().includes(s) || p.user.includes(s));
  $('#res').innerHTML = us.map(u => `<div class="urow" data-act="prof" data-u="${u}"><img class="sm" src="${av(u)}"><div><b>${esc(u)}</b><br><small>${esc(users[u].name)}</small></div></div>`).join('')
    + `<div class="grid">${ps.map(gridItem).join('')}</div>` + (!us.length && !ps.length ? '<p class="empty">No results found.</p>' : '');
}
const gridItem = p => `<div class="gi" data-act="open" data-id="${p.id}">${p.type === 'video' ? `<video src="${p.src}" muted></video><i>🎬</i>` : `<img src="${p.src}" alt="">`}</div>`;

/* reels */
function reelsV(v) {
  const r = posts.filter(p => p.reel).sort((a, b) => b.id - a.id);
  v.innerHTML = r.map(reelHTML).join('') || '<p class="empty" style="color:#fff">No reels yet.</p>';
  observe();
}
function reelHTML(p) {
  const liked = p.likes.includes(me);
  return `<div class="reel" data-id="${p.id}"><video src="${p.src}" ${p.poster ? `poster="${p.poster}"` : ''} loop muted playsinline data-act="mute"></video>
    <div class="side"><span data-act="like" class="${liked ? 'red' : ''}">${liked ? '♥' : '♡'}</span><small>${p.likes.length}</small>
    <span data-act="rcomment">💬</span><small>${p.comments.length}</small><span data-act="share">✈️</span></div>
    <div class="cap"><b data-act="prof" data-u="${p.user}">@${esc(p.user)}</b><br>${esc(p.caption)}</div></div>`;
}const io = new IntersectionObserver(es => es.forEach(en => {
  const v = en.target.querySelector('video'); en.isIntersecting ? v.play().catch(() => {}) : v.pause();
}), { threshold: .7 });
const observe = () => document.querySelectorAll('.reel').forEach(r => io.observe(r));

/* messages */
const ckey = u => [me, u].sort().join('|');
function msgV(v) {
  v.innerHTML = `<div class="chat"><aside>${Object.keys(users).filter(u => u !== me).map(u =>
    `<div class="ci ${u === chatWith ? 'on' : ''}" data-act="chat" data-u="${u}"><img class="sm" src="${av(u)}">${esc(u)}</div>`).join('')}</aside>
    <section>${chatWith ? `<div class="chead"><img class="sm" src="${av(chatWith)}"><b>${esc(chatWith)}</b></div>
      <div id="msgs">${(msgs[ckey(chatWith)] || []).map(m => `<div class="m ${m.f === me ? 'me' : ''}">${msgBubble(m)}</div>`).join('') || '<p class="empty">Say hi 👋</p>'}</div>
      <div class="mform"><input id="chatIn" placeholder="Message…"><button class="pri" data-act="send">Send</button></div>`
      : '<p class="empty">Pick a chat to start messaging</p>'}</section></div>`;
  const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight;
}
function msgBubble(m) {
  if (!m.shared) return esc(m.t);
  const s = m.shared, exists = posts.some(x => x.id === s.id);
  return `<div class="shareCard" ${exists ? `data-act="open" data-id="${s.id}"` : ''}>
    ${s.type === 'video' ? `<video src="${s.src}" muted></video>` : `<img src="${s.src}">`}
    <small>${esc(s.user)}'s ${s.reel ? 'reel' : 'post'}</small></div>`;
}
function send() {
  const i = $('#chatIn'), t = i.value.trim(); if (!t) return;
  const k = ckey(chatWith), to = chatWith; (msgs[k] ||= []).push({ f: me, t }); save(); msgV($('#view')); $('#chatIn').focus();
  setTimeout(() => { // simulated reply so the demo feels alive
    (msgs[k] ||= []).push({ f: to, t: ['Haha nice!', 'Tell me more 😄', 'Love it ❤️', 'Let’s catch up soon!'][~~(Math.random() * 4)] }); save();
    if (view === 'messages' && chatWith === to) { msgV($('#view')); }
  }, 1200);
}

/* profile */
function profV(v) {
  const u = profUser, d = users[u], mine = u === me, ps = posts.filter(p => p.user === u);
  const followers = Object.keys(users).filter(x => users[x].following.includes(u)).length;
  const list = tab === 'saved' && mine ? posts.filter(p => users[me].saved.includes(p.id)) : ps;
  v.innerHTML = `<div class="prof"><img class="big" src="${d.avatar}"><div>
    <h2>${esc(u)} ${mine ? '<button data-act="edit">Edit profile</button><button data-act="logout">Log out</button>'
      : `<button class="pri" data-act="follow" data-u="${u}">${users[me].following.includes(u) ? 'Following' : 'Follow'}</button><button data-act="chat" data-u="${u}" data-go="1">Message</button>`}</h2>
    <p><b>${ps.length}</b> posts &nbsp; <b>${followers}</b> followers &nbsp; <b>${d.following.length}</b> following</p>
    <p><b>${esc(d.name)}</b><br>${esc(d.bio || '')}</p></div></div>
    ${mine ? `<div class="tabs"><button data-act="tab" data-t="posts" class="${tab === 'posts' ? 'on' : ''}">Posts</button><button data-act="tab" data-t="saved" class="${tab === 'saved' ? 'on' : ''}">Saved</button></div>` : ''}
    <div class="grid">${list.sort((a, b) => b.id - a.id).map(gridItem).join('') || '<p class="empty" style="grid-column:1/-1">Nothing here yet.</p>'}</div>`;
}

/* ---------- modals ---------- */
const modal = $('#modal');
const openModal = html => { modal.innerHTML = html; modal.hidden = false };
const closeModal = () => { modal.hidden = true; modal.innerHTML = '' };
modal.onclick = e => { if (e.target === modal) closeModal() };

function createModal() {
  openModal(`<div class="box"><h3>Create new post</h3><input type="file" id="file" accept="image/*,video/*">
    <div id="pv"></div><textarea id="cap" rows="3" placeholder="Write a caption… #hashtags"></textarea>
    <label><input type="checkbox" id="isReel" style="width:auto"> Share as a reel (video only)</label>
    <button class="pri" data-act="publish">Share</button></div>`);
  $('#file').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    $('#pv').innerHTML = f.type.startsWith('video') ? `<video class="prev" controls src="${URL.createObjectURL(f)}"></video>` : `<img class="prev" src="${URL.createObjectURL(f)}">`;
  };
}
function publish() {
  const f = $('#file').files[0]; if (!f) return alert('Choose a photo or video first.');
  const isVid = f.type.startsWith('video'), reel = $('#isReel').checked;
  if (reel && !isVid) return alert('Reels must be videos.');
  const r = new FileReader();
  r.onload = () => {
    posts.push({ id: Date.now(), user: me, type: isVid ? 'video' : 'image', src: r.result, caption: $('#cap').value, likes: [], comments: [], reel });
    save(); closeModal(); view = reel ? 'reels' : 'home'; render();
  };
  r.readAsDataURL(f);
}
function editModal() {
  const d = users[me];
  openModal(`<div class="box"><h3>Edit profile</h3>
    <div style="display:flex;align-items:center;gap:14px">
      <img id="avPrev" class="sm" style="width:64px;height:64px" src="${d.avatar}">
      <label class="pri" style="display:inline-block" for="avFile">Change photo</label>
      <input type="file" id="avFile" accept="image/*" hidden>
    </div>
    <input id="edName" placeholder="Name" value="${esc(d.name)}">
    <textarea id="edBio" rows="3" placeholder="Bio">${esc(d.bio || '')}</textarea>
    <button class="pri" data-act="saveEdit">Save</button></div>`);
  let newAvatar = null;
  $('#avFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { newAvatar = r.result; $('#avPrev').src = newAvatar };
    r.readAsDataURL(f);
  };
  $('#modal').dataset.avatar = '';
  $('[data-act="saveEdit"]').onclick = () => {
    const n = $('#edName').value.trim();
    if (n) d.name = n;
    d.bio = $('#edBio').value;
    if (newAvatar) d.avatar = newAvatar;
    save(); closeModal(); render();
  };
}
function shareModal(p) {
  const thumb = p.type === 'video' ? `<video class="prev" src="${p.src}" muted></video>` : `<img class="prev" src="${p.src}">`;
  openModal(`<div class="box"><h3>Share ${p.reel ? 'reel' : 'post'}</h3>${thumb}
    <div>${Object.keys(users).filter(u => u !== me).map(u =>
      `<div class="urow" style="padding:8px 0"><img class="sm" src="${av(u)}"><div style="flex:1"><b>${esc(u)}</b></div>
       <button class="pri" data-act="sendShare" data-id="${p.id}" data-u="${u}">Send</button></div>`).join('') || '<p class="empty">No one to share with yet.</p>'}</div>
    <button data-act="copyLink" data-id="${p.id}">Copy link</button></div>`);
}
function sendShare(id, u) {
  const p = posts.find(x => x.id === id); if (!p) return;
  (msgs[ckey(u)] ||= []).push({ f: me, shared: { id: p.id, type: p.type, src: p.src, user: p.user, caption: p.caption, reel: p.reel } });
  save(); closeModal(); alert(`Shared with ${u}!`);
}
function storyModal(u) {
  const own = (stories[u] || []).slice().sort((a, b) => b.id - a.id);
  if (own.length) {
    const s = own[0];
    openModal(`<div style="text-align:center;color:#fff">
      <p><img class="sm" src="${av(u)}" style="vertical-align:middle;margin-right:6px"><b>${esc(u)}</b> <small style="color:#ccc">${ago(s.id)}</small></p>
      ${s.type === 'video' ? `<video id="storyImg" src="${s.src}" autoplay muted playsinline></video>` : `<img id="storyImg" src="${s.src}">`}
    </div>`);
    if (s.type !== 'video') setTimeout(() => { if (!modal.hidden && $('#storyImg')) closeModal() }, 4000);
    return;
  }
  const ps = posts.filter(p => p.user === u && p.type === 'image');
  if (!ps.length) return openModal(`<div style="text-align:center;color:#fff"><p><b>${esc(u)}</b></p><p>No story yet.</p></div>`);
  openModal(`<div style="text-align:center;color:#fff"><p><b>${esc(u)}</b></p><img id="storyImg" src="${ps[0].src}"></div>`);
  setTimeout(() => { if (!modal.hidden && $('#storyImg')) closeModal() }, 4000);
}
function addStoryModal() {
  openModal(`<div class="box"><h3>Add to your story</h3><input type="file" id="stFile" accept="image/*,video/*">
    <div id="stPv"></div><button class="pri" data-act="publishStory">Share to story</button></div>`);
  $('#stFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    $('#stPv').innerHTML = f.type.startsWith('video') ? `<video class="prev" controls src="${URL.createObjectURL(f)}"></video>` : `<img class="prev" src="${URL.createObjectURL(f)}">`;
  };
}
function publishStory() {
  const f = $('#stFile').files[0]; if (!f) return alert('Choose a photo or video first.');
  const isVid = f.type.startsWith('video');
  const r = new FileReader();
  r.onload = () => {
    (stories[me] ||= []).push({ id: Date.now(), type: isVid ? 'video' : 'image', src: r.result });
    save(); closeModal(); render();
  };
  r.readAsDataURL(f);
}

/* ---------- one click handler for everything ---------- */
document.addEventListener('click', e => {
  const nb = e.target.closest('nav [data-view]');
  if (nb) { view = nb.dataset.view; if (view === 'profile') { profUser = me; tab = 'posts' } return render() }
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.dataset.act === 'addStory') { e.stopPropagation(); addStoryModal(); return }
  const a = t.dataset.act, po = t.closest('[data-id]'), p = po && posts.find(x => x.id === +po.dataset.id);
  const refresh = () => { save(); po.outerHTML = po.classList.contains('reel') ? reelHTML(p) : postHTML(p); observe() };
  switch (a) {
    case 'create': createModal(); break;
    case 'publishStory': publishStory(); break;
    case 'theme': document.body.classList.toggle('dark'); document.body.classList.contains('dark') ? localStorage.setItem('ig_dark', 1) : localStorage.removeItem('ig_dark'); break;
    case 'publish': publish(); break;
    case 'story': storyModal(t.dataset.u); break;
    case 'prof': closeModal(); profUser = t.dataset.u; tab = 'posts'; view = 'profile'; render(); break;
    case 'open': { const q = posts.find(x => x.id === +t.dataset.id); openModal(`<div class="box">${postHTML(q)}</div>`); break }
    case 'like': case 'dbl': { const i = p.likes.indexOf(me); if (i < 0) p.likes.push(me); else if (a === 'like') p.likes.splice(i, 1); refresh(); break }
    case 'save': { const s = users[me].saved, i = s.indexOf(p.id); i < 0 ? s.push(p.id) : s.splice(i, 1); refresh(); break }
    case 'comment': { const i = po.querySelector('.cm input'); if (i.value.trim()) { p.comments.push({ u: me, t: i.value.trim() }); refresh() } break }
    case 'focus': po.querySelector('.cm input').focus(); break;
    case 'rcomment': { const c = prompt('Add a comment'); if (c) { p.comments.push({ u: me, t: c }); refresh() } break }
    case 'share': shareModal(p); break;
    case 'sendShare': sendShare(+t.dataset.id, t.dataset.u); break;
    case 'copyLink': navigator.clipboard?.writeText(`${location.href}#post-${t.dataset.id}`); t.textContent = 'Copied!'; setTimeout(() => t.textContent = 'Copy link', 1500); break;
    case 'del': if (confirm('Delete this post?')) { posts = posts.filter(x => x !== p); save(); closeModal(); render() } break;
    case 'mute': t.muted = !t.muted; break;
    case 'follow': { const f = users[me].following, u = t.dataset.u, i = f.indexOf(u); i < 0 ? f.push(u) : f.splice(i, 1); save(); render(); break }
    case 'tab': tab = t.dataset.t; render(); break;
    case 'chat': chatWith = t.dataset.u; view = 'messages'; render(); break;
    case 'send': send(); break;
    case 'edit': editModal(); break;
    case 'logout': localStorage.removeItem('ig_me'); me = null; start(); break;
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'chatIn') send();
  else if (e.target.closest('.cm')) e.target.nextElementSibling.click();
});

start();
