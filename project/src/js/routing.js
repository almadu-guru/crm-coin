import Navigo from 'navigo';
import { logout, isLoggedOn } from './auth';
import { createPage } from './createPages';
import { openWebSocket } from './requests';

const router = new Navigo('/');
openWebSocket(); // сокет для непрерывного отслеживания изменений курсов валют

//  страницы (де)авторизации
router.on('/login', () => {
  if (isLoggedOn()) {
    logout();
  } else {
    createPage('login');
  }
});

router.on('/logout', () => {
  if (logout()) router.navigate('/login');
});

// несуществующая страница
router.on('/unknown', () => {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    createPage('unknown');
  }
});

//  список счетов
router.on('/accounts', () => {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    createPage('accounts');
  }
});

//  отдельный счет
router.on('/accounts/:id', (data) => {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    createPage('account', { accountId: data.data.id });
  }
});

//  история по счету
router.on('/accounts/:id/history', (data) => {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    createPage('history', { accountId: data.data.id });
  }
});

//  страница валютных операций
router.on('/exchange', () => {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    createPage('exchange');
  }
});

//  страница с картой
router.on('/points', () => {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    createPage('points');
  }
});

//  корневая страница
router.on('/', () => {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    router.navigate('/accounts');
  }
});

//  все остальные страницы
router.on('*', () => {
  if (!isLoggedOn()) {
    router.navigate('/login');
  } else {
    router.navigate('/unknown');
  }
});

router.resolve();

export { router };
