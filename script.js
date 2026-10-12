// ===== 1. 필요한 요소 가져오기 =====
const input = document.getElementById("todo-input");
const dueInput = document.getElementById("due-input");
const addBtn = document.getElementById("add-btn");
const list = document.getElementById("todo-list");
const count = document.getElementById("count");
const clearDoneBtn = document.getElementById("clear-done");
const filterBtns = document.querySelectorAll(".filter");
const themeBtn = document.getElementById("theme-btn");
const statusMsg = document.getElementById("status");
const authorInput = document.getElementById("author-input");
const quickDateBtns = document.querySelectorAll(".quick-date");
const authorFilterBox = document.getElementById("author-filter");
const authorFilterText = document.getElementById("author-filter-text");
const authorFilterClear = document.getElementById("author-filter-clear");

// ===== 2. 수퍼베이스 연결 =====
// 할 일은 수퍼베이스(인터넷 저장소)의 todos 표에 저장돼요.
// 그래서 다른 컴퓨터나 휴대폰에서 열어도 같은 목록이 보여요.
// 접속 주소와 열쇠(SUPABASE_URL, SUPABASE_KEY)는 config.js에 있어요.
// 인터넷이 끊겨서 수퍼베이스 도구를 못 불러왔으면 db는 null이에요.
const db = window.supabase ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ===== 3. 데이터 =====
// 할 일 하나는 { id, text, done, due, hidden, author } 모양의 객체예요.
//   due    : 마감 날짜 ("2026-10-05" 같은 글자, 없으면 "")
//   author : 작성자 이름 (안 적었으면 "")
//   progress : 얼마나 했는지 0~100 (%). 100이 되면 완료예요
//   hidden : 완료한 일을 지웠을 때 true → 전체에서는 안 보이고 완료 탭에만 남아요
let todos = [];
let loading = true; // 수퍼베이스에서 불러오는 중인지
let currentFilter = "all"; // "all"(전체) | "active"(진행중: 1~99%) | "done"(완료: 100%)
let authorFilter = ""; // 작성자 이름을 누르면 그 이름이 들어가요 ("" = 모두 보기)

// 지금 보고 있는 작성자의 할 일인지 (이름으로 보기 중이 아니면 항상 true)
function matchesAuthor(todo) {
  return authorFilter === "" || todo.author === authorFilter;
}

// 앱의 할 일 → 수퍼베이스 표의 한 줄 (빈 날짜, 빈 이름은 null로)
function toRow(todo) {
  return {
    id: todo.id,
    text: todo.text,
    done: todo.done,
    due: todo.due || null,
    hidden: todo.hidden,
    author: todo.author || null,
    progress: todo.progress,
  };
}

// 수퍼베이스 표의 한 줄 → 앱의 할 일
function fromRow(row) {
  return {
    id: Number(row.id),
    text: row.text,
    done: row.done,
    due: row.due || "",
    hidden: row.hidden,
    author: row.author || "",
    progress: row.done ? 100 : row.progress || 0, // 완료한 일은 항상 100%
  };
}

// 문제가 생기면 화면 아래에 알려주기
function showError(message, error) {
  console.error(message, error);
  statusMsg.textContent = `${message} (${error.message})`;
}

// 잘 저장되면 이전 오류 알림은 지워요
function clearError() {
  statusMsg.textContent = "";
}

// 수퍼베이스에서 할 일 전부 불러오기
async function load() {
  if (!db) {
    loading = false;
    showError("수퍼베이스에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.", { message: "도구를 불러오지 못함" });
    render();
    return;
  }
  await moveOldTodos();
  const { data, error } = await db.from("todos").select("*").order("id");
  loading = false;
  if (error) {
    showError("할 일을 불러오지 못했어요.", error);
  } else {
    todos = data.map(fromRow);
  }
  render();
}

// 저장/삭제가 실패하면 화면이 실제 저장된 내용과 달라지니까,
// 수퍼베이스에 진짜 저장된 내용으로 다시 불러와요.
async function reloadAfterError() {
  const { data, error } = await db.from("todos").select("*").order("id");
  if (error) return; // 다시 불러오기도 실패하면 오류 알림만 남겨둬요
  todos = data.map(fromRow);
  render();
}

// 예전에 브라우저에만 저장해 둔 할 일이 있으면 수퍼베이스로 한 번 옮겨요
async function moveOldTodos() {
  let old = [];
  try {
    old = JSON.parse(localStorage.getItem("todos")) || [];
  } catch (e) {}
  if (old.length === 0) return;

  const { error } = await db.from("todos").upsert(old.map(toRow));
  if (error) {
    showError("예전 할 일을 옮기지 못했어요.", error);
  } else {
    try {
      localStorage.removeItem("todos"); // 다 옮겼으니 브라우저 쪽은 지워요
    } catch (e) {}
  }
}

// 할 일을 수퍼베이스에 저장하기 (없으면 새로 넣고, 있으면 고쳐요)
async function saveTodos(list) {
  if (list.length === 0 || !db) return;
  const { error } = await db.from("todos").upsert(list.map(toRow));
  if (error) {
    showError("저장하지 못했어요.", error);
    reloadAfterError();
  } else {
    clearError();
  }
}

// 할 일을 수퍼베이스에서 지우기
async function deleteTodos(ids) {
  if (ids.length === 0 || !db) return;
  const { error } = await db.from("todos").delete().in("id", ids);
  if (error) {
    showError("삭제하지 못했어요.", error);
    reloadAfterError();
  } else {
    clearError();
  }
}

// ===== 4. 기능 =====
// 화면은 바로 바꾸고(render), 수퍼베이스 저장은 뒤에서 따로 해요.
function addTodo() {
  const text = input.value.trim();
  if (text === "") return; // 빈 칸이면 추가하지 않음

  const author = authorInput.value.trim(); // 이름은 안 적어도 돼요
  const todo = { id: Date.now(), text: text, done: false, due: dueInput.value, hidden: false, author: author, progress: 0 };
  todos.push(todo);
  input.value = "";
  dueInput.value = todayString(); // 다음 할 일도 오늘 날짜부터 시작
  showQuickDate();
  render();
  saveTodos([todo]);
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  todo.done = !todo.done;
  todo.progress = todo.done ? 100 : 0; // 체크하면 100%, 체크를 풀면 0%
  if (!todo.done) todo.hidden = false; // 완료를 취소하면 전체에 다시 보이게
  render();
  saveTodos([todo]);
}

// 진행률 슬라이더를 놓았을 때 (100%가 되면 완료, 100% 아래로 내리면 다시 진행중)
function setProgress(id, progress) {
  const todo = todos.find((t) => t.id === id);
  todo.progress = progress;
  todo.done = progress === 100;
  if (!todo.done) todo.hidden = false;
  render();
  saveTodos([todo]);
}

// 진짜로 없애기
function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  render();
  deleteTodos([id]);
}

// ✕ 버튼을 눌렀을 때
function removeTodo(todo) {
  if (todo.done && currentFilter !== "done") {
    todo.hidden = true; // 완료한 일은 전체에서만 숨기고 완료 탭에는 남김
    render();
    saveTodos([todo]);
  } else {
    deleteTodo(todo.id); // 안 끝난 일이거나, 완료 탭에서 지우면 진짜 삭제
  }
}

function editTodo(id, newText) {
  const text = newText.trim();
  const todo = todos.find((t) => t.id === id);
  // 글자를 다 지웠거나 그대로면 저장하지 않고 원래 글자로 돌려놔요
  if (text === "" || text === todo.text) {
    render();
    return;
  }
  todo.text = text;
  render();
  saveTodos([todo]);
}

// ===== 5. 남은 날짜 계산 =====
// 오늘 날짜를 "2026-09-30" 같은 글자로
function todayString() {
  return dateAfter(0); // dateAfter는 아래 '마감 날짜 빠른 버튼'에 있어요
}

// 오늘부터 마감까지 며칠 남았는지 (지났으면 음수)
function daysLeft(due) {
  const [y, m, d] = due.split("-").map(Number);
  const dueDate = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
}

// 남은 날짜를 글자로 (예: "D-3", "오늘까지", "2일 지남")
function dueLabel(days) {
  if (days > 0) return `D-${days}`;
  if (days === 0) return "오늘까지";
  return `${-days}일 지남`;
}

// 남은 날짜에 따라 빨강 ~ 초록 사이 색 정하기 (선명한 5단계)
// 색을 계속 섞으면 중간이 칙칙한 황토색이 돼서, 눈에 잘 띄는 색을 단계별로 골라 뒀어요.
//   bg: 배경색, text: 글자색 (밝은 노랑/연두 위에는 흰 글자가 안 보여서 진한 글자)
const DUE_COLORS = [
  { maxDays: 0, bg: "#ef233c", text: "#fff" }, // 오늘까지 / 지남: 빨강
  { maxDays: 1, bg: "#ff7a00", text: "#fff" }, // 1일 남음: 주황
  { maxDays: 3, bg: "#ffd60a", text: "#3d2e00" }, // 2~3일: 노랑
  { maxDays: 6, bg: "#a3e635", text: "#1a2e05" }, // 4~6일: 연두
  { maxDays: Infinity, bg: "#16a34a", text: "#fff" }, // 7일 이상: 초록
];

function dueStyle(days) {
  return DUE_COLORS.find((c) => days <= c.maxDays);
}

function dueColor(days) {
  return dueStyle(days).bg;
}

function dueTextColor(days) {
  return dueStyle(days).text;
}

// 두 할 일 중 어느 것을 먼저 보여줄지 정해요 (sort에서 써요)
//   - 마감일이 빠른 것이 먼저 ("2026-10-05"처럼 적혀 있어서 글자 순서 = 날짜 순서)
//   - 마감일이 없는 것은 맨 아래
//   - 마감일이 같으면(또는 둘 다 없으면) 먼저 추가한 것이 먼저
function byDue(a, b) {
  if (a.due && !b.due) return -1;
  if (!a.due && b.due) return 1;
  if (a.due !== b.due) return a.due < b.due ? -1 : 1;
  return a.id - b.id;
}

// ===== 6. 화면 그리기 =====
function render() {
  list.innerHTML = "";

  // 현재 필터에 맞는 할 일만 고르기
  const visible = todos.filter((t) => {
    if (!matchesAuthor(t)) return false; // 이름으로 보기 중이면 그 사람 것만
    if (currentFilter === "active") return !t.done && t.progress > 0; // 진행중: 1~99% (0%는 아직 시작 안 한 일)
    if (currentFilter === "done") return t.done;
    return !t.hidden; // 전체: 지운 완료 일은 빼고
  });

  // 마감일이 가까운 순서로 줄 세우기 (지난 일이 맨 위, 마감일 없는 일은 맨 아래)
  visible.sort(byDue);

  if (visible.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    if (loading) li.textContent = "불러오는 중…";
    else if (currentFilter === "active") li.textContent = "진행중인 할 일이 없어요. 슬라이더를 올리면 여기에 나와요.";
    else li.textContent = "할 일이 없어요.";
    list.appendChild(li);
  }

  visible.forEach((todo) => {
    list.appendChild(makeItem(todo));
  });

  // 남은 할 일 개수 (이름으로 보기 중이면 그 사람 것만 세요)
  const left = todos.filter((t) => !t.done && matchesAuthor(t)).length;
  count.textContent = `남은 할 일 ${left}개`;

  // 이름으로 보기 중이면 위에 알림을 보여줘요
  authorFilterBox.hidden = authorFilter === "";
  authorFilterText.textContent = `✍ ${authorFilter}의 할 일만 보는 중`;

  // 완료 탭에서는 아래 버튼이 진짜 삭제 버튼이 돼요
  clearDoneBtn.textContent = currentFilter === "done" ? "완료 목록 비우기" : "완료한 일 지우기";
}

// 할 일 한 줄(li) 만들기
function makeItem(todo) {
  const li = document.createElement("li");
  li.className = "todo" + (todo.done ? " done" : "");

  // 체크박스
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = todo.done;
  checkbox.addEventListener("change", () => toggleTodo(todo.id));

  // 글자 (textContent를 써야 <script> 같은 글자도 안전하게 보여요)
  const span = document.createElement("span");
  span.className = "text";
  span.textContent = todo.text;
  span.addEventListener("dblclick", () => startEdit(li, span, todo));

  // 할 일 글자와 작성자 이름을 위아래로 묶어요
  const body = document.createElement("div");
  body.className = "body";
  body.append(span);

  // 작성자 이름이 있으면 할 일 아래에 작게 표시 (없으면 아무것도 안 보여요)
  if (todo.author) {
    // 이름을 누르면 그 사람 할 일만 보여줘요
    const author = document.createElement("button");
    author.className = "author";
    author.textContent = `✍ ${todo.author}`;
    author.title = `${todo.author}의 할 일만 보기`;
    author.addEventListener("click", () => {
      authorFilter = todo.author;
      render();
    });
    body.append(author);
  }

  li.append(checkbox, body);

  // 마감 날짜가 있으면 남은 날짜 표시
  if (todo.due) {
    const days = daysLeft(todo.due);
    const badge = document.createElement("span");
    badge.className = "due";
    badge.textContent = dueLabel(days);
    badge.title = `마감: ${todo.due}`;
    li.append(badge);

    if (!todo.done) {
      li.style.setProperty("--due-color", dueColor(days));
      li.style.setProperty("--due-text", dueTextColor(days));
      if (days < 0) li.classList.add("overdue");
    }
  }

  // 진행률 슬라이더 (볼륨 조절처럼 끌어서 0~100% 정하기)
  li.append(makeProgress(todo));

  // 삭제 버튼
  const delBtn = document.createElement("button");
  delBtn.className = "delete";
  delBtn.textContent = "✕";
  delBtn.title = "삭제";
  delBtn.addEventListener("click", () => removeTodo(todo));

  li.append(delBtn);
  return li;
}

// 진행률 슬라이더 + 퍼센트 글자 만들기
function makeProgress(todo) {
  const box = document.createElement("label");
  box.className = "progress";
  box.title = "끌어서 얼마나 했는지 정해요";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = 100;
  slider.step = 10;
  slider.value = todo.progress;

  const percent = document.createElement("span");
  percent.className = "percent";
  percent.textContent = `${todo.progress}%`;

  // 끄는 동안에는 글자만 바꾸고, 손을 떼면(change) 저장해요
  slider.addEventListener("input", () => {
    percent.textContent = `${slider.value}%`;
  });
  slider.addEventListener("change", () => setProgress(todo.id, Number(slider.value)));

  box.append(slider, percent);
  return box;
}

// 글자를 입력칸으로 바꿔서 수정하기
function startEdit(li, span, todo) {
  const editInput = document.createElement("input");
  editInput.className = "edit";
  editInput.value = todo.text;
  span.replaceWith(editInput);
  editInput.focus();

  let finished = false; // 저장이 두 번 되지 않게 막는 표시
  function finish(saveIt) {
    if (finished) return;
    finished = true;
    if (saveIt) editTodo(todo.id, editInput.value);
    else render(); // 취소하면 원래대로
  }

  editInput.addEventListener("keydown", (e) => {
    if (e.isComposing) return; // 한글 조합 중이면 무시
    if (e.key === "Enter") finish(true);
    if (e.key === "Escape") finish(false);
  });
  editInput.addEventListener("blur", () => finish(true)); // 다른 곳 클릭해도 저장
}

// ===== 7. 다크/라이트 모드 =====
function showThemeIcon() {
  const isDark = document.documentElement.dataset.theme === "dark";
  themeBtn.textContent = isDark ? "☀️" : "🌙"; // 누르면 바뀔 모드의 아이콘
}

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("theme", next); // 테마는 새로고침해도 기억해요
  } catch (e) {}
  showThemeIcon();
});

// ===== 8. 작성자 이름 기억하기 =====
// 한 번 적은 이름은 브라우저에 저장해서, 새로고침해도 다시 안 적어도 돼요.
try {
  authorInput.value = localStorage.getItem("author") || "";
} catch (e) {}

authorInput.addEventListener("input", () => {
  try {
    localStorage.setItem("author", authorInput.value.trim());
  } catch (e) {}
});

// 이름 칸에서 Enter를 누르면 할 일 칸으로 넘어가요
authorInput.addEventListener("keydown", (e) => {
  if (e.isComposing) return; // 한글 조합 중이면 무시
  if (e.key === "Enter") input.focus();
});

// ===== 9. 이벤트 연결 =====
addBtn.addEventListener("click", addTodo);

// 할 일 칸이나 날짜 칸에서 Enter를 눌러도 추가
[input, dueInput].forEach((el) => {
  el.addEventListener("keydown", (e) => {
    // 한글 조합 중에 누른 Enter는 무시 → 두 번 추가되는 문제 방지
    if (e.isComposing) return;
    if (e.key === "Enter") addTodo();
  });
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    render();
  });
});

clearDoneBtn.addEventListener("click", () => {
  // 이름으로 보기 중이면 그 사람의 완료한 일만 지워요
  const doneTodos = todos.filter((t) => t.done && matchesAuthor(t));
  if (currentFilter === "done") {
    todos = todos.filter((t) => !doneTodos.includes(t)); // 완료 탭: 진짜 삭제
    render();
    deleteTodos(doneTodos.map((t) => t.id));
  } else {
    doneTodos.forEach((t) => (t.hidden = true)); // 전체 탭: 숨기기만 (완료 탭엔 남음)
    render();
    saveTodos(doneTodos);
  }
});

// "모두 보기 ✕"를 누르면 이름으로 보기를 끝내요
authorFilterClear.addEventListener("click", () => {
  authorFilter = "";
  render();
});

// ===== 10. 마감 날짜 빠른 버튼 =====
// 오늘에서 days일 뒤 날짜를 "2026-10-13" 같은 글자로
function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

// 날짜 칸에 들어 있는 날짜와 같은 버튼을 색칠해요
function showQuickDate() {
  quickDateBtns.forEach((btn) => {
    const value = btn.dataset.days === "" ? "" : dateAfter(Number(btn.dataset.days));
    btn.classList.toggle("active", dueInput.value === value);
  });
}

quickDateBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    // data-days가 비어 있으면 "없음" → 날짜 칸을 비워요
    dueInput.value = btn.dataset.days === "" ? "" : dateAfter(Number(btn.dataset.days));
    showQuickDate();
    input.focus(); // 바로 할 일을 적을 수 있게
  });
});

// 달력으로 직접 골라도 버튼 색칠이 맞춰져요
dueInput.addEventListener("input", showQuickDate);
dueInput.addEventListener("change", showQuickDate);

// 처음 열었을 때: 일단 "불러오는 중…"을 보여주고 수퍼베이스에서 가져와요
dueInput.value = todayString(); // 날짜 칸 기본값: 오늘
showQuickDate();
showThemeIcon();
render();
load();
