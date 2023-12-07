import { round } from './utilities';
import { refreshExchangeRates } from './createElements';
import { showNotification } from './notifications';

const SERVER = 'http://localhost:3000';

const errors = {
  Unauthorized: 'Необходима авторизация',
  'Failed to fetch': `Не удается подключиться к серверу ${SERVER}`,
  'Invalid account from': 'Неверный счет отправления',
  'Invalid account to': 'Неверный счет получения',
  'Invalid amount': 'Некорректная сумма перевода',
  'Overdraft prevented': 'Сумма перевода превышает сумму на счету',
};

async function loadAccounts() {
  const token = sessionStorage.getItem('token');

  let result = {
    success: true,
    error: '',
    data: [],
  };
  return fetch('http://localhost:3000/accounts', {
    method: 'GET',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => {
      if (!res.payload) {
        result.success = false;
        result.error = errors[res.error] ?? res.error;
      } else {
        result.data = res.payload;
      }
    })
    .then(() => {
      return result;
    });
}

async function loadAccount(accountId) {
  const token = sessionStorage.getItem('token');

  let result = {
    success: true,
    error: '',
    data: {},
  };
  return fetch('http://localhost:3000/account/' + accountId, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => {
      if (!res.payload) {
        result.success = false;
      } else {
        result.data = res.payload;
      }
    })
    .then(() => {
      return result;
    });
}

async function loadAccountHistory(accountId) {
  if (!accountId) return result;

  let result = await loadAccount(accountId);

  return {
    success: result.success,
    error: result.error,
    data: result.data,
  };
}

async function createAccount() {
  const token = sessionStorage.getItem('token');

  let result = {
    success: true,
    error: '',
    data: {},
  };
  return fetch('http://localhost:3000/create-account', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => {
      if (!res.payload) {
        result.success = false;
        result.error = errors[res.error] ?? res.error;
      } else {
        result.data = res.payload;
      }
    })
    .then(() => {
      return result;
    });
}

// ----------------- GET-запрос к серверу --------------------
async function loadFromDB(page) {
  const token = sessionStorage.getItem('token');

  let result = {
    success: true,
    error: '',
    data: {},
  };
  return fetch(`${SERVER}/${page}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then((res) => res.json())
    .then((res) => {
      if (!res.payload) {
        result = { success: false, error: res.error };
      } else {
        result = { success: true, error: '', data: res.payload };
      }
    })
    .then(() => {
      return result;
    })
    .catch((e) => {
      result.success = false;
      result.error = errors[e.message] ?? `${e.name}: ${e.message}`;
      return result;
    });
}

async function postTransactionNew(accountFrom, accountTo, sum) {
  async function postToDB() {
    const token = sessionStorage.getItem('token');

    let result = {
      success: true,
      error: '',
      data: {},
    };
    return fetch(`${SERVER}/transfer-funds`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: accountFrom,
        to: accountTo,
        amount: round(sum, 2),
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (!res.payload) {
          result.success = false;
          result.error = errors[res.error] ?? res.error;
        } else {
          result = { success: true, error: '', data: res.payload };
        }
      })
      .then(() => {
        return result;
      })
      .catch((e) => {
        result.success = false;
        result.error = errors[e.message] ?? `${e.name}: ${e.message}`;
        return result;
      });
  }
  let res;
  try {
    res = await postToDB();
    if (!res.success) {
      showNotification(res.error, 'error');
      return {};
    }
    if (!res.data) return {};

    return res.data;
  } catch (e) {
    showNotification(res.error, 'error');
    return {};
  }
}

async function loadCoordinates() {
  let res;
  try {
    res = await loadFromDB('banks');
    if (!res.success) {
      showNotification(res.error, 'error');
      return [];
    }
    if (!res.data?.length) return [];

    return res.data;
  } catch (e) {
    showNotification(res.error, 'error');
    return [];
  }
}

async function loadCurrenciesDict() {
  let res;
  try {
    res = await loadFromDB('all-currencies');
    if (!res.success) {
      showNotification(res.error, 'error');
      return [];
    }
    if (!res.data?.length) return [];

    return res.data;
  } catch (e) {
    showNotification(res.error, 'error');
    return [];
  }
}

async function loadCurrencies() {
  let res;
  try {
    res = await loadFromDB('currencies');
    if (!res.success) {
      showNotification(res.error, 'error');
      return {};
    }
    if (!res.data) return {};

    return res.data;
  } catch (e) {
    showNotification(res.error, 'error');
    return {};
  }
}

async function postExchange(currencyFrom, currencyTo, sum) {
  async function postToDB() {
    const token = sessionStorage.getItem('token');

    let result = {
      success: true,
      error: '',
      data: {},
    };
    return fetch(`${SERVER}/currency-buy`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: currencyFrom,
        to: currencyTo,
        amount: sum,
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (!res.payload) {
          result.success = false;
          switch (res.error) {
            case 'Unknown currency code':
              result.error = `Некорректно выбранная валюта (списания либо зачисления)`;
              break;
            case 'Invalid amount':
              result.error = `Некорректная сумма перевода`;
              break;
            case 'Not enough currency':
              result.error = `На валютном счете списания нет средств`;
              break;
            case 'Overdraft prevented':
              result.error = `На счете списания не хватает средств`;
              break;
            default:
              result.error = res.error;
          }
        } else {
          result = { success: true, error: '', data: res.payload };
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
  let res;
  try {
    res = await postToDB();
    if (!res.success) {
      showNotification(res.error, 'error');
      return {};
    }
    if (!res.data) return {};

    return res.data;
  } catch (e) {
    showNotification(res.error, 'error');
    return {};
  }
}

// web-сокет для отслеживания курсов валют
let socket;
function openWebSocket() {
  if (!socket) {
    socket = new WebSocket('ws://localhost:3000/currency-feed');

    socket.onmessage = function (event) {
      const data = JSON.parse(event.data);
      if (data.type == 'EXCHANGE_RATE_CHANGE') refreshExchangeRates(data);
    };
  }
  return socket;
}

export {
  SERVER,
  loadAccounts,
  loadAccount,
  loadAccountHistory,
  createAccount,
  postTransactionNew,
  loadCoordinates,
  loadCurrenciesDict,
  loadCurrencies,
  postExchange,
  openWebSocket,
};
