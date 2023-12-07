import { SERVER } from './requests';

async function login(login, password) {
  let result = {
    success: true,
    error: '',
    body: {},
  };
  return fetch(`${SERVER}/login`, {
    method: 'POST',
    body: JSON.stringify({
      login: login,
      password: password,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => {
      if (!res.payload) {
        result.success = false;
        switch (res.error) {
          case 'No such user':
            result.error = `Пользователь с логином "${login}" не найден`;
            break;
          case 'Invalid password':
            result.error = 'Неверный пароль';
            break;
          case 'Invalid route':
            result.error = 'Некорректный адрес подключения';
            break;
          default:
            result.error = res.error;
        }
      } else {
        sessionStorage.setItem('token', res.payload.token);
        result = { success: true, error: '' };
      }
    })
    .then(() => {
      return result;
    })
    .catch((e) => {
      result.success = false;
      switch (e.message) {
        case 'Failed to fetch':
          result.error = `Не удается подключиться к серверу ${SERVER}`;
          break;
        default:
          result.error = `${e.name}: ${e.message}`;
      }
      return result;
    });
}

function logout() {
  sessionStorage.removeItem('token');

  return true;
}

function isLoggedOn() {
  return sessionStorage.getItem('token');
}

export { login, logout, isLoggedOn };
