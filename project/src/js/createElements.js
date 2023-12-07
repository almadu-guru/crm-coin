import { el, mount, setChildren } from 'redom';
import {
  loadAccounts,
  loadAccountHistory,
  loadCoordinates,
  loadCurrencies,
  loadCurrenciesDict,
} from './requests';
import ymaps from 'ymaps';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import {
  round,
  getPriceFormatted,
  getArrayPage,
  getArrayPagesCount,
} from './utilities';
import {
  onGoBack,
  onLogin,
  onOpenAccount,
  onCreateAccount,
  onOpenAccountHistory,
  onCreateTransactionTo,
  onExchange,
} from './handlers';
import { showNotification } from './notifications';
import loadingImg from '../assets/icons/loading.svg';
import Inputmask from 'inputmask';

const BUTTONS = [
  {
    name: 'back',
    title: 'Вернуться назад',
    handler: onGoBack,
    class: '.btn-back',
  },
  // eslint-disable-next-line prettier/prettier
  {
    name: 'createAccount',
    title: 'Создать новый счет',
    handler: onCreateAccount,
    class: '.btn-create-account',
  },
  { name: 'openAccount', title: 'Открыть', handler: onOpenAccount },
  { name: 'openHistory', title: 'Открыть', handler: onOpenAccountHistory },
  { name: 'login', title: 'Войти', handler: onLogin },
  {
    name: 'transact',
    title: 'Отправить',
    handler: onCreateTransactionTo,
    class: '.btn-send',
  },
  { name: 'exchange', title: 'Обменять', handler: onExchange },
];

function getButtonCaption(name) {
  return BUTTONS.find((btn) => btn.name === name).title;
}
function getButtonHandler(name) {
  return BUTTONS.find((btn) => btn.name === name).handler;
}

// кнопки
function createButton(name, params) {
  function getButtonNameClass(name) {
    return BUTTONS.find((item) => item.name === name)?.class || '';
  }
  const btn = el(
    `button.btn.btn-action.main__btn${getButtonNameClass(name)}`,
    el('span', getButtonCaption(name))
  );
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const result = await getButtonHandler(name)(params);
    if (name === 'createAccount' && result && result.account) {
      accounts.push(result);
    }
  });
  return btn;
}

// пагинация для истории транзакций
function createPagination(accountId, pageCurrent, pagesCount) {
  const pageNums = el('span.pagesNums', `${pageCurrent} / ${pagesCount}`);
  pageNums.dataset.pageCurrent = pageCurrent;
  pageNums.dataset.pagesCount = pagesCount;

  const btnFirst = el('button.btn.pagination__btn-first', 'В начало');
  btnFirst.disabled = pageCurrent === 1;
  const btnLess = el('button.btn.pagination__btn-back', 'Назад');
  btnLess.disabled = pageCurrent === 1;
  const btnMore = el('button.btn.pagination__btn-forward', 'Вперед');
  btnMore.disabled = pageCurrent === pagesCount;
  const btnLast = el('button.btn.pagination__btn-last', 'В конец');
  btnLast.disabled = pageCurrent === pagesCount;

  async function pageBtnClick() {
    let newPage;
    if (this.classList.contains('pagination__btn-first')) {
      newPage = 1;
    } else if (this.classList.contains('pagination__btn-back')) {
      newPage = Math.max(pageCurrent - 1, 1);
    } else if (this.classList.contains('pagination__btn-forward')) {
      newPage = Math.min(pageCurrent + 1, pagesCount);
    } else if (this.classList.contains('pagination__btn-last')) {
      newPage = pagesCount;
    }

    const historyNew = await createBlockTransactionsHistory({
      accountId,
      page: newPage,
      pagesVisible: true,
    });

    const historyOld = document.querySelector('.block-history');
    historyOld.before(historyNew);
    historyOld.outerHTML = '';
  }

  [btnFirst, btnLess, btnMore, btnLast].forEach((btn) => {
    btn.addEventListener('click', pageBtnClick);
  });

  return el('div.pagination', [btnFirst, btnLess, pageNums, btnMore, btnLast]);
}

// кастомные селекты
function createSelect(name, handlers = {}, items = []) {
  const dict = {
    sort: {
      caption: !items.length ? 'Вариантов нет' : 'Сортировка',
      ids: items.length ? items : ['num', 'balance', 'transaction-date'],
      // eslint-disable-next-line prettier/prettier
      captions: items.length
        ? items
        : ['По номеру', 'По балансу', 'По последней транзакции'],
    },
    account: {
      caption: !items.length ? 'Счетов нет' : 'Выберите счёт',
      ids: items,
      captions: items,
    },
    currency: {
      caption: '',
      ids: items,
      captions: items,
    },
  };
  function selectToggle(item) {
    if (!dict[name].ids.length) return;
    item.closest('.select-check').classList.toggle('is-active');
  }
  function selectChange() {
    const select = this.closest('.select-check');
    const current = select.querySelector('.select-check__current');
    const items = select.querySelectorAll('.select-check__item');

    const values = [];
    items.forEach((item) => {
      const itemLabel = item.querySelector('label');
      const itemName = itemLabel.dataset.name;
      const itemCaption = itemLabel.textContent;

      if (item === this) {
        values[0] = { name: itemName, caption: itemCaption };
        item.classList.add('select-check__item--checked');
        // вызвать обработчик выбора нового варианта
        if (handlers?.onChangeFilterItem) {
          handlers.onChangeFilterItem(itemName);
        }
        selectToggle(item);
      } else {
        item.classList.remove('select-check__item--checked');
      }
    });

    // изменение значений и заполнение select.data-value
    if (values.length) {
      current.innerText = values.map((item) => item.caption).join(', ');
      select.dataset.value = values.map((item) => item.name).join(',');
      current.classList.add('is-selected');
    } else {
      current.textContent = select.dataset.placeholder;
      select.dataset.value = '';
      current.classList.remove('is-selected');
    }
  }

  // eslint-disable-next-line prettier/prettier
  const select = el(`div.select-check.select-${name}__wrapper`, {
    'data-placeholder': dict[name].caption,
    'data-value': '',
    'data-container': `select-${name}`,
  });
  if (!dict[name].ids.length) {
    select.classList.add('select-check--disabled');
  }

  // шапка
  const header = el(`div.select-check__header.select-${name}__header`, {
    tabindex: '0',
  });
  const current = el(
    `span.select-check__current.select-${name}___current`,
    dict[name].caption
  );
  const arrow = el(`div.select-check__icon.select-${name}___icon`);
  arrow.innerHTML = `
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0L10 10L20 0H0Z"/>
    </svg>
  `;
  setChildren(header, [current, arrow]);
  header.addEventListener('click', () => {
    selectToggle(header);
  });

  // содержимое
  const body = el(`div.select-check__body.select-${name}___body`);
  dict[name].captions.forEach((text, index) => {
    const item = el(`div.select-check__item.select-${name}__item`, {
      tabindex: '0',
    });
    item.addEventListener('click', selectChange);
    const label = el(
      `label.select-check__label.select-${name}__label`,
      { 'data-name': dict[name].ids[index] },
      text
    );
    setChildren(item, [label]);
    mount(body, item);
  });

  setChildren(select, [header, body]);

  select.disabled = !dict[name].ids.length;

  return select;
}

// окно загрузки данных
function createLoadingWindow() {
  const img = el('img.loading__img', {
    src: loadingImg,
    alt: 'Загрузка...',
  });
  const wrapper = el('div.loading__wrapper', img);
  const loading = el('div.loading', wrapper);
  return loading;
}

// счета и блоки счетов
let accounts;
async function createGridAccounts() {
  if (!accounts?.length) {
    const res = await loadAccounts();
    if (!res.success) {
      alert(`Ошибка: ${res?.error || 'неизвестная'}`); // !
      return;
    }
    accounts = res.data;
  }

  const accountsGrid = el('div.grid.grid-accounts#grid-accounts');

  accounts.forEach((account) => {
    const accountBlock = createBlockAccount(account);
    mount(accountsGrid, accountBlock);
  });

  return accountsGrid;
}

async function sortGridAccounts(fieldName) {
  if (!accounts || !fieldName) {
    showNotification('Ошибка сортировки', 'warning');
    return;
  }

  accounts.sort((a, b) => {
    if (fieldName === 'num') return parseInt(a.account) - parseInt(b.account);
    if (fieldName === 'balance')
      return parseFloat(a.balance) - parseFloat(b.balance);
    if (fieldName === 'transaction-date') {
      const aDate = new Date(a.transactions[0]?.date);
      const bDate = new Date(b.transactions[0]?.date);
      return aDate - bDate;
    }
  });

  const page = document.querySelector('.app__container');
  const content = await createGridAccounts();

  const grid = document.getElementById('grid-accounts');
  if (grid) grid.outerHTML = '';
  mount(page, content);
}

function createBlockAccount(accountInfo) {
  const account = el('div.block.block-account');

  const title = el('div.block-account__title', accountInfo.account);
  const price = el(
    'div.block-account__price',
    getPriceFormatted(accountInfo.balance)
  );

  const subtitle = el(
    'div.block-account__transaction-subtitle',
    'Последняя транзакция:'
  );
  const date = el(
    'div.block-account__transaction-date',
    new Date(accountInfo.transactions[0]?.date).toLocaleDateString()
  );

  const btn = createButton('openAccount', { id: accountInfo.account });
  btn.classList.add('block-account__btn');

  const transaction = el('div.block-account__transaction', [subtitle, date]);
  const wrapper = el('div.block-account__bottom', [transaction, btn]);

  setChildren(account, [title, price, wrapper]);

  return account;
}

// форма нового перевода
async function createFormTransactionNew({ accountId }) {
  if (!accounts?.length) {
    const res = await loadAccounts();
    if (!res.success) {
      alert(`Ошибка: ${res?.error || 'неизвестная'}`); // !
      return;
    }
    accounts = res.data;
  }

  const form = el('form.block.block--section.block--grey.form-transaction');

  const title = el('h2.form-transaction__title', 'Новый перевод');

  const accountLabel = el(
    'label.label.form-transaction__label',
    'Номер счёта получателя'
  );

  // eslint-disable-next-line prettier/prettier
  const accountInput = createSelect(
    'account',
    {},
    accounts
      .map((account) => account.account)
      .filter((account) => account !== accountId)
  );
  const accountWrapper = el('div.form-transaction__wrapper', [
    accountLabel,
    accountInput,
  ]);

  const sumLabel = el('label.label.form-transaction__label', 'Сумма перевода');
  const sumInput = el('input.form-transaction__input');
  Inputmask({ regex: '\\d+\\.{0,1}\\d{0,}' }).mask(sumInput);
  const sumWrapper = el('div.form-transaction__wrapper', [sumLabel, sumInput]);

  const sendLabel = el('label.label.form-transaction__label');
  const sendBtn = createButton('transact', {
    accountIdFrom: accountId,
    accountIdInput: accountInput,
    sumInput: sumInput,
  });
  sendBtn.classList.add('form-transaction__btn');
  const sendWrapper = el('div.form-transaction__wrapper', [sendLabel, sendBtn]);

  setChildren(form, [title, accountWrapper, sumWrapper, sendWrapper]);

  return form;
}

// блок с историей переводов
// eslint-disable-next-line prettier/prettier
async function createBlockTransactionsHistory({
  accountId,
  data: accountData = {},
  page = 1,
  pagesVisible = false,
}) {
  // console.log(accountData);
  const block = el('section.block.block--section.block--grey.block-history');

  const title = el('h2.block-history__title', 'История переводов');

  // шапка таблицы
  const table = el('table.table.block-history__table');
  const head = el('thead.table__head');
  let row = el('tr.table__hrow');
  let cell;
  ['Счёт отправителя', 'Счёт получателя', 'Сумма', 'Дата'].forEach(
    (caption) => {
      cell = el('th.table__cell.table__hcell', caption);
      mount(row, cell);
    }
  );
  mount(head, row);
  mount(table, head);

  // выгрузить данные по счету/истории
  let account, history;
  if (accountData?.account) {
    account = accountData;
    history = account.transactions;
  } else {
    const res = await loadAccountHistory(accountId);
    if (!res.success) {
      alert(`Ошибка: ${res?.error || 'неизвестная'}`); // !
      return;
    }
    account = res.data;
    history = account.transactions;
  }

  // список транзакций
  let pagination;
  if (history && history.length) {
    const pageTransactionsCount = pagesVisible ? 25 : 10;
    const pagesCount = getArrayPagesCount(
      history.length,
      pageTransactionsCount
    );

    if (pagesVisible && pageTransactionsCount < history.length) {
      pagination = createPagination(accountId, page, pagesCount);
    }

    const body = el('tbody.table__body');
    getArrayPage(history, pageTransactionsCount, page).forEach(
      (transaction) => {
        row = el('tr.table__row');
        ['from', 'to', 'amount', 'date'].forEach((field) => {
          let val;
          let priceClass = '';
          switch (field) {
            case 'date':
              val = new Date(transaction[field]).toLocaleDateString();
              break;
            case 'amount':
              val = getPriceFormatted(transaction[field]);
              if (transaction.from === accountId) {
                priceClass = '.table__cell--critical';
                val = '- ' + val;
              } else {
                priceClass = '.table__cell--success';
                val = '+ ' + val;
              }
              break;
            default:
              val = transaction[field];
          }
          cell = el(`td.table__cell${priceClass}`, val);
          mount(row, cell);
        });
        body.prepend(row);
      }
    );
    mount(table, body);
  }

  setChildren(block, [title, table, pagination]);

  return block;
}

// блок с динамикой баланса
function createBlockTransactionsBalance(data = []) {
  if (!data.length) return;
  // 1. создать контейнер;
  const block = el('section.block.block--section.block-chart');

  // 2. создать заголовок;
  const title = el('h2.block-chart__title', 'Динамика баланса');

  // 3. создать блок с диаграммой;
  const canvas = el('canvas');
  const canvasContainer = el('div.block-chart__chart', canvas);

  const months = data.map((value) => value.month).reverse();
  const balances = data.map((value) => value.balanceMax).reverse();
  createChart(canvas, months, balances);

  // ... вернуть контейнер с входящими элементами
  setChildren(block, [title, canvasContainer]);
  return block;
}

// блок с соотношением входящих и исходящих транзакций
function createBlockTransactionsInout(data = []) {
  if (!data.length) return;
  // 1. создать контейнер;
  const block = el('section.block.block--section.block-chart');

  // 2. создать заголовок;
  const title = el(
    'h2.block-chart__title',
    'Соотношение входящих и исходящих транзакций'
  );

  // 3. создать блок с диаграммой;
  const canvas = el('canvas');
  const canvasContainer = el('div.block-chart__chart', canvas);

  const months = data.map((value) => value.month).reverse();
  const balances = data.map((value) => value.balanceMax).reverse();
  const sumsOps = {
    sumIn: data.map((value) => value.balanceMaxPartIn).reverse(),
    sumOut: data.map((value) => value.balanceMaxPartOut).reverse(),
  };
  createChart(canvas, months, balances, true, sumsOps);

  // вернуть контейнер с входящими элементами
  setChildren(block, [title, canvasContainer]);
  return block;
}

// создать диаграмму
function createChart(
  canvas,
  monthsList,
  dataList,
  stack = false,
  stackData = { sumIn: null, sumOut: null }
) {
  let min = +Infinity;
  let max = -Infinity;
  dataList.forEach((num) => {
    min = Math.min(min, num);
    max = Math.max(max, num);
  });
  min = Math.floor(min);
  max = Math.floor(max);

  let average;
  let stepSize;

  if (stack) {
    let maxIn = -Infinity;
    let maxOut = -Infinity;
    stackData.sumIn.forEach((item) => (maxIn = Math.max(maxIn, item)));
    stackData.sumOut.forEach((item) => (maxOut = Math.max(maxOut, item)));

    average = Math.min(maxIn, maxOut);
  }

  const chartAreaBorder = {
    id: 'chartAreaBorder',
    beforeDraw(chart, args, options) {
      const {
        ctx,
        chartArea: { left, top, width, height },
      } = chart;
      ctx.save();
      ctx.strokeStyle = options.borderColor;
      ctx.lineWidth = options.borderWidth;
      ctx.setLineDash(options.borderDash || []);
      ctx.lineDashOffset = options.borderDashOffset;
      ctx.strokeRect(left, top, width, height);
      ctx.restore();
    },
  };

  Chart.defaults.font.size = 20;
  Chart.defaults.font.family = "'Work Sans', sans-serif";
  Chart.defaults.font.weight = '500';
  Chart.defaults.color = '#000000';

  const data = [
    {
      label: '',
      data: dataList,
      backgroundColor: 'rgb(17, 106, 204)',
      hoverBackgroundColor: 'rgb(17, 106, 204)',
      barThickness: 50,
    },
  ];

  const dataStack = [
    {
      label: '',
      data: stackData.sumOut,
      backgroundColor: 'rgba(253, 78, 93, 1)',
      hoverBackgroundColor: 'rgba(253, 78, 93, 1)',
      barThickness: 50,
    },
    {
      label: '',
      data: stackData.sumIn,
      backgroundColor: 'rgba(118, 202, 102, 1)',
      hoverBackgroundColor: 'rgba(118, 202, 102, 1)',
      barThickness: 50,
    },
  ];

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: monthsList,
      datasets: stack ? dataStack : data,
    },
    plugins: [chartAreaBorder],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 0,
      },
      plugins: {
        tooltip: { enabled: false },
        legend: {
          display: false,
        },
        chartAreaBorder: {
          borderColor: '#000000',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          stacked: stack,
          grid: {
            display: false,
          },
        },
        y: {
          stacked: stack,
          position: 'right',
          grid: {
            display: true,
          },
          beginAtZero: false,
          min: min,
          max: max,
          ticks: {
            callback: function (val) {
              if (val === max || val === min) return this.getLabelForValue(val);

              if (!stepSize) stepSize = val;
              const halfStepSize = stepSize / 2;

              if (
                stack &&
                val - halfStepSize <= average &&
                val + halfStepSize > average
              ) {
                return Math.floor(average);
              }

              return '';
            },
            padding: 10,
          },
        },
      },
    },
  });
}

// блок логина
function createFormLogin() {
  const form = el('form.block.block--section.block--grey.form-login');

  const title = el('h2.form-login__title', 'Вход в аккаунт');

  const loginLabel = el('label.label.form-login__label', 'Логин');
  const loginInput = el('input.form-login__input');
  const loginWrapper = el('div.form-login__wrapper', [loginLabel, loginInput]);

  const passLabel = el('label.label.form-login__label', 'Пароль');
  const passInput = el('input.form-login__input.input-password', {
    type: 'password',
  });
  const passWrapper = el('div.form-login__wrapper', [passLabel, passInput]);

  const authLabel = el('label.label.form-login__label');
  const authBtn = createButton('login', { loginInput, passInput });
  authBtn.classList.add('form-login__btn');
  const authWrapper = el('div.form-login__wrapper', [authLabel, authBtn]);

  setChildren(form, [title, loginWrapper, passWrapper, authWrapper]);

  return form;
}

// блок с картой
async function createBlockMap() {
  const blockMap = el('div.points-map', { id: 'map' });
  if (!blockMap) return;

  // eslint-disable-next-line prettier/prettier
  ymaps
    .load(
      'https://api-maps.yandex.ru/2.1/?apikey=10f41f56-5d23-4a7f-8a67-38e70dc4e622&lang=ru_RU'
    )
    .then((maps) => {
      maps.ready(async () => {
        const myMap = new maps.Map(blockMap.id, {
          center: [55.750121480776485, 37.59909037548824],
          zoom: 11,
          controls: ['searchControl', 'trafficControl', 'typeSelector'],
        });

        myMap.behaviors.disable('scrollZoom');

        // maps.geoObjects.removeAll();
        let myPoints = await loadCoordinates();

        myPoints.forEach((point) => {
          const placemark = new maps.Placemark([point.lat, point.lon]);
          myMap.geoObjects.add(placemark);
        });
      });
    });

  return blockMap;
}

// блок со списком валют
async function createBlockCurrenciesList(
  currenciesList = [],
  currenciesExisting
) {
  let currencies;
  if (!currenciesExisting) {
    currencies = await loadCurrencies();
  } else {
    currencies = currenciesExisting;
  }
  if (!currencies) return;

  const currenciesBlock = el('section.block.block--section.block-currencies');

  const title = el('h3.block-currencies__title', 'Ваши валюты');

  // список моих валют и значений по ним
  const list = el('dl.block-currencies__list');
  currenciesList.forEach((currency) => {
    const myCurrency = currencies[currency];
    if (myCurrency) {
      const name = el(
        'dt.param__name.block-currencies__name',
        el('span', myCurrency.code)
      );
      const value = el(
        'dd.param__value.block-currencies__value',
        round(myCurrency.amount, 2)
      );
      const rec = el('div.param.block-currencies__info', [name, value]);
      mount(list, rec);
    }
  });

  setChildren(currenciesBlock, [title, list]);

  return currenciesBlock;
}

// блок с курсами валют (обновления через веб-сокет)
const exchangeRatesList = el('dl.block-rates__list#block-rates');
function createBlockCurrenciesRates() {
  const ratesBlock = el('section.block.block--grey.block--section.block-rates');

  const title = el(
    'h3.block-rates__title',
    'Изменение курсов в реальном времени'
  );

  setChildren(ratesBlock, [title, exchangeRatesList]);

  return ratesBlock;
}

function getExchangeRatesCount() {
  return exchangeRatesList.children.length;
}
function deleteExchangeRatesItem(ratesCurrenciesKey) {
  const existed = document.querySelector(
    `.block-rates__info[data-currencies="${ratesCurrenciesKey}"]`
  );
  // console.log(existed);
  if (existed) {
    existed.outerHTML = '';
    return true; // удален элемент из списка
  } else {
    return false; // ничего не удалено, т.к. не найдено
  }
}
function deleteExchangeRatesItemLast() {
  const existed = document.querySelector(`.block-rates__info:last-child`);
  if (existed) {
    existed.outerHTML = '';
    return true; // удален элемент из списка
  } else {
    return false; // ничего не удалено, т.к. не найдено
  }
}
function prependExchangeRatesItem(data) {
  const list = document.getElementById('block-rates');
  if (!list) return;
  const key = data.from + '/' + data.to;
  const dirDown = parseInt(data.change) === -1;

  const name = el('dt.param__name.block-rates__name', el('span', key));
  const value = el('dd.param__value.block-rates__value', round(data.rate, 2));
  // eslint-disable-next-line prettier/prettier
  let paramClasses = `param${
    dirDown ? '.param--critical' : '.param--success'
  }.block-rates__info.currency-${dirDown ? 'down' : 'up'}`;
  const item = el(`div.${paramClasses}`, [name, value]);
  item.dataset.currencies = key;

  list.prepend(item);
}
function refreshExchangeRates(data) {
  // console.log(data);
  const key = data.from + '/' + data.to;
  // удалим такой же элемент, если он уже существует, а если его еще нет, удалим последний
  if (!deleteExchangeRatesItem(key) && getExchangeRatesCount() >= 12) {
    deleteExchangeRatesItemLast();
  }
  prependExchangeRatesItem(data);
}

// форма обмена валюты
async function createFormCurrenciesExchange(currenciesList = []) {
  let currencies = currenciesList;
  if (!currencies?.length) {
    currencies = await loadCurrenciesDict();
  }

  const currenciesExchange = el('section.block.block--section.form-exchange');

  const title = el('h3.form-exchange__title', 'Обмен валюты');

  //  инпуты и кнопки
  const currencyFromLabel = el('label.label.form-exchange__label', 'Из');
  const currencyFromInput = createSelect('currency', {}, currencies);
  currencyFromInput.classList.add('currency-from');
  const currencyFromWrapper = el('div.form-exchange__wrapper-input', [
    currencyFromLabel,
    currencyFromInput,
  ]);
  const currencyToLabel = el('label.label.form-exchange__label', 'в');
  const currencyToInput = createSelect('currency', {}, currencies);
  currencyToInput.classList.add('currency-to');
  const currencyToWrapper = el('div.form-exchange__wrapper-input', [
    currencyToLabel,
    currencyToInput,
  ]);
  // объединить из и в
  const currenciesChooseWrapper = el('div.form-exchange__wrapper-inputs', [
    currencyFromWrapper,
    currencyToWrapper,
  ]);
  // сумма
  const sumLabel = el('label.label.form-exchange__label', 'Сумма');
  const sumInput = el('input.form-exchange__input');
  Inputmask({ regex: '\\d+\\.{0,1}\\d{0,}' }).mask(sumInput);
  const sumWrapper = el('div.form-exchange__wrapper-input', [
    sumLabel,
    sumInput,
  ]);
  // объединить все инпуты
  const inputsWrapper = el('div.form-exchange__wrapper-values', [
    currenciesChooseWrapper,
    sumWrapper,
  ]);
  // кнопка
  const exchangeBtn = createButton('exchange', {
    currencyFromInput: currencyFromInput,
    currencyToInput: currencyToInput,
    sumInput: sumInput,
  });
  exchangeBtn.classList.add('form-exchange__btn');
  // объединить кнопку и инпуты
  const allWrapper = el('div.form-exchange__wrapper-all', [
    inputsWrapper,
    exchangeBtn,
  ]);

  setChildren(currenciesExchange, [title, allWrapper]);

  return currenciesExchange;
}

export {
  createSelect,
  createButton,
  createGridAccounts,
  createBlockAccount,
  createFormTransactionNew,
  createBlockTransactionsHistory,
  createBlockTransactionsBalance,
  createBlockTransactionsInout,
  createFormLogin,
  createBlockMap,
  createBlockCurrenciesList,
  createFormCurrenciesExchange,
  refreshExchangeRates,
  createBlockCurrenciesRates,
  sortGridAccounts,
  createLoadingWindow,
};
