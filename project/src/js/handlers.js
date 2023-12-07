import { router } from './routing';
import { login, isLoggedOn } from './auth';
import { createAccount, postTransactionNew, postExchange } from './requests';
import { getPriceFormatted, isEmpty } from './utilities';
import {
  createBlockAccount,
  createBlockCurrenciesList,
} from './createElements';
import { el, mount } from 'redom';
import { showNotification } from './notifications';

function onGoBack() {
  window.history.back();
}

async function onLogin({ loginInput, passInput }) {
  const btnLogin = document.querySelector('.form-login__btn');
  btnLogin.classList.add('btn-loading');
  btnLogin.disabled = true;
  let res;
  try {
    res = await login(loginInput.value, passInput.value);
    if (res.success) {
      router.navigate('/accounts');
    } else {
      showNotification(res.error, 'error');
    }
  } catch (e) {
    showNotification(res.error, 'error');
  } finally {
    btnLogin.classList.remove('btn-loading');
    btnLogin.disabled = false;
  }
}

function onOpenAccount({ id }) {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    router.navigate(`/accounts/${id}`);
  }
}

async function onCreateAccount() {
  let res = await createAccount();
  if (res.success) {
    const newAccount = {
      success: true,
      error: '',
      data: {
        account: res.data.account,
        balance: res.data.balance,
        transactions: res.data.transactions,
      },
    };
    const account = newAccount.data;
    const blockAccount = createBlockAccount(account);
    document.querySelector('.grid-accounts').append(blockAccount);

    showNotification(`Создан счёт №${account.account}`, 'success');

    return account;
  } else {
    showNotification(res.error, 'error');
  }
}

function onOpenAccountHistory({ id }) {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    router.navigate(`/accounts/${id}/history`);
  }
}

// eslint-disable-next-line prettier/prettier
async function onCreateTransactionTo({
  accountIdFrom,
  accountIdInput,
  sumInput,
}) {
  // валидация
  function validate() {
    if (!accountIdFrom) {
      return { success: false, error: 'Не указан счет списания' };
    } else if (!accountIdInput.dataset.value) {
      return { success: false, error: 'Не указан счет зачисления' };
    } else if (!parseFloat(sumInput.value) || parseFloat(sumInput.value) <= 0) {
      return { success: false, error: 'Некорректная сумма перевода' };
    } else {
      return { success: true, error: '' };
    }
  }
  const valid = validate();
  if (!valid.success) {
    showNotification(valid.error, 'warning');
    return;
  }

  const btnSend = document.querySelector('.form-transaction__btn');
  btnSend.classList.remove('btn-send');
  btnSend.classList.add('btn-loading');
  btnSend.disabled = true;
  try {
    // перевод между счетами
    let account = await postTransactionNew(
      accountIdFrom,
      accountIdInput.dataset.value,
      sumInput.value
    );
    if (!account.account) return;

    // 1. изменить титульные данные: баланс
    document.querySelector('.main__info-value').textContent = getPriceFormatted(
      account.balance
    );

    //  2. добавить новую транзакцию в историю
    const body = document.querySelector('.block-history .table__body');
    const row = el('tr.table__row');
    ['from', 'to', 'amount', 'date'].forEach((field) => {
      let val;
      let priceClass = '';
      switch (field) {
        case 'date':
          val = new Date().toLocaleDateString();
          break;
        case 'amount':
          val = '- ' + getPriceFormatted(sumInput.value);
          priceClass = '.table__cell--critical';
          break;
        case 'from':
          val = accountIdFrom;
          break;
        case 'to':
          val = accountIdInput.dataset.value;
      }
      const cell = el(`td.table__cell${priceClass}`, val);
      mount(row, cell);
    });
    body.prepend(row);
    body.querySelector('tr:last-child').outerHTML = '';

    //  3. перерасчитать динамику баланса

    //  сбросить старые данные
    sumInput.value = '';
    // eslint-disable-next-line prettier/prettier
    accountIdInput.querySelector('.select-check__current').innerText =
      'Выберите счёт';

    showNotification('Перевод выполнен', 'success');
  } finally {
    btnSend.classList.remove('btn-loading');
    btnSend.classList.add('btn-send');
    btnSend.disabled = false;
  }
}

async function onExchange({ currencyFromInput, currencyToInput, sumInput }) {
  // валидация
  function validate() {
    if (!currencyFromInput.dataset.value) {
      return { success: false, error: 'Не выбрана валюта списания' };
    } else if (!currencyToInput.dataset.value) {
      return { success: false, error: 'Не выбрана валюта зачисления' };
    } else if (!parseFloat(sumInput.value) || parseFloat(sumInput.value) <= 0) {
      return { success: false, error: 'Некорректная сумма перевода' };
    } else {
      return { success: true, error: '' };
    }
  }
  const valid = validate();
  if (!valid.success) {
    showNotification(valid.error, 'warning');
    return;
  }

  const btnExchange = document.querySelector('.form-exchange__btn');
  btnExchange.classList.add('btn-loading');
  btnExchange.disabled = true;
  try {
    //  перевод с возвратом текущего состояния счетов
    const currencies = await postExchange(
      currencyFromInput.dataset.value,
      currencyToInput.dataset.value,
      sumInput.value
    );
    if (!currencies || isEmpty(currencies)) return;

    // получение списка актуальных валют
    const currenciesDict = [];
    for (let key in currencies) currenciesDict.push(key);

    //  сброс значений полей
    sumInput.value = '';
    currencyFromInput.dataset.value = '';
    currencyFromInput.querySelector('.select-check__current').innerText = '';
    currencyToInput.dataset.value = '';
    currencyToInput.querySelector('.select-check__current').innerText = '';

    //  удалить старый и разместить новый список моих валют
    document.querySelector('.block-currencies').outerHTML = '';
    const currenciesListNew = await createBlockCurrenciesList(
      currenciesDict,
      currencies
    );
    document.querySelector('.form-exchange').before(currenciesListNew);

    showNotification('Обмен валют выполнен', 'success');
  } finally {
    btnExchange.classList.remove('btn-loading');
    btnExchange.disabled = false;
  }
}

document.addEventListener('click', (e) => {
  const target = e.target;
  document.querySelectorAll('.select-check').forEach((select) => {
    try {
      // eslint-disable-next-line prettier/prettier
      if (!target.className?.includes(select.dataset.container)) {
        select.classList.remove('is-active');
      }
    } catch (e) {
      console.log(
        'Ошибка обработки селекта ' + target + ': ' + e.name,
        e.message +
          ': в качестве event получен объект SVGSVGElement (щелчок по иконке на кнопке селекта)'
      );
    }
  });
});

export {
  onGoBack,
  onLogin,
  onOpenAccount,
  onCreateAccount,
  onOpenAccountHistory,
  onCreateTransactionTo,
  onExchange,
};
