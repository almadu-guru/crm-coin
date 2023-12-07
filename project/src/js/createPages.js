import { el, setChildren, mount } from 'redom';
import { loadAccount, loadCurrenciesDict } from './requests';
import { onOpenAccountHistory } from './handlers';
import { getMonthsTransactionsData, getPriceFormatted } from './utilities';
import {
  createButton,
  createSelect,
  createGridAccounts,
  createFormTransactionNew,
  createBlockTransactionsHistory,
  createBlockTransactionsBalance,
  createBlockTransactionsInout,
  createFormLogin,
  createBlockMap,
  createBlockCurrenciesList,
  createBlockCurrenciesRates,
  createFormCurrenciesExchange,
  sortGridAccounts,
  createLoadingWindow,
} from './createElements';
import { showNotification } from './notifications';

const TITLE = 'Coin. Интернет-банкинг';
const PAGES = [
  {
    name: 'unknown',
    blocks: ['header-logo', 'header-menu'],
    title: 'Страница не найдена',
    filters: [],
    buttons: ['back'],
  },
  {
    name: 'login',
    blocks: ['header-logo', 'block-auth'],
    title: 'Авторизация',
    filters: [],
    buttons: [],
  },
  {
    name: 'accounts',
    blocks: [
      'header-logo',
      'header-menu',
      'title-line',
      'title-filters',
      'title-buttons',
      'accounts',
    ],
    title: 'Ваши счета',
    filters: ['sort'],
    buttons: ['createAccount'],
  },
  {
    name: 'account',
    blocks: [
      'header-logo',
      'header-menu',
      'title-line',
      'title-buttons',
      'title-info',
      'transactions-new',
      'transactions-balance',
      'transactions-history',
    ],
    title: 'Просмотр счета',
    filters: [],
    buttons: ['back'],
  },
  {
    name: 'history',
    blocks: [
      'header-logo',
      'header-menu',
      'title-line',
      'title-buttons',
      'title-info',
      'transactions-balance',
      'transactions-inout',
      'transactions-history',
    ],
    title: 'История баланса',
    filters: [],
    buttons: ['back'],
  },
  {
    name: 'exchange',
    blocks: [
      'header-logo',
      'header-menu',
      'title-line',
      'currencies-list',
      'currencies-exchange',
      'currencies-rates',
    ],
    title: 'Валютный обмен',
    filters: [],
    buttons: [],
  },
  {
    name: 'points',
    blocks: ['header-logo', 'header-menu', 'title-line', 'map'],
    title: 'Карта банкоматов',
    filters: [],
    buttons: [],
  },
];
function getPageByName(name) {
  return PAGES.find((page) => page.name === name);
}
function getPageBlocksList(name) {
  return PAGES.find((page) => page.name === name)?.blocks || [];
}

const app = document.getElementById('main-app');
let maps;

function createPage(name, params) {
  updateDocumentTitle(name);
  updateHeader(name);

  switch (name) {
    case 'login':
      createPageAuth();
      break;
    case 'accounts':
      createPageAccounts();
      break;
    case 'account':
      createPageAccount({ accountId: params.accountId });
      break;
    case 'history':
      createPageHistory({ accountId: params.accountId });
      break;
    case 'exchange':
      createPageExchange();
      break;
    case 'points':
      createPagePoints();
      break;
    default:
      createPageNotExists();
  }
}

// обновление заголовка страницы
function updateDocumentTitle(pageName) {
  const pageTitle = getPageByName(pageName)?.title;
  document.title = `${TITLE} - ${pageTitle ?? 'Страница не найдена'}`;
}

// обновление шапки страницы с навигацией
function updateHeader(pageName) {
  const headerBlocks = getPageBlocksList(pageName).filter((page) =>
    page.includes('header-')
  );

  // скрыть блок с меню и выйти, если такового нет в списке блоков
  if (!headerBlocks.length) {
    document.getElementById('page-header').classList.add('hidden');
    return;
  } else {
    document.getElementById('page-header').classList.remove('hidden');
  }

  // видимость логотипа
  if (!headerBlocks.includes('header-logo')) {
    document.getElementById('page-header-title').classList.add('hidden');
  } else {
    document.getElementById('page-header-title').classList.remove('hidden');
  }

  // фокус на активной странице
  document.querySelectorAll('.btn-menu').forEach((btn) => {
    if (btn.dataset.menuLink === pageName) {
      btn.classList.add('btn-menu--checked');
    } else {
      btn.classList.remove('btn-menu--checked');
    }
  });

  // невидимость для страницы логина
  const pagesMenuVisible = PAGES.filter((page) => {
    return (
      page.blocks.filter((name) => name.includes('header-menu')).length > 0
    );
  });
  if (pagesMenuVisible.map((page) => page.name).includes(pageName)) {
    document.getElementById('page-header-menu').classList.remove('hidden');
  } else {
    document.getElementById('page-header-menu').classList.add('hidden');
  }
}

// обновить блок с содержимым на странице
function updatePageContent(newPage) {
  if (!newPage) {
    app.innerHTML = '';
  } else {
    setChildren(app, newPage);
  }
}

// процесс старта и финиша обновления на странице
let loading;
function startLoadingPage(page) {
  loading = createLoadingWindow();
  mount(page, loading);
  updatePageContent(page);
}
function stopLoadingPage() {
  if (loading) loading.outerHTML = '';
}

// создание строки с заголовкой, фильтрами и кнопками + доп. информацией
function createContentTitle(pageName, params) {
  const pageInfo = getPageByName(pageName);
  if (!pageInfo) return;

  const header = el('header.main__header');

  // строка главная
  const title = el('h2.main__title', pageInfo?.title ?? 'Неизвестная страница');

  const filters = el('div.filters.main__filters');
  pageInfo.filters.forEach((item) => {
    const filter = createSelect(item, { onChangeFilterItem: sortGridAccounts });
    if (filter) mount(filters, filter);
  });

  const buttons = el('div.main__buttons');
  pageInfo.buttons.forEach((item) => {
    const button = createButton(item, {});
    if (button) mount(buttons, button);
  });

  const row1 = el('div.main__header-row', [title, filters, buttons]);
  mount(header, row1);

  // строка дополнительная (при наличии)
  if (pageInfo.blocks.find((value) => value === 'title-info')) {
    if (params) {
      const subtitle = el('p.main__subtitle', params.account);
      const info = el('div.main__info');
      const balanceCaption = el('p.main__info-key', 'Баланс');
      const balance = el(
        'p.main__info-value',
        `${getPriceFormatted(params.balance)}`
      );
      setChildren(info, [balanceCaption, balance]);
      const row2 = el('div.main__header-row', [subtitle, info]);
      mount(header, row2);
    }
  }

  return header;
}

// страница авторизации
function createPageAuth() {
  const page = el('div.app__container');

  // основной контент
  const form = createFormLogin();
  if (form) {
    const content = el('div.page-login');
    mount(content, form);
    mount(page, content);
  }

  updatePageContent(page);
}

// страница счетов
async function createPageAccounts() {
  const page = el('div.app__container');

  // заголовок + фильтры + кнопки + информация
  const title = createContentTitle('accounts');
  if (title) mount(page, title);

  startLoadingPage(page);
  try {
    // тело страницы
    const content = await createGridAccounts();
    if (content) mount(page, content);
    updatePageContent(page);
  } finally {
    stopLoadingPage(loading);
  }
}

// страница счета
async function createPageAccount({ accountId }) {
  if (!accountId) return;

  const page = el('div.app__container');

  startLoadingPage(page);
  try {
    const res = await loadAccount(accountId);
    if (!res.success) {
      showNotification(res.error, 'error');
      return;
    }
    let account = res.data;

    //  заголовок + фильтры + кнопки + информация
    const title = createContentTitle('account', account);
    if (title) mount(page, title);

    //  основной контент
    const accountBlocks = getPageBlocksList('account').filter((page) =>
      page.includes('transactions-')
    );

    if (accountBlocks.length) {
      const content = el('div.grid.grid-account');

      const data = getMonthsTransactionsData(account, 6);

      // форма создания нового перевода
      if (accountBlocks.includes('transactions-new')) {
        const transactionsNew = await createFormTransactionNew({ accountId });
        if (transactionsNew) mount(content, transactionsNew);
      }

      if (accountBlocks.includes('transactions-balance')) {
        const transactionsBalance = createBlockTransactionsBalance(data);
        transactionsBalance.classList.add('block-chart--small');
        transactionsBalance.addEventListener('click', (e) => {
          e.preventDefault();
          onOpenAccountHistory({ id: accountId });
        });
        if (transactionsBalance) mount(content, transactionsBalance);
      }

      if (accountBlocks.includes('transactions-history')) {
        const transactionsHistory = await createBlockTransactionsHistory({
          accountId,
          accountData: account,
        });
        // TODO! разместить grid-area в стилях!
        transactionsHistory.style.gridArea = '2 / 1 / span 1 / span 2';
        transactionsHistory.addEventListener('click', (e) => {
          e.preventDefault();
          onOpenAccountHistory({ id: accountId });
        });
        if (transactionsHistory) mount(content, transactionsHistory);
      }

      mount(page, content);
    }

    updatePageContent(page);
  } finally {
    stopLoadingPage();
  }
}

// страница истории операций по счету
async function createPageHistory({ accountId }) {
  if (!accountId) return;

  const page = el('div.app__container');

  startLoadingPage(page);
  try {
    let res = await loadAccount(accountId);
    if (!res.success) {
      // alert(`Ошибка: ${res.error}`);
      showNotification(res.error, 'error');
      return;
    }
    let account = res.data;

    //  заголовок + фильтры + кнопки + информация
    const title = createContentTitle('history', account);
    if (title) mount(page, title);

    //  основной контент
    const historyBlocks = getPageBlocksList('history').filter((page) =>
      page.includes('transactions-')
    );

    if (historyBlocks.length) {
      const content = el('div.grid.grid-history');

      const data = getMonthsTransactionsData(account, 12);

      if (historyBlocks.includes('transactions-balance')) {
        const transactionsBalance = createBlockTransactionsBalance(data);
        if (transactionsBalance) mount(content, transactionsBalance);
      }

      if (historyBlocks.includes('transactions-inout')) {
        const transactionsInout = createBlockTransactionsInout(data);
        if (transactionsInout) mount(content, transactionsInout);
      }

      if (historyBlocks.includes('transactions-history')) {
        const transactionsHistory = await createBlockTransactionsHistory({
          accountId,
          accountData: account,
          page: 1,
          pagesVisible: true,
        });
        if (transactionsHistory) mount(content, transactionsHistory);
      }

      mount(page, content);
    }

    updatePageContent(page);
  } finally {
    stopLoadingPage();
  }
}

// страница обмена валют
async function createPageExchange() {
  const page = el('div.app__container');

  // заголовок + фильтры + кнопки + информация
  const title = createContentTitle('exchange');
  if (title) mount(page, title);

  startLoadingPage(page);
  try {
    // основной контент
    const currenciesBlocks = getPageBlocksList('exchange').filter((page) =>
      page.includes('currencies-')
    );

    if (currenciesBlocks.length) {
      const content = el('div.grid.grid-currencies');

      const data = await loadCurrenciesDict();
      data.sort((a, b) => {
        if (a > b) return 1;
        if (a == b) return 0;
        if (a < b) return -1;
      });

      if (currenciesBlocks.includes('currencies-list')) {
        const currenciesList = await createBlockCurrenciesList(data);
        if (currenciesList) mount(content, currenciesList);
      }

      if (currenciesBlocks.includes('currencies-exchange')) {
        const currenciesExchange = await createFormCurrenciesExchange(data);
        if (currenciesExchange) mount(content, currenciesExchange);
      }

      if (currenciesBlocks.includes('currencies-rates')) {
        const currenciesRates = await createBlockCurrenciesRates();
        if (currenciesRates) mount(content, currenciesRates);
      }

      mount(page, content);
    }

    updatePageContent(page);
  } finally {
    stopLoadingPage();
  }
}

// страница с картой и банкоматами
async function createPagePoints() {
  const page = el('div.app__container');

  //  заголовок + фильтры + кнопки + информация
  const title = createContentTitle('points');
  if (title) mount(page, title);

  if (!maps) startLoadingPage(page);
  try {
    //  основной контент
    if (!maps) maps = await createBlockMap();
    if (maps) mount(page, maps);

    updatePageContent(page);
  } finally {
    // пусть отключается через пару секунд, т.к. отрисовка карты идет не быстро
    setTimeout(stopLoadingPage, 1000);
    // stopLoadingPage();
  }
}

// несуществующая страница
function createPageNotExists() {
  const page = el('h2.main__header', 'Страница не найдена!');
  updatePageContent(page);
}

export { createPage };
