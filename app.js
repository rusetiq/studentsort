const adjectives = ['Super', 'Sparkly', 'Astro', 'Bouncy', 'Mighty', 'Cosmic', 'Mega', 'Hyper', 'Dino', 'Magic', 'Happy', 'Golden', 'Neon', 'Speedy', 'Flying', 'Cheery', 'Lively', 'Groovy'];
const nouns = ['Pandas', 'Rockets', 'Unicorns', 'Wizards', 'Dinos', 'Ninjas', 'Tigers', 'Koalas', 'Robots', 'Monsters', 'Dragons', 'Stars', 'Comets', 'Foxes', 'Bears', 'Monkeys', 'Leopards', 'Badgers'];

let students = [];
let confettiAnimationId = null;
let ws = null;
let sortTimer = null;
const roomCode = 'teamsorter-global-default-room-sync';
const clientId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

const inputName = document.getElementById('student-name');
const listContainer = document.getElementById('student-list');
const welcomeMsg = document.getElementById('welcome-message');
const sortingZone = document.getElementById('magic-sorting-zone');
const boardContent = document.getElementById('whiteboard-content');
const canvas = document.getElementById('confetti-canvas');
const ctx = canvas.getContext('2d');

let genderSelected = 'boy';

document.getElementById('boy-btn').addEventListener('click', () => selectGender('boy'));
document.getElementById('girl-btn').addEventListener('click', () => selectGender('girl'));
document.getElementById('add-student-btn').addEventListener('click', addSingleStudent);
document.getElementById('clear-btn').addEventListener('click', clearAll);
document.getElementById('sort-btn').addEventListener('click', sortTeams);
document.getElementById('csv-import-btn').addEventListener('click', importCSV);

inputName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSingleStudent();
});

function initRoom() {
  if (ws) {
    try { ws.close(); } catch(e) {}
  }
  ws = new WebSocket(`wss://ntfy.sh/${roomCode}/ws`);
  ws.onopen = () => {
    setTimeout(() => {
      sendSync({ type: 'request_roster' });
    }, 500);
  };
  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.event !== 'message') return;
      if (!payload.message) return;
      const data = JSON.parse(payload.message);
      if (data.sender === clientId) return;
      handleIncomingSync(data);
    } catch (e) {}
  };
  ws.onclose = () => {
    setTimeout(initRoom, 2000);
  };
  ws.onerror = () => {
    try { ws.close(); } catch(e) {}
  };
}

function sendSync(action) {
  action.sender = clientId;
  fetch(`https://ntfy.sh/${roomCode}`, {
    method: 'POST',
    body: JSON.stringify(action)
  });
}

function handleIncomingSync(data) {
  if (data.type === 'add') {
    if (!students.some(s => s.id === data.student.id)) {
      students.push(data.student);
      renderStudentList();
    }
  } else if (data.type === 'remove') {
    students = students.filter(s => s.id !== data.id);
    renderStudentList();
  } else if (data.type === 'clear') {
    students = [];
    renderStudentList();
    resetBoardUI();
  } else if (data.type === 'sort') {
    triggerSortAnimation(data.teams);
  } else if (data.type === 'request_roster') {
    if (students.length > 0) {
      sendSync({ type: 'roster_sync', students });
    }
  } else if (data.type === 'roster_sync') {
    if (students.length === 0) {
      students = data.students;
      renderStudentList();
    }
  }
}

function selectGender(gender) {
  genderSelected = gender;
  document.getElementById('boy-btn').classList.toggle('selected', gender === 'boy');
  document.getElementById('girl-btn').classList.toggle('selected', gender === 'girl');
}

function addSingleStudent() {
  const name = inputName.value.trim();
  if (!name) return;
  addStudent(name, genderSelected);
  inputName.value = '';
  inputName.focus();
}

function importCSV() {
  const text = document.getElementById('csv-import-text').value;
  if (!text.trim()) return;
  const lines = text.split('\n');
  lines.forEach(line => {
    if (!line.trim()) return;
    let name = '';
    let gender = 'boy';
    if (line.includes(',')) {
      const parts = line.split(',');
      name = parts[0].trim();
      const g = parts[1] ? parts[1].trim().toLowerCase() : '';
      if (g === 'f' || g === 'female' || g === 'girl') {
        gender = 'girl';
      }
    } else if (line.includes('-')) {
      const parts = line.split('-');
      const g = parts[parts.length - 1].trim().toLowerCase();
      name = parts.slice(0, parts.length - 1).join('-').trim();
      if (g === 'female' || g === 'f' || g === 'girl') {
        gender = 'girl';
      }
    } else {
      name = line.trim();
      gender = Math.random() > 0.5 ? 'boy' : 'girl';
    }
    if (name) {
      addStudent(name, gender);
    }
  });
  document.getElementById('csv-import-text').value = '';
}

function addStudent(name, gender, id) {
  const studentId = id || Date.now() + Math.random().toString(36).substr(2, 9);
  const student = { id: studentId, name, gender };
  students.push(student);
  renderStudentList();
  sendSync({ type: 'add', student });
}

function removeStudent(id) {
  students = students.filter(s => s.id !== id);
  renderStudentList();
  sendSync({ type: 'remove', id });
}

window.removeStudent = removeStudent;

function renderStudentList() {
  listContainer.innerHTML = '';
  students.forEach(student => {
    const div = document.createElement('div');
    div.className = `student-item ${student.gender}`;
    div.innerHTML = `
      <span class="student-info">
        <span>${student.name} (${student.gender === 'boy' ? 'Boy' : 'Girl'})</span>
      </span>
      <button class="remove-student-btn" onclick="removeStudent('${student.id}')">&times;</button>
    `;
    listContainer.appendChild(div);
  });
}

function clearAll() {
  students = [];
  renderStudentList();
  resetBoardUI();
  sendSync({ type: 'clear' });
}

function resetBoardUI() {
  stopConfetti();
  if (sortTimer) {
    clearTimeout(sortTimer);
    sortTimer = null;
  }
  welcomeMsg.style.display = 'flex';
  sortingZone.style.display = 'none';
  const existingGrid = document.querySelector('.teams-grid');
  if (existingGrid) existingGrid.remove();
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function generateTeamName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

function sortTeams() {
  if (students.length === 0) return;
  const teams = performSortingLogic();
  if (teams.length === 0) {
    alert('Need at least one boy and one girl to form mixed teams!');
    return;
  }
  sendSync({ type: 'sort', teams });
  triggerSortAnimation(teams);
}

function triggerSortAnimation(teams) {
  resetBoardUI();
  welcomeMsg.style.display = 'none';
  sortingZone.style.display = 'flex';

  sortTimer = setTimeout(() => {
    sortTimer = null;
    sortingZone.style.display = 'none';
    renderTeams(teams);
  }, 1800);
}

function performSortingLogic() {
  const boys = students.filter(s => s.gender === 'boy');
  const girls = students.filter(s => s.gender === 'girl');
  shuffleArray(boys);
  shuffleArray(girls);

  if (boys.length === 0 || girls.length === 0) {
    return [];
  }

  const rawTeams = [];

  while (boys.length >= 2 && girls.length >= 1) {
    rawTeams.push([boys.pop(), boys.pop(), girls.pop()]);
  }

  while (boys.length >= 1 && girls.length >= 2) {
    rawTeams.push([boys.pop(), girls.pop(), girls.pop()]);
  }

  while (boys.length >= 1 && girls.length >= 1) {
    rawTeams.push([boys.pop(), girls.pop()]);
  }

  while (boys.length >= 3) {
    rawTeams.push([boys.pop(), boys.pop(), boys.pop()]);
  }

  while (girls.length >= 3) {
    rawTeams.push([girls.pop(), girls.pop(), girls.pop()]);
  }

  const leftovers = [...boys, ...girls];
  if (leftovers.length > 0) {
    rawTeams.push(leftovers);
  }

  const teams = rawTeams.map(members => ({
    name: generateTeamName(),
    members: members
  }));

  return teams;
}

function renderTeams(teams) {
  if (!teams || !Array.isArray(teams)) return;
  const grid = document.createElement('div');
  grid.className = 'teams-grid';
  boardContent.appendChild(grid);

  teams.forEach((team, index) => {
    if (!team) return;
    const card = document.createElement('div');
    const colorIdx = index % 5;
    card.className = `team-card color-${colorIdx}`;
    card.style.animationDelay = `${index * 0.15}s`;

    let teamName = '';
    let members = [];

    if (Array.isArray(team)) {
      members = team;
      teamName = generateTeamName();
    } else {
      teamName = team.name || generateTeamName();
      members = team.members || [];
    }

    const boyCount = members.filter(s => s && s.gender === 'boy').length;
    const girlCount = members.filter(s => s && s.gender === 'girl').length;

    let membersHtml = '';
    members.forEach(member => {
      if (!member) return;
      membersHtml += `
        <div class="team-member ${member.gender}">
          <span>${member.name} (${member.gender === 'boy' ? 'Boy' : 'Girl'})</span>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="team-header">
        <span class="team-name">${teamName}</span>
        <span class="team-number">#${index + 1}</span>
      </div>
      <div class="team-members">
        ${membersHtml}
      </div>
      <div class="team-stats">
        <span class="stats-label">Boys: ${boyCount}</span>
        <span class="stats-label">Girls: ${girlCount}</span>
      </div>
    `;
    grid.appendChild(card);
  });

  startConfetti();
}

let confettiParticles = [];

function resizeCanvas() {
  canvas.width = boardContent.clientWidth;
  canvas.height = boardContent.clientHeight;
}

function startConfetti() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  confettiParticles = [];
  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#ff7849'];
  for (let i = 0; i < 100; i++) {
    confettiParticles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: 6 + Math.random() * 6,
      d: Math.random() * canvas.height,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 5,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tiltAngle: 0
    });
  }

  if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let active = false;
  confettiParticles.forEach(p => {
    p.tiltAngle += p.tiltAngleIncremental;
    p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
    p.x += Math.sin(p.tiltAngle);
    p.tilt = Math.sin(p.tiltAngle - p.r / 2) * 15;

    if (p.y <= canvas.height) {
      active = true;
    }

    ctx.beginPath();
    ctx.lineWidth = p.r;
    ctx.strokeStyle = p.color;
    ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
    ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
    ctx.stroke();
  });

  if (active) {
    confettiAnimationId = requestAnimationFrame(animateConfetti);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function stopConfetti() {
  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  window.removeEventListener('resize', resizeCanvas);
}

initRoom();
