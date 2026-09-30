// ===== 1. 필요한 요소 가져오기 =====
const input = document.getElementById("todo-input");
const dueInput = document.getElementById("due-input");
const addBtn = document.getElementById("add-btn");
const list = document.getElementById("todo-list");
const count = document.getElementById("count");
const clearDoneBtn = document.getElementById("clear-done");
const filterBtns = document.querySelectorAll(".filter");
const themeBtn = document.getElementById("theme-btn");

// ===== 2. 데이터 =====
// 할 일 하나는 { id, text, done, due, hidden } 모양의 객체예요.
//   due    : 마감 날짜 ("2026-10-05" 같은 글자, 없으면 "")
//   hidden : 완료한 일을 지웠을 때 true → 전체에서는 안 보이고 완료 탭에만 남아요
// 브라우저에 저장해 두니까 새로고침하거나 창을 닫아도 남아 있어요.
let todos = load();
let currentFilter = "all"; // "all" | "active" | "done"

// 브라우저에 저장된 할 일 불러오기
function load() {
  try {
    return JSON.parse(localStorage.getItem("todos")) || [];
  } catch (e) {
    return [];
  }
}

// 브라우저에 할 일 저장하기 (render()가 부를 때마다 자동으로 저장돼요)
function save() {
  try {
    localStorage.setItem("todos", JSON.stringify(todos));
  } catch (e) {
    // 저장이 막힌 환경이면 그냥 넘어가요.
  }
}

// ===== 3. 기능 =====
function addTodo() {
  const text = input.value.trim();
  if (text === "") return; // 빈 칸이면 추가하지 않음

  todos.push({ id: Date.now(), text: text, done: false, due: dueInput.value, hidden: false });
  input.value = "";
  dueInput.value = todayString(); // 다음 할 일도 오늘 날짜부터 시작
  render();
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  todo.done = !todo.done;
  if (!todo.done) todo.hidden = false; // 완료를 취소하면 전체에 다시 보이게
  render();
}

// 진짜로 없애기
function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  render();
}

// ✕ 버튼을 눌렀을 때
function removeTodo(todo) {
  if (todo.done && currentFilter !== "done") {
    todo.hidden = true; // 완료한 일은 전체에서만 숨기고 완료 탭에는 남김
    render();
  } else {
    deleteTodo(todo.id); // 안 끝난 일이거나, 완료 탭에서 지우면 진짜 삭제
  }
}

function editTodo(id, newText) {
  const text = newText.trim();
  if (text === "") {
    deleteTodo(id); // 내용을 다 지우면 할 일도 삭제
    return;
  }
  todos.find((t) => t.id === id).text = text;
  render();
}

// ===== 4. 남은 날짜 계산 =====
// 오늘 날짜를 "2026-09-30" 같은 글자로
function todayString() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
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

// 남은 날짜에 따라 빨간색 진하기 정하기 (그라데이션)
// 오늘까지/지남: 제일 진한 빨강 → 날짜가 멀수록 점점 연한 빨강 (7일 이상은 가장 연함)
function dueColor(days) {
  const far = Math.min(Math.max(days / 7, 0), 1); // 0(오늘) ~ 1(7일 이상 남음)
  const lightness = 42 + far * 43; // 42%(진함) ~ 85%(연함)
  return `hsl(0, 80%, ${lightness}%)`;
}

// 배경색이 연하면 흰 글자가 안 보이니까 진한 빨강 글자로 바꿔요
function dueTextColor(days) {
  return days <= 3 ? "#fff" : "hsl(0, 70%, 30%)";
}

// ===== 5. 화면 그리기 =====
function render() {
  save(); // 목록이 바뀌면 항상 render()를 부르니까 여기서 한 번에 저장
  list.innerHTML = "";

  // 현재 필터에 맞는 할 일만 고르기
  const visible = todos.filter((t) => {
    if (currentFilter === "active") return !t.done;
    if (currentFilter === "done") return t.done;
    return !t.hidden; // 전체: 지운 완료 일은 빼고
  });

  if (visible.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "할 일이 없어요.";
    list.appendChild(li);
  }

  visible.forEach((todo) => {
    list.appendChild(makeItem(todo));
  });

  // 남은 할 일 개수
  const left = todos.filter((t) => !t.done).length;
  count.textContent = `남은 할 일 ${left}개`;

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

  li.append(checkbox, span);

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

  // 삭제 버튼
  const delBtn = document.createElement("button");
  delBtn.className = "delete";
  delBtn.textContent = "✕";
  delBtn.title = "삭제";
  delBtn.addEventListener("click", () => removeTodo(todo));

  li.append(delBtn);
  return li;
}

// 글자를 입력칸으로 바꿔서 수정하기
function startEdit(li, span, todo) {
  const editInput = document.createElement("input");
  editInput.className = "edit";
  editInput.value = todo.text;
  li.replaceChild(editInput, span);
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

// ===== 6. 다크/라이트 모드 =====
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

// ===== 7. 이벤트 연결 =====
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
  if (currentFilter === "done") {
    todos = todos.filter((t) => !t.done); // 완료 탭: 진짜 삭제
  } else {
    todos.forEach((t) => {
      if (t.done) t.hidden = true; // 전체 탭: 숨기기만 (완료 탭엔 남음)
    });
  }
  render();
});

// 처음 열었을 때 화면 그리기
dueInput.value = todayString(); // 날짜 칸 기본값: 오늘
showThemeIcon();
render();
