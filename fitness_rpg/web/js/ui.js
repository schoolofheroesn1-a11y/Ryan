// Модальные окна поверх игры (обычный HTML: так на телефоне работает экранная клавиатура).
import { tr } from "./i18n.js";

function modal(build) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "modal";
    const box = document.createElement("div");
    box.className = "modal-box";
    back.appendChild(box);
    const close = (value) => {
      back.remove();
      resolve(value);
    };
    build(box, close);
    document.body.appendChild(back);
    const focus = box.querySelector("input, button");
    if (focus) focus.focus();
  });
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = tr(text);
  return e;
}

/** Окно подтверждения. Возвращает true/false. */
export function confirmDialog({ title, text, note, ok = "OK", cancel = "ОТМЕНА" }) {
  return modal((box, close) => {
    box.appendChild(el("h2", null, title));
    box.appendChild(el("p", null, text));
    if (note) box.appendChild(el("p", "modal-note", note));
    const row = el("div", "modal-row");
    const yes = el("button", "modal-ok", ok);
    const no = el("button", "modal-cancel", cancel);
    yes.onclick = () => close(true);
    no.onclick = () => close(false);
    row.append(no, yes);
    box.appendChild(row);
  });
}

/** Окно с выбором: buttons — [[значение, подпись, главная?]]. Возвращает значение или null. */
export function choiceDialog({ title, text, note, buttons }) {
  return modal((box, close) => {
    box.appendChild(el("h2", null, title));
    box.appendChild(el("p", null, text));
    if (note) box.appendChild(el("p", "modal-note", note));
    const row = el("div", "modal-row");
    for (const [value, label, main] of buttons) {
      const b = el("button", main ? "modal-ok" : "modal-cancel", label);
      b.onclick = () => close(value);
      row.appendChild(b);
    }
    box.appendChild(row);
  });
}

/** Ввод имени. Возвращает строку или null (отмена). */
export function promptName({ title, text, value }) {
  return modal((box, close) => {
    box.appendChild(el("h2", null, title));
    box.appendChild(el("p", null, text));
    const input = el("input", "modal-input");
    input.type = "text";
    input.maxLength = 16;
    input.value = value || "";
    input.autocomplete = "off";
    input.setAttribute("autocapitalize", "words");
    box.appendChild(input);
    const row = el("div", "modal-row");
    const yes = el("button", "modal-ok", "СОХРАНИТЬ");
    const no = el("button", "modal-cancel", "ОТМЕНА");
    yes.onclick = () => close(input.value);
    no.onclick = () => close(null);
    input.onkeydown = (e) => {
      e.stopPropagation(); // буквы J/K/L в имени не должны бить скелета
      if (e.key === "Enter") close(input.value);
      if (e.key === "Escape") close(null);
    };
    row.append(no, yes);
    box.appendChild(row);
  });
}

function input(box, { type = "text", value = "", placeholder = "", maxLength = 32, caps = "none" } = {}) {
  const i = el("input", "modal-input");
  i.type = type;
  i.maxLength = maxLength;
  i.value = value;
  i.placeholder = tr(placeholder);
  i.autocomplete = type === "password" ? "current-password" : "off";
  i.setAttribute("autocapitalize", caps);
  i.addEventListener("keydown", (e) => e.stopPropagation()); // буквы J/K/L не управляют боем
  box.appendChild(i);
  return i;
}

/** Ввод строки (код, номер комнаты). Возвращает строку или null. */
export function promptText({ title, text, value = "", ok = "OK", maxLength = 32, caps = "characters" }) {
  return modal((box, close) => {
    box.appendChild(el("h2", null, title));
    if (text) box.appendChild(el("p", null, text));
    const i = input(box, { value, maxLength, caps });
    const row = el("div", "modal-row");
    const yes = el("button", "modal-ok", ok);
    const no = el("button", "modal-cancel", "ОТМЕНА");
    yes.onclick = () => close(i.value);
    no.onclick = () => close(null);
    i.addEventListener("keydown", (e) => {
      if (e.key === "Enter") close(i.value);
      if (e.key === "Escape") close(null);
    });
    row.append(no, yes);
    box.appendChild(row);
  });
}

/**
 * Вход или регистрация. submit({mode, login, password, name}) => Promise<текст ошибки | null>.
 * Окно не закрывается, пока вход не удался (под полями — причина ошибки). true — вошли, false — отмена.
 */
export function promptAccount({ name = "", ref = "", submit }) {
  return modal((box, close) => {
    box.appendChild(el("h2", null, "АККАУНТ"));
    box.appendChild(el("p", null, "Мультиплеер работает с аккаунтом: рейтинг, вызовы, дуэли и покупки сохраняются в нём и доступны на любом устройстве."));
    const login = input(box, { placeholder: "логин (латиница)", maxLength: 20 });
    const pass = input(box, { type: "password", placeholder: "пароль (от 6 символов)", maxLength: 72 });
    const nick = input(box, { value: name, placeholder: "имя в игре (для регистрации)", maxLength: 16, caps: "words" });
    const friend = input(box, { value: ref, placeholder: "код друга (если есть)", maxLength: 10, caps: "characters" });
    const error = el("p", "modal-error");
    box.appendChild(error);
    box.appendChild(el("p", "modal-note", "Имя в игре видят другие игроки. Пароль никому не сообщайте."));
    const row = el("div", "modal-row");
    const no = el("button", "modal-cancel", "ОТМЕНА");
    const reg = el("button", "modal-cancel", "РЕГИСТРАЦИЯ");
    const yes = el("button", "modal-ok", "ВОЙТИ");
    let busy = false;
    const send = async (mode) => {
      if (busy) return;
      busy = true;
      [no, reg, yes].forEach((b) => (b.disabled = true));
      error.textContent = tr("Связь с сервером...");
      error.classList.remove("bad");
      let msg;
      try {
        msg = await submit({ mode, login: login.value.trim(), password: pass.value, name: nick.value, ref: friend.value.trim() });
      } catch (e) {
        msg = "Нет связи с сервером";
      }
      busy = false;
      [no, reg, yes].forEach((b) => (b.disabled = false));
      if (!msg) return close(true);
      error.textContent = tr(msg); // окно остаётся: исправьте и попробуйте снова
      error.classList.add("bad");
    };
    no.onclick = () => !busy && close(false);
    reg.onclick = () => send("register");
    yes.onclick = () => send("login");
    pass.addEventListener("keydown", (e) => { if (e.key === "Enter") send("login"); });
    row.append(no, reg, yes);
    box.appendChild(row);
  });
}

export const modalOpen = () => !!document.querySelector(".modal");
